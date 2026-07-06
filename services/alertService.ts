import { getSupabaseClient } from '@/template';
import { Alert, CreateAlertPayload, UpdateAlertPayload, CloseAlertPayload } from '@/types/stock';
import {
  dispatchAlertCreated,
  dispatchAlertUpdated,
  dispatchAlertClosed,
} from '@/services/notificationService';

const supabase = getSupabaseClient();

// Fetch ticker names map for enrichment (includes Balanz URLs)
interface TickerNameRow { ticker: string; name: string; balanz_url_arg: string | null; balanz_url_usa: string | null; }
async function fetchTickerNamesMap(): Promise<Map<string, TickerNameRow>> {
  const { data, error } = await supabase.from('ticker_names').select('ticker, name, balanz_url_arg, balanz_url_usa');
  if (error || !data) return new Map();
  return new Map(data.map((row: TickerNameRow) => [row.ticker.toUpperCase(), row]));
}

function enrichAlertsWithNames(alerts: Alert[], namesMap: Map<string, TickerNameRow>): Alert[] {
  return alerts.map((a) => {
    const row = namesMap.get(a.ticker.toUpperCase());
    return {
      ...a,
      ticker_name: row?.name ?? undefined,
      balanz_url_arg: row?.balanz_url_arg ?? null,
      balanz_url_usa: row?.balanz_url_usa ?? null,
    };
  });
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

    // Determine legacy market field from which prices are set
    const hasARS = payload.entry_price_ars != null;
    const hasUSD = payload.entry_price_usd != null;
    let legacyMarket = 'EEUU';
    if (hasARS && !hasUSD) legacyMarket = 'ARG';

    const { data, error } = await supabase
      .from('alerts')
      .insert({
        ticker: payload.ticker.toUpperCase().trim(),
        market: legacyMarket,
        term: payload.term,
        target_accounts: payload.target_accounts,
        alert_condition: 'Current',
        opening_date: now,
        action: null,
        // ARS
        entry_price_ars: payload.entry_price_ars,
        re_entry_price_ars: payload.re_entry_price_ars,
        current_price_ars: null,
        closing_price_ars: null,
        // USD
        entry_price_usd: payload.entry_price_usd,
        re_entry_price_usd: payload.re_entry_price_usd,
        current_price_usd: null,
        closing_price_usd: null,
        // Legacy price fields (use USD if available, else ARS)
        entry_price: payload.entry_price_usd ?? payload.entry_price_ars,
        re_entry_price: payload.re_entry_price_usd ?? payload.re_entry_price_ars,
        current_price: null,
        closing_price: null,
        // Goals
        short_term_goal: payload.short_term_goal,
        long_term_goal: payload.long_term_goal,
        three_months_goal: payload.short_term_goal,
        // Profile actions
        action_conservative: payload.action_conservative,
        action_moderate: payload.action_moderate,
        action_aggressive: payload.action_aggressive,
        action_ultra_aggressive: payload.action_ultra_aggressive,
        // Extra
        balanz_url: payload.balanz_url,
        alert_details: payload.alert_details,
        alert_detail_en: payload.alert_detail_en,
        created_at: now,
      })
      .select()
      .single();

    if (error) return { data: null, error: error.message };

    const namesMap = await fetchTickerNamesMap();
    const enriched = enrichAlertsWithNames([data], namesMap)[0];

    // Dispatch push notifications
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
    // Also sync legacy current_price field
    const updatePayload: any = {
      ...payload,
      updated_at: new Date().toISOString(),
    };
    if (payload.current_price_usd !== undefined) {
      updatePayload.current_price = payload.current_price_usd;
    } else if (payload.current_price_ars !== undefined) {
      updatePayload.current_price = payload.current_price_ars;
    }
    if (payload.short_term_goal !== undefined) {
      updatePayload.three_months_goal = payload.short_term_goal;
    }

    const { error } = await supabase
      .from('alerts')
      .update(updatePayload)
      .eq('id', alertId);

    if (!error) {
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
        closing_price_ars: payload.closing_price_ars,
        closing_price_usd: payload.closing_price_usd,
        closing_price: payload.closing_price_usd ?? payload.closing_price_ars,
        updated_at: now,
      })
      .eq('id', alertId);

    if (!error) {
      const closedAlert: Alert = {
        ...alert,
        alert_condition: 'Closed',
        closing_date: now,
        closing_price_ars: payload.closing_price_ars,
        closing_price_usd: payload.closing_price_usd,
        closing_price: payload.closing_price_usd ?? payload.closing_price_ars,
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
      const hasARS = row.entry_price_ars != null;
      const hasUSD = row.entry_price_usd != null;
      let legacyMarket = 'EEUU';
      if (hasARS && !hasUSD) legacyMarket = 'ARG';

      const { error } = await supabase.from('alerts').insert({
        ticker: row.ticker.toUpperCase().trim(),
        market: legacyMarket,
        term: row.term ?? 'Short',
        target_accounts: row.target_accounts,
        alert_condition: 'Current',
        opening_date: now,
        action: null,
        entry_price_ars: row.entry_price_ars,
        re_entry_price_ars: row.re_entry_price_ars,
        entry_price_usd: row.entry_price_usd,
        re_entry_price_usd: row.re_entry_price_usd,
        entry_price: row.entry_price_usd ?? row.entry_price_ars,
        re_entry_price: row.re_entry_price_usd ?? row.re_entry_price_ars,
        short_term_goal: row.short_term_goal,
        long_term_goal: row.long_term_goal,
        three_months_goal: row.short_term_goal,
        action_conservative: row.action_conservative,
        action_moderate: row.action_moderate,
        action_aggressive: row.action_aggressive,
        action_ultra_aggressive: row.action_ultra_aggressive,
        balanz_url: row.balanz_url,
        alert_details: row.alert_details,
        alert_detail_en: row.alert_detail_en,
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

/**
 * Calculate yield for a given market (ARS or USD).
 * Uses action_conservative as proxy for direction if no legacy action field.
 */
export function calculateYieldForMarket(
  alert: Alert,
  market: 'ARS' | 'USD'
): number | null {
  const isClosed = alert.alert_condition === 'Closed';

  let entryPrice: number | null;
  let comparePrice: number | null;

  if (market === 'ARS') {
    entryPrice = alert.entry_price_ars;
    comparePrice = isClosed ? alert.closing_price_ars : alert.current_price_ars;
  } else {
    entryPrice = alert.entry_price_usd;
    comparePrice = isClosed ? alert.closing_price_usd : alert.current_price_usd;
  }

  if (entryPrice == null || entryPrice === 0 || comparePrice == null) return null;

  // Determine direction from conservative action or legacy action
  const action = alert.action ?? null;
  const conservativeAction = alert.action_conservative;
  const isBuy = action === 'Buy' || conservativeAction === 'Buy' || conservativeAction === 'Double' || conservativeAction === 'Hold';

  if (isBuy) {
    return ((comparePrice - entryPrice) / entryPrice) * 100;
  } else {
    return ((entryPrice - comparePrice) / entryPrice) * 100;
  }
}

// Legacy yield calculation (uses entry_price + current_price)
export function calculateYield(alert: Alert): number | null {
  // Try USD first, then ARS
  const usdYield = calculateYieldForMarket(alert, 'USD');
  if (usdYield != null) return usdYield;
  return calculateYieldForMarket(alert, 'ARS');
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

export function formatPriceARS(val: number | null): string {
  if (val == null) return '-';
  return `AR$ ${val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatPriceUSD(val: number | null): string {
  if (val == null) return '-';
  return `US$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPrice(val: number | null, market: 'EEUU' | 'ARG' = 'EEUU'): string {
  if (val == null) return '-';
  if (market === 'ARG') return formatPriceARS(val);
  return formatPriceUSD(val);
}

/**
 * Determine which markets an alert has data for.
 */
export function getAlertMarkets(alert: Alert): { hasARS: boolean; hasUSD: boolean } {
  const hasARS = alert.entry_price_ars != null;
  const hasUSD = alert.entry_price_usd != null;
  // Also check legacy fields for old alerts
  const hasLegacy = alert.entry_price != null;
  const legacyIsARG = (alert.market ?? 'EEUU') === 'ARG';

  return {
    hasARS: hasARS || (hasLegacy && legacyIsARG),
    hasUSD: hasUSD || (hasLegacy && !legacyIsARG),
  };
}
