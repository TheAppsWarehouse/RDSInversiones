import { Platform } from 'react-native';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/template';
import { Alert } from '@/types/stock';
import Constants from 'expo-constants';

// ─── Lazy Notifications module ────────────────────────────────────────────────
// Never evaluated at import time — prevents crashes on web / Live Preview
// where expo-notifications is unavailable.

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

// ─── Permission request ───────────────────────────────────────────────────────

export async function requestNotificationPermissions(): Promise<boolean> {
  const n = N();
  if (!n) return false;
  try {
    const { status: existingStatus } = await n.getPermissionsAsync();
    if (existingStatus === 'granted') return true;
    const { status } = await n.requestPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.error('[notifications] requestNotificationPermissions failed:', err);
    return false;
  }
}

// ─── Push Token Registration ──────────────────────────────────────────────────

export async function registerPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  const n = N();
  if (!n) {
    console.error('[notifications] registerPushToken: expo-notifications module unavailable');
    return;
  }

  // 1. Check permission
  const { status } = await n.getPermissionsAsync();
  if (status !== 'granted') {
    console.error(`[notifications] registerPushToken: permission not granted (status=${status}). Token not registered.`);
    return;
  }

  // 2. Android notification channel (required for Android 8+)
  if (Platform.OS === 'android') {
    try {
      await n.setNotificationChannelAsync('alerts', {
        name: 'Stock Alerts',
        importance: n.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#10b981',
        enableVibrate: true,
        showBadge: true,
      });
    } catch (channelErr) {
      console.error('[notifications] registerPushToken: failed to set Android notification channel:', channelErr);
    }
  }

  // 3. Resolve EAS projectId
  const projectId: string | undefined =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined;

  if (!projectId) {
    console.error('[notifications] registerPushToken: EAS projectId not found in Constants.expoConfig.extra.eas.projectId. Token may not work in production.');
  } else {
    console.log(`[notifications] registerPushToken: using projectId=${projectId}`);
  }

  // 4. Obtain Expo Push Token
  let token: string;
  try {
    const tokenData = await n.getExpoPushTokenAsync(projectId ? { projectId } : {});
    token = tokenData.data;
    if (!token) {
      console.error('[notifications] registerPushToken: getExpoPushTokenAsync returned an empty token.');
      return;
    }
    console.log(`[notifications] registerPushToken: token obtained (${token.slice(0, 20)}...)`);
  } catch (tokenErr) {
    console.error('[notifications] registerPushToken: failed to obtain Expo Push Token:', tokenErr);
    return;
  }

  // 5. Upsert token in push_tokens table
  try {
    const supabase = getSupabaseClient();
    const { error: upsertError } = await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );

    if (upsertError) {
      console.error('[notifications] registerPushToken: Supabase upsert failed:', upsertError.message);
    } else {
      console.log(`[notifications] registerPushToken: token stored for user ${userId}`);
    }
  } catch (dbErr) {
    console.error('[notifications] registerPushToken: unexpected error during Supabase upsert:', dbErr);
  }
}

export async function unregisterPushToken(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('push_tokens').delete().eq('user_id', userId);
    if (error) {
      console.error('[notifications] unregisterPushToken: Supabase delete failed:', error.message);
    }
  } catch (err) {
    console.error('[notifications] unregisterPushToken: unexpected error:', err);
  }
}

// ─── Local (foreground) notification ─────────────────────────────────────────

async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
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
  } catch (err) {
    console.error('[notifications] scheduleLocalNotification failed:', err);
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
  const supabase = getSupabaseClient();
  const { error } = await supabase.functions.invoke('send-push-notification', {
    body: {
      event,
      alert_id: alert.id,
      ticker: alert.ticker,
      ticker_name: alert.ticker_name ?? undefined,
      target_accounts: alert.target_accounts,
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
      try {
        const statusCode = error.context?.status ?? 500;
        const textContent = await error.context?.text();
        msg = `[Code: ${statusCode}] ${textContent || error.message}`;
      } catch { /* ignore */ }
    }
    console.error(`[notifications] dispatchRemotePush (${event} / ${alert.ticker}) edge function error:`, msg);
  }
}

// ─── Unified dispatchers ──────────────────────────────────────────────────────

export async function dispatchAlertCreated(
  alert: Alert,
  _isSubscriber: boolean,
  pushEnabled: boolean
): Promise<void> {
  if (!pushEnabled) return;

  dispatchRemotePush(alert, 'created').catch((err) => {
    console.error('[notifications] dispatchAlertCreated remote push failed:', err);
  });

  scheduleLocalNotification(
    `New Alert: ${alert.ticker}`,
    `A new alert was created for ${alert.ticker}.`,
    { screen: '/(tabs)', ticker: alert.ticker }
  ).catch((err) => {
    console.error('[notifications] dispatchAlertCreated local notification failed:', err);
  });
}

export async function dispatchAlertUpdated(
  alert: Alert,
  _isSubscriber: boolean,
  pushEnabled: boolean
): Promise<void> {
  if (!pushEnabled) return;

  dispatchRemotePush(alert, 'updated').catch((err) => {
    console.error('[notifications] dispatchAlertUpdated remote push failed:', err);
  });

  scheduleLocalNotification(
    `Alert Updated: ${alert.ticker}`,
    `The alert for ${alert.ticker} was updated.`,
    { screen: '/(tabs)', ticker: alert.ticker }
  ).catch((err) => {
    console.error('[notifications] dispatchAlertUpdated local notification failed:', err);
  });
}

export async function dispatchAlertClosed(
  alert: Alert,
  _isSubscriber: boolean,
  pushEnabled: boolean
): Promise<void> {
  if (!pushEnabled) return;

  dispatchRemotePush(alert, 'closed', {
    closing_price: alert.closing_price,
  }).catch((err) => {
    console.error('[notifications] dispatchAlertClosed remote push failed:', err);
  });

  scheduleLocalNotification(
    `Alert Closed: ${alert.ticker}`,
    `The alert for ${alert.ticker} has been closed.`,
    { screen: '/(tabs)', ticker: alert.ticker }
  ).catch((err) => {
    console.error('[notifications] dispatchAlertClosed local notification failed:', err);
  });
}
