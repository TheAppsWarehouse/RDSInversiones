import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = 'created' | 'updated' | 'closed';
type TargetAccounts = 'Subscribers' | 'Free-Accounts';
type AlertMarket = 'EEUU' | 'ARG';

interface AlertPayload {
  event: EventType;
  alert_id?: string;
  ticker: string;
  ticker_name?: string;
  target_accounts: TargetAccounts;
  market: AlertMarket;
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPrice(val: number | null | undefined, market: AlertMarket): string {
  if (val == null) return '-';
  const symbol = market === 'ARG' ? 'AR$' : 'US$';
  return `${symbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPct(val: number | null | undefined): string {
  if (val == null) return '-';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function formatElapsed(days: number | null | undefined): string {
  if (days == null) return '-';
  if (days < 1) return '< 1 day';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  const rem = days % 30;
  if (rem === 0) return `${months} mo.`;
  return `${months} mo. ${rem} d.`;
}

// ─── Push notification builders ───────────────────────────────────────────────

function buildPushTitle(event: EventType, ticker: string): string {
  if (event === 'created') return `🚨 New Alert: ${ticker}`;
  if (event === 'updated') return `🔔 Alert Updated: ${ticker}`;
  return `🔒 Alert Closed: ${ticker}`;
}

function buildPushBody(p: AlertPayload): string {
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

/**
 * Send remote push notifications to a list of Expo push tokens with HIGH priority.
 * Uses the Expo Push API directly (no SDK needed in Deno).
 * Batches up to 100 tokens per request as per Expo's recommendation.
 */
async function sendExpoPushNotifications(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<{ sent: number; errors: string[] }> {
  if (tokens.length === 0) return { sent: 0, errors: [] };

  const BATCH_SIZE = 100;
  let sent = 0;
  const errors: string[] = [];

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);

    const messages = batch.map((token) => ({
      to: token,
      title,
      body,
      data,
      sound: 'default',
      // HIGH priority — bypasses Android Doze mode, immediate delivery on iOS
      priority: 'high',
      // iOS: display as time-sensitive notification (requires entitlement in production)
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
        errors.push(`Expo API error (batch ${i / BATCH_SIZE + 1}): ${response.status} — ${text}`);
        continue;
      }

      const result = await response.json();
      const receipts: any[] = result.data ?? [];

      for (let j = 0; j < receipts.length; j++) {
        const receipt = receipts[j];
        if (receipt.status === 'ok') {
          sent++;
        } else {
          const msg = receipt.message ?? 'Unknown push error';
          const detail = receipt.details?.error ?? '';
          errors.push(`Token ${batch[j]}: ${msg}${detail ? ` (${detail})` : ''}`);
          // DeviceNotRegistered means the token is stale — caller should clean it up
        }
      }
    } catch (err: any) {
      errors.push(`Network error (batch ${i / BATCH_SIZE + 1}): ${err.message}`);
    }
  }

  return { sent, errors };
}

// ─── Email builders ───────────────────────────────────────────────────────────

function buildSubject(event: EventType, ticker: string): string {
  if (event === 'created') return `A new Alert was created for ${ticker}!`;
  if (event === 'updated') return `An Alert was updated for ${ticker}!`;
  return `An Alert was closed for ${ticker}!`;
}

function buildHtmlBody(p: AlertPayload): string {
  const name = p.ticker_name ? ` (${p.ticker_name})` : '';
  let rows = '';

  if (p.event === 'created') {
    const actionLabel = p.action === 'Buy' ? 'Buy' : p.action === 'Sell' ? 'Sell' : '';
    const alertTitle = actionLabel ? `${actionLabel} Alert: ${p.ticker}${name}` : `Alert: ${p.ticker}${name}`;
    rows = `
      <tr><td style="padding:8px 0;font-size:18px;font-weight:700;color:#111827;">🚨 ${alertTitle}</td></tr>
      ${p.action_conservative ? `<tr><td style="padding:4px 0;color:#374151;">👨‍🦳 Conservative Profiles: <strong>${p.action_conservative}</strong></td></tr>` : ''}
      ${p.action_moderate ? `<tr><td style="padding:4px 0;color:#374151;">👩‍🌾 Moderate Profiles: <strong>${p.action_moderate}</strong></td></tr>` : ''}
      ${p.action_aggressive ? `<tr><td style="padding:4px 0;color:#374151;">👽 Aggressive Profiles: <strong>${p.action_aggressive}</strong></td></tr>` : ''}
      ${p.entry_price != null ? `<tr><td style="padding:4px 0;color:#374151;">💱 Entry Price: <strong>${formatPrice(p.entry_price, p.market)}</strong></td></tr>` : ''}
      ${p.re_entry_price != null ? `<tr><td style="padding:4px 0;color:#374151;">💱 Re-Entry Price: <strong>${formatPrice(p.re_entry_price, p.market)}</strong></td></tr>` : ''}
      ${p.three_months_goal != null ? `<tr><td style="padding:4px 0;color:#374151;">🎯 3-Month Goal: <strong>${p.three_months_goal.toFixed(1)}%</strong></td></tr>` : ''}
    `;
  } else if (p.event === 'updated') {
    rows = `
      <tr><td style="padding:8px 0;font-size:18px;font-weight:700;color:#111827;">🚨 Update: ${p.ticker}${name}</td></tr>
      ${p.action_conservative ? `<tr><td style="padding:4px 0;color:#374151;">👨‍🦳 Conservative Profiles: <strong>${p.action_conservative}</strong></td></tr>` : ''}
      ${p.action_moderate ? `<tr><td style="padding:4px 0;color:#374151;">👩‍🌾 Moderate Profiles: <strong>${p.action_moderate}</strong></td></tr>` : ''}
      ${p.action_aggressive ? `<tr><td style="padding:4px 0;color:#374151;">👽 Aggressive Profiles: <strong>${p.action_aggressive}</strong></td></tr>` : ''}
      ${p.entry_price != null ? `<tr><td style="padding:4px 0;color:#374151;">💱 Entry Price: <strong>${formatPrice(p.entry_price, p.market)}</strong></td></tr>` : ''}
      ${p.yield_percent != null ? `<tr><td style="padding:4px 0;color:#374151;">🚀 Current Yield: <strong style="color:${p.yield_percent >= 0 ? '#10b981' : '#ef4444'}">${formatPct(p.yield_percent)}</strong></td></tr>` : ''}
      ${p.three_months_goal != null ? `<tr><td style="padding:4px 0;color:#374151;">🎯 3-Month Goal: <strong>${p.three_months_goal.toFixed(1)}%</strong></td></tr>` : ''}
      ${p.elapsed_days != null ? `<tr><td style="padding:4px 0;color:#374151;">⏰ Elapsed time: <strong>${formatElapsed(p.elapsed_days)}</strong></td></tr>` : ''}
    `;
  } else {
    rows = `
      <tr><td style="padding:8px 0;font-size:18px;font-weight:700;color:#111827;">🚨 Closing Alert: ${p.ticker}${name}</td></tr>
      ${p.entry_price != null ? `<tr><td style="padding:4px 0;color:#374151;">💱 Entry Price: <strong>${formatPrice(p.entry_price, p.market)}</strong></td></tr>` : ''}
      ${p.closing_price != null ? `<tr><td style="padding:4px 0;color:#374151;">💱 Closing Price: <strong>${formatPrice(p.closing_price, p.market)}</strong></td></tr>` : ''}
      ${p.yield_percent != null ? `<tr><td style="padding:4px 0;color:#374151;">🚀 Yield: <strong style="color:${p.yield_percent >= 0 ? '#10b981' : '#ef4444'}">${formatPct(p.yield_percent)}</strong></td></tr>` : ''}
    `;
  }

  const eventLabel =
    p.event === 'created' ? 'created' : p.event === 'updated' ? 'updated' : 'closed';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6;color:#374151;background:#fff;margin:0;padding:0;">
      <div style="max-width:600px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);padding:32px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:26px;">RDS Inversiones</h1>
          <p style="margin:8px 0 0;color:#bfdbfe;font-size:14px;">Stock Market Intelligence</p>
        </div>
        <div style="background:#fff;padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
          <p style="margin:0 0 24px;color:#6b7280;font-size:16px;">
            Dear user, a new Alert was ${eventLabel} for <strong>${p.ticker}</strong>. Following you can find the Alert details:
          </p>
          <table style="width:100%;border-collapse:collapse;">
            ${rows}
          </table>
          <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              This is an automated email from RDS Inversiones.<br>
              You can disable email notifications in the app's Profile settings.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
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

    const payload: AlertPayload = await req.json();
    const { event, ticker, target_accounts } = payload;

    if (!event || !ticker || !target_accounts) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: event, ticker, target_accounts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log(`Processing ${event} notification for ${ticker} → ${target_accounts}`);

    // ── Step 1: Resolve eligible user profiles ─────────────────────────────────
    let eligibleEmails: string[] = [];

    if (target_accounts === 'Subscribers') {
      const { data: allowedData, error: allowedError } = await supabaseAdmin
        .from('allowed_emails')
        .select('email')
        .in('account_type', ['Affiliate', 'Admin', 'Dev']);

      if (allowedError) throw new Error(`allowed_emails query failed: ${allowedError.message}`);
      if (!allowedData || allowedData.length === 0) {
        return new Response(
          JSON.stringify({ message: 'No subscriber emails found', emailSent: 0, pushSent: 0 }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const subscriberEmails = allowedData.map((r: any) => r.email);
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('user_profiles')
        .select('email')
        .in('email', subscriberEmails)
        .eq('email_notifications_enabled', true);

      if (profilesError) throw new Error(`user_profiles query failed: ${profilesError.message}`);
      eligibleEmails = (profiles ?? []).map((p: any) => p.email);

    } else {
      // Free-Accounts
      const { data: allowedData } = await supabaseAdmin
        .from('allowed_emails')
        .select('email')
        .in('account_type', ['Affiliate', 'Admin', 'Dev']);

      const subscriberEmails = (allowedData ?? []).map((r: any) => r.email);

      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('user_profiles')
        .select('email')
        .not('email', 'in', `(${subscriberEmails.map((e: string) => `"${e}"`).join(',')})`)
        .eq('email_notifications_enabled', true);

      if (profilesError) throw new Error(`user_profiles query (free) failed: ${profilesError.message}`);
      eligibleEmails = (profiles ?? []).map((p: any) => p.email);
    }

    if (eligibleEmails.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No recipients to notify', emailSent: 0, pushSent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ── Step 2: Resolve eligible user IDs for push token lookup ───────────────
    const { data: profilesById, error: profilesByIdError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email')
      .in('email', eligibleEmails);

    if (profilesByIdError) {
      console.error('Failed to fetch user ids:', profilesByIdError.message);
    }

    const userIds = (profilesById ?? []).map((p: any) => p.id);

    // ── Step 3: Fetch push tokens — filter by watchlist for updated/closed ──────
    let pushTokens: string[] = [];
    if (userIds.length > 0) {
      if (payload.event === 'updated' || payload.event === 'closed') {
        // Only send to users who have this alert in their watchlist
        if (payload.alert_id) {
          const { data: watchlistRows, error: watchlistError } = await supabaseAdmin
            .from('watchlist')
            .select('user_id')
            .eq('alert_id', payload.alert_id)
            .in('user_id', userIds);

          if (watchlistError) {
            console.error('Failed to fetch watchlist users:', watchlistError.message);
          } else {
            const watchlistUserIds = (watchlistRows ?? []).map((r: any) => r.user_id);
            if (watchlistUserIds.length > 0) {
              const { data: tokenRows, error: tokenError } = await supabaseAdmin
                .from('push_tokens')
                .select('token')
                .in('user_id', watchlistUserIds);

              if (tokenError) {
                console.error('Failed to fetch push tokens (watchlist):', tokenError.message);
              } else {
                pushTokens = (tokenRows ?? []).map((r: any) => r.token).filter(Boolean);
              }
            }
          }
        }
      } else {
        // 'created' event: send to ALL eligible users
        const { data: tokenRows, error: tokenError } = await supabaseAdmin
          .from('push_tokens')
          .select('token')
          .in('user_id', userIds);

        if (tokenError) {
          console.error('Failed to fetch push tokens:', tokenError.message);
        } else {
          pushTokens = (tokenRows ?? []).map((r: any) => r.token).filter(Boolean);
        }
      }
    }

    // ── Step 4: Send remote push notifications (HIGH priority) ─────────────────
    const pushTitle = buildPushTitle(event, ticker);
    const pushBody = buildPushBody(payload);
    const pushData = { screen: '/(tabs)', ticker, event };

    const pushResult = await sendExpoPushNotifications(pushTokens, pushTitle, pushBody, pushData);
    console.log(`Push sent: ${pushResult.sent}, errors: ${pushResult.errors.length}`);
    if (pushResult.errors.length > 0) {
      console.error('Push errors:', pushResult.errors.slice(0, 5).join(' | '));
    }

    // ── Step 5: Send emails ────────────────────────────────────────────────────
    const subject = buildSubject(event, ticker);
    const html = buildHtmlBody(payload);

    let emailSent = 0;
    const emailErrors: string[] = [];

    for (const email of eligibleEmails) {
      try {
        const { error: emailError } = await supabaseAdmin.auth.admin.sendRawEmail({
          to: email,
          subject,
          html,
        });
        if (emailError) {
          console.error(`Failed to send email to ${email}:`, emailError.message);
          emailErrors.push(`${email}: ${emailError.message}`);
        } else {
          emailSent++;
        }
      } catch (err: any) {
        console.error(`Error sending email to ${email}:`, err.message);
        emailErrors.push(`${email}: ${err.message}`);
      }
    }

    console.log(`Email dispatch complete: sent=${emailSent}, errors=${emailErrors.length}`);

    return new Response(
      JSON.stringify({
        message: 'Notification dispatch complete',
        emailSent,
        pushSent: pushResult.sent,
        emailErrors: emailErrors.slice(0, 10),
        pushErrors: pushResult.errors.slice(0, 10),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('send-alert-email error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
