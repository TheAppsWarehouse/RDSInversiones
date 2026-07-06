import { getSupabaseClient } from '@/template';
import { Alert, CreateAlertPayload, UpdateAlertPayload, CloseAlertPayload } from '@/types/stock';
import {
  dispatchAlertCreated,
  dispatchAlertUpdated,
  dispatchAlertClosed,
} from '@/services/notificationService';

const supabase = getSupabaseClient();

// Fetch ticker names map for enrichment
async function fetchTickerNamesMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('ticker_names').select('ticker, name');
  if (error || !data) return new Map();
  return new Map(data.map((row: { ticker: string; name: string }) => [row.ticker.toUpperCase(), row.name]));
}

function enrichAlertsWithNames(alerts: Alert[], namesMap: Map<string, string>): Alert[] {
  return alerts.map((a) => ({
    ...a,
    ticker_name: namesMap.get(a.ticker.toUpperCase()) ?? undefined,
  }));
}

export const alertService = {
  // ─── Read ────────────────────────────────────────────────────────────────────

  async getAllAlerts(): Promise<{ data: Alert[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('alerts')
      .select('*')
      .order('opening_date', { ascending: false });

    if (error) return { data: null, error: error.message };
    const namesMap = await fetchTickerNamesMap();
    return { data: enrichAlertsWithNames(data ?? [], namesMap), error: null };
  },

  // For regular users: filter by target_accounts visibility
  async getVisibleAlerts(isSubscriber: boolean): Promise<{ data: Alert[] | null; error: string | null }> {
    let query = supabase
      .from('alerts')
      .select('*')
      .order('opening_date', { ascending: false });

    if (!isSubscriber) {
      query = query.eq('target_accounts', 'Free-Accounts');
    }

    const { data, error } = await query;
    if (error) return { data: null, error: error.message };
    const namesMap = await fetchTickerNamesMap();
    return { data: enrichAlertsWithNames(data ?? [], namesMap), error: null };
  },

  // ─── Create ──────────────────────────────────────────────────────────────────

  async createAlert(
    payload: CreateAlertPayload,
    isSubscriber: boolean = true,
    pushEnabled: boolean = true
  ): Promise<{ data: Alert | null; error: string | null }> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('alerts')
      .insert({
        ticker: payload.ticker.toUpperCase().trim(),
        market: payload.market,
        target_accounts: payload.target_accounts,
        alert_condition: 'Current',
        opening_date: now,
        action: payload.action,
        entry_price: payload.entry_price,
        re_entry_price: payload.re_entry_price,
        current_price: null,
        three_months_goal: payload.three_months_goal,
        action_conservative: payload.action_conservative,
        action_moderate: payload.action_moderate,
        action_aggressive: payload.action_aggressive,
        created_at: now,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    const namesMap = await fetchTickerNamesMap();
    const enriched = enrichAlertsWithNames([data], namesMap)[0];

    // Dispatch push + email notifications
    dispatchAlertCreated(enriched, isSubscriber, pushEnabled).catch(() => {});

    return { data: enriched, error: null };
  },

  // ─── Update ──────────────────────────────────────────────────────────────────

  async updateAlert(
    alertId: string,
    payload: UpdateAlertPayload,
    alert: Alert,
    isSubscriber: boolean = true,
    pushEnabled: boolean = true
  ): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('alerts')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', alertId);

    if (!error) {
      // Merge updated fields into alert for notification payload
      const updatedAlert: Alert = { ...alert, ...payload } as Alert;
      dispatchAlertUpdated(updatedAlert, isSubscriber, pushEnabled).catch(() => {});
    }

    return { error: error ? error.message : null };
  },

  // ─── Close ───────────────────────────────────────────────────────────────────

  async closeAlert(
    alertId: string,
    payload: CloseAlertPayload,
    alert: Alert,
    isSubscriber: boolean = true,
    pushEnabled: boolean = true
  ): Promise<{ error: string | null }> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('alerts')
      .update({
        alert_condition: 'Closed',
        closing_date: now,
        closing_price: payload.closing_price,
        updated_at: now,
      })
      .eq('id', alertId);

    if (!error) {
      const closedAlert: Alert = {
        ...alert,
        alert_condition: 'Closed',
        closing_date: now,
        closing_price: payload.closing_price,
      };
      dispatchAlertClosed(closedAlert, isSubscriber, pushEnabled).catch(() => {});
    }

    return { error: error ? error.message : null };
  },

  // ─── Delete ──────────────────────────────────────────────────────────────────

  async deleteAlert(alertId: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('alerts').delete().eq('id', alertId);
    return { error: error ? error.message : null };
  },

  // ─── Batch Import ─────────────────────────────────────────────────────────────

  async batchImportAlerts(
    rows: CreateAlertPayload[]
  ): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (const row of rows) {
      const { error } = await supabase.from('alerts').insert({
        ticker: row.ticker.toUpperCase().trim(),
        market: row.market,
        target_accounts: row.target_accounts,
        alert_condition: 'Current',
        opening_date: now,
        action: row.action,
        entry_price: row.entry_price,
        re_entry_price: row.re_entry_price,
        current_price: null,
        three_months_goal: row.three_months_goal,
        action_conservative: row.action_conservative,
        action_moderate: row.action_moderate,
        action_aggressive: row.action_aggressive,
        created_at: now,
      });

      if (error) {
        failedCount++;
        errors.push(`${row.ticker}: ${error.message}`);
      } else {
        successCount++;
      }
    }

    return { successCount, failedCount, errors };
  },
};

// ─── Calculation Helpers ───────────────────────────────────────────────────────

export function calculateYield(alert: Alert): number | null {
  const { action, alert_condition, entry_price, current_price, closing_price } = alert;
  if (!action || entry_price == null || entry_price === 0) return null;

  const priceToUse = alert_condition === 'Closed' ? closing_price : current_price;
  if (priceToUse == null) return null;

  if (action === 'Buy') {
    return ((priceToUse - entry_price) / entry_price) * 100;
  } else {
    return ((entry_price - priceToUse) / entry_price) * 100;
  }
}

export function calculateElapsedDays(alert: Alert): number {
  const start = new Date(alert.opening_date).getTime();
  const end = alert.alert_condition === 'Closed' && alert.closing_date
    ? new Date(alert.closing_date).getTime()
    : Date.now();
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}

export function formatElapsed(days: number): string {
  if (days < 1) return '< 1 day';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  const months = Math.floor(days / 30);
  const rem = days % 30;
  if (rem === 0) return `${months} mo.`;
  return `${months} mo. ${rem} d.`;
}

// ─── Currency Helper ──────────────────────────────────────────────────────────

export function formatPrice(val: number | null, market: 'EEUU' | 'ARG' = 'EEUU'): string {
  if (val == null) return '-';
  const symbol = market === 'ARG' ? 'AR$' : 'US$';
  return `${symbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
