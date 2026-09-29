import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'created' | 'updated' | 'closed';
type TargetAccounts = 'Subscribers' | 'Free-Accounts';

interface PushPayload {
  event: EventType;
  alert_id?: string;
  ticker: string;
  ticker_name?: string;
  target_accounts: TargetAccounts;
  action?: string | null;
  entry_price?: number | null;
  re_entry_price?: number | null;
  current_price?: number | null;
  closing_price?: number | null;
  three_months_goal?: number | null;
  action_conservative?: string;
  action_moderate?: string;
  action_aggressive?: string;
  yield_percent?: number | null;
  elapsed_days?: number | null;
}

// ─── Push notification message builders ───────────────────────────────────────

function buildPushTitle(event: EventType, ticker: string): string {
  if (event === 'created') return `🚨 New Alert: ${ticker}`;
  if (event === 'updated') return `🔔 Alert Updated: ${ticker}`;
  return `🔒 Alert Closed: ${ticker}`;
}

function formatPct(val: number | null | undefined): string {
  if (val == null) return '-';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function buildPushBody(p: PushPayload): string {
  const name = p.ticker_name ? ` (${p.ticker_name})` : '';

  if (p.event === 'created') {
    const action = p.action ? ` — ${p.action}` : '';
    return `${p.ticker}${name}${action}. Check the app for full details.`;
  }
  if (p.event === 'updated') {
    const c = p.action_conservative ? `C:${p.action_conservative}` : '';
    const m = p.action_moderate ? ` M:${p.action_moderate}` : '';
    const a = p.action_aggressive ? ` A:${p.action_aggressive}` : '';
    return `${p.ticker}${name} — ${c}${m}${a}`.trim();
  }
  // closed
  const y = p.yield_percent != null ? ` Yield: ${formatPct(p.yield_percent)}` : '';
  return `${p.ticker}${name} has been closed.${y}`;
}

// ─── Expo Push API ────────────────────────────────────────────────────────────

interface PushResult {
  sent: number;
  errors: string[];
  invalidTokens: string[];
}

/**
 * Send push notifications via Expo Push API (HIGH priority).
 * Batches up to 100 tokens per request.
 * Detects DeviceNotRegistered tokens for cleanup.
 */
async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<PushResult> {
  if (tokens.length === 0) return { sent: 0, errors: [], invalidTokens: [] };

  const BATCH_SIZE = 100;
  let sent = 0;
  const errors: string[] = [];
  const invalidTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);

    const messages = batch.map((token) => ({
      to: token,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
      _contentAvailable: true,
    }));

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const text = await response.text();
        const errMsg = `Expo API error (batch ${Math.floor(i / BATCH_SIZE) + 1}): HTTP ${response.status} — ${text}`;
        console.error(errMsg);
        errors.push(errMsg);
        continue;
      }

      const result = await response.json();
      const receipts: Array<{ status: string; message?: string; details?: { error?: string } }> =
        result.data ?? [];

      for (let j = 0; j < receipts.length; j++) {
        const receipt = receipts[j];
        if (receipt.status === 'ok') {
          sent++;
        } else {
          const msg = receipt.message ?? 'Unknown push error';
          const detail = receipt.details?.error ?? '';
          const errMsg = `Token ${batch[j]}: ${msg}${detail ? ` (${detail})` : ''}`;
          console.error(errMsg);
          errors.push(errMsg);
          // Mark DeviceNotRegistered tokens for removal
          if (detail === 'DeviceNotRegistered') {
            invalidTokens.push(batch[j]);
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const errMsg = `Network error (batch ${Math.floor(i / BATCH_SIZE) + 1}): ${message}`;
      console.error(errMsg);
      errors.push(errMsg);
    }
  }

  return { sent, errors, invalidTokens };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: PushPayload = await req.json();
    const { event, ticker, target_accounts } = payload;

    if (!event || !ticker || !target_accounts) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: event, ticker, target_accounts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`[send-push-notification] Processing ${event} for "${ticker}" → target: ${target_accounts}`);

    // ── Step 1: Resolve eligible account types ─────────────────────────────────
    //
    // Scope rules (unchanged from existing business logic):
    //   'Subscribers'  → Affiliate + Admin + Dev
    //   'Free-Accounts' → Free + Affiliate + Admin + Dev
    //
    // Dev and Admin always receive notifications.
    // Free users only when target_accounts = 'Free-Accounts'.

    const eligibleAccountTypes =
      target_accounts === 'Subscribers'
        ? ['Affiliate', 'Admin', 'Dev']
        : ['Free', 'Affiliate', 'Admin', 'Dev'];

    // ── Step 2: Fetch matching user IDs from allowed_emails → user_profiles ─────
    //
    // allowed_emails holds every permitted email and its account_type.
    // user_profiles holds the user's UUID (populated on first login).
    // We only send to users who have actually logged in (have a user_profile row).
    // No email preference is consulted — push opt-out is handled client-side.

    const { data: allowedData, error: allowedError } = await supabaseAdmin
      .from('allowed_emails')
      .select('email')
      .in('account_type', eligibleAccountTypes);

    if (allowedError) {
      throw new Error(`allowed_emails query failed: ${allowedError.message}`);
    }

    const candidateEmails: string[] = (allowedData ?? []).map((r: { email: string }) => r.email);

    if (candidateEmails.length === 0) {
      console.log('[send-push-notification] No candidate emails found for this scope.');
      return new Response(
        JSON.stringify({ message: 'No candidates in scope', pushSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { data: profilesData, error: profilesError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .in('email', candidateEmails);

    if (profilesError) {
      throw new Error(`user_profiles query failed: ${profilesError.message}`);
    }

    const eligibleUserIds: string[] = (profilesData ?? []).map((p: { id: string }) => p.id);

    console.log(
      `[send-push-notification] Eligible registered users: ${eligibleUserIds.length} of ${candidateEmails.length} candidates`
    );

    if (eligibleUserIds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No registered users in scope', pushSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── Step 3: Resolve push tokens ────────────────────────────────────────────
    //
    // 'created'          → send to ALL eligible registered users (broadcast within scope)
    // 'updated'/'closed' → send only to eligible users who have watchlisted this alert

    let targetUserIds: string[] = eligibleUserIds;

    if ((event === 'updated' || event === 'closed') && payload.alert_id) {
      const { data: watchlistRows, error: watchlistError } = await supabaseAdmin
        .from('watchlist')
        .select('user_id')
        .eq('alert_id', payload.alert_id)
        .in('user_id', eligibleUserIds);

      if (watchlistError) {
        console.error('[send-push-notification] watchlist query failed:', watchlistError.message);
        // Non-fatal: fall back to empty list (no notifications for update/close)
        targetUserIds = [];
      } else {
        targetUserIds = (watchlistRows ?? []).map((r: { user_id: string }) => r.user_id);
        console.log(
          `[send-push-notification] Watchlist members for alert ${payload.alert_id}: ${targetUserIds.length}`
        );
      }
    }

    if (targetUserIds.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No target users after watchlist filter', pushSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { data: tokenRows, error: tokenError } = await supabaseAdmin
      .from('push_tokens')
      .select('token')
      .in('user_id', targetUserIds);

    if (tokenError) {
      throw new Error(`push_tokens query failed: ${tokenError.message}`);
    }

    const pushTokens: string[] = (tokenRows ?? [])
      .map((r: { token: string }) => r.token)
      .filter(Boolean);

    console.log(`[send-push-notification] Push tokens resolved: ${pushTokens.length}`);

    if (pushTokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No push tokens registered for target users', pushSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── Step 4: Send push notifications ────────────────────────────────────────

    const pushTitle = buildPushTitle(event, ticker);
    const pushBody = buildPushBody(payload);
    const pushData = { screen: '/(tabs)', ticker, event };

    const pushResult = await sendExpoPushNotifications(pushTokens, pushTitle, pushBody, pushData);

    console.log(
      `[send-push-notification] Sent: ${pushResult.sent}, errors: ${pushResult.errors.length}, invalid tokens: ${pushResult.invalidTokens.length}`
    );

    // ── Step 5: Clean up invalid (DeviceNotRegistered) tokens ──────────────────

    if (pushResult.invalidTokens.length > 0) {
      const { error: cleanupError } = await supabaseAdmin
        .from('push_tokens')
        .delete()
        .in('token', pushResult.invalidTokens);

      if (cleanupError) {
        console.error('[send-push-notification] Failed to clean up invalid tokens:', cleanupError.message);
      } else {
        console.log(`[send-push-notification] Cleaned up ${pushResult.invalidTokens.length} invalid token(s).`);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Push dispatch complete',
        pushSent: pushResult.sent,
        pushErrors: pushResult.errors.slice(0, 10),
        invalidTokensCleaned: pushResult.invalidTokens.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[send-push-notification] Fatal error:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
