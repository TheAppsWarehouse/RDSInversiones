import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/template';
import { Alert } from '@/types/stock';
import Constants from 'expo-constants';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ─── Push Token Registration ──────────────────────────────────────────────────

/**
 * Get the Expo Push Token for this device and persist it to the database
 * so the backend can send remote push notifications to this user.
 * Should be called after the user successfully logs in.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;

    // Android requires a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('alerts', {
        name: 'Stock Alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
        enableVibrate: true,
        showBadge: true,
      });
    }

    // projectId is required for standalone builds; fall back gracefully in Expo Go
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;

    const tokenData = await Notifications.getExpoPushTokenAsync(
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
    // Non-fatal: log but don't block the login flow
    console.log('Push token registration error:', error);
  }
}

/**
 * Remove all push tokens for this user from the database (call on logout).
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    const supabase = getSupabaseClient();
    await supabase.from('push_tokens').delete().eq('user_id', userId);
  } catch (error) {
    console.log('Push token unregistration error:', error);
  }
}

// ─── Local notification (foreground / admin's own device) ────────────────────

async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data ?? {},
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
      },
      trigger: null,
    });
  } catch (error) {
    console.log('Local notification error:', error);
  }
}

// ─── Remote push via edge function (sends to ALL eligible users' devices) ─────

/**
 * Calls the send-alert-email edge function which resolves eligible push tokens
 * from the DB and delivers remote notifications via Expo Push API.
 * This is the primary notification path for all users.
 */
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
  // 1. Remote push to all eligible users
  dispatchRemotePush(alert, 'created').catch(() => {});
  // 2. Local notification on admin's own device
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
