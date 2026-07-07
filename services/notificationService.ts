import { Platform } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/template';
import { Alert } from '@/types/stock';
import Constants from 'expo-constants';

// Lazily resolved Notifications module — never evaluated at import time.
// This prevents crashes on web / Live Preview where expo-notifications is unavailable.
type NotificationsModule = typeof import('expo-notifications');
let _notif: NotificationsModule | null = null;
let _handlerSet = false;

function N(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  if (_notif) return _notif;
  try {
    _notif = require('expo-notifications') as NotificationsModule;
  } catch {
    _notif = null;
    return null;
  }
  // Set handler exactly once after the module resolves
  if (!_handlerSet) {
    try {
      _notif!.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      _handlerSet = true;
    } catch {}
  }
  return _notif;
}

export async function requestNotificationPermissions(): Promise<boolean> {
  const n = N();
  if (!n) return false;
  try {
    const { status: existingStatus } = await n.getPermissionsAsync();
    if (existingStatus === 'granted') return true;
    const { status } = await n.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

// ─── Push Token Registration ──────────────────────────────────────────────────

export async function registerPushToken(userId: string): Promise<void> {
  try {
    const n = N();
    if (!n) return;

    const { status } = await n.getPermissionsAsync();
    if (status !== 'granted') return;

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await n.setNotificationChannelAsync('alerts', {
        name: 'Stock Alerts',
        importance: n.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
        enableVibrate: true,
        showBadge: true,
      });
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;

    const tokenData = await n.getExpoPushTokenAsync(
      projectId ? { projectId } : {}
    );
    const token = tokenData.data;
    if (!token) return;

    const supabase = getSupabaseClient();
    await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );
  } catch (error) {
    console.log('Push token registration error:', error);
  }
}

export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    const supabase = getSupabaseClient();
    await supabase.from('push_tokens').delete().eq('user_id', userId);
  } catch (error) {
    console.log('Push token unregistration error:', error);
  }
}

// ─── Local notification ───────────────────────────────────────────────────────

async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  const n = N();
  if (!n) return;
  try {
    const { status } = await n.getPermissionsAsync();
    if (status !== 'granted') return;
    await n.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
        priority: n.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  } catch (error) {
    console.log('Local notification error:', error);
  }
}

// ─── Remote push via edge function ───────────────────────────────────────────

async function dispatchRemotePush(
  alert: Alert,
  event: 'created' | 'updated' | 'closed',
  extra: {
    yield_percent?: number | null;
    elapsed_days?: number | null;
    closing_price?: number | null;
  } = {}
): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.functions.invoke('send-alert-email', {
      body: {
        event,
        alert_id: alert.id,
        ticker: alert.ticker,
        ticker_name: alert.ticker_name ?? undefined,
        target_accounts: alert.target_accounts,
        market: alert.market ?? 'EEUU',
        action: alert.action ?? null,
        entry_price: alert.entry_price ?? null,
        re_entry_price: alert.re_entry_price ?? null,
        current_price: alert.current_price ?? null,
        closing_price: extra.closing_price ?? alert.closing_price ?? null,
        three_months_goal: alert.three_months_goal ?? null,
        action_conservative: alert.action_conservative,
        action_moderate: alert.action_moderate,
        action_aggressive: alert.action_aggressive,
        yield_percent: extra.yield_percent ?? null,
        elapsed_days: extra.elapsed_days ?? null,
      },
    });
    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = await error.context?.text() ?? msg; } catch { /* ignore */ }
      }
      console.error('dispatchRemotePush edge function error:', msg);
    }
  } catch (err) {
    console.error('dispatchRemotePush exception:', err);
  }
}

// ─── Unified dispatchers ──────────────────────────────────────────────────────

export async function dispatchAlertCreated(
  alert: Alert,
  _isSubscriber: boolean,
  pushEnabled: boolean
): Promise<void> {
  if (!pushEnabled) return;
  dispatchRemotePush(alert, 'created').catch(() => {});
  scheduleLocalNotification(
    `New Alert: ${alert.ticker}`,
    `A new ${alert.action ?? ''} alert was created for ${alert.ticker}.`,
    { screen: '/(tabs)', ticker: alert.ticker }
  ).catch(() => {});
}

export async function dispatchAlertUpdated(
  alert: Alert,
  _isSubscriber: boolean,
  pushEnabled: boolean
): Promise<void> {
  if (!pushEnabled) return;
  dispatchRemotePush(alert, 'updated').catch(() => {});
  scheduleLocalNotification(
    `Alert Updated: ${alert.ticker}`,
    `The alert for ${alert.ticker} was updated.`,
    { screen: '/(tabs)', ticker: alert.ticker }
  ).catch(() => {});
}

export async function dispatchAlertClosed(
  alert: Alert,
  _isSubscriber: boolean,
  pushEnabled: boolean
): Promise<void> {
  if (!pushEnabled) return;
  dispatchRemotePush(alert, 'closed', {
    closing_price: alert.closing_price,
  }).catch(() => {});
  scheduleLocalNotification(
    `Alert Closed: ${alert.ticker}`,
    `The alert for ${alert.ticker} has been closed.`,
    { screen: '/(tabs)', ticker: alert.ticker }
  ).catch(() => {});
}
