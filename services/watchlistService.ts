import { getSupabaseClient } from '@/template';
import { Alert } from '@/types/stock';

const supabase = getSupabaseClient();

export interface WatchlistItem {
  id: string;
  user_id: string;
  alert_id: string;
  added_at: string;
  alert?: Alert;
}

export const watchlistService = {
  /**
   * Get all watchlist entries for a user, with alert data joined.
   */
  async getUserWatchlist(userId: string): Promise<{ data: WatchlistItem[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('watchlist')
      .select(`
        id,
        user_id,
        alert_id,
        added_at,
        alerts (
          id,
          ticker,
          market,
          target_accounts,
          alert_condition,
          opening_date,
          closing_date,
          action,
          entry_price,
          re_entry_price,
          current_price,
          closing_price,
          three_months_goal,
          action_conservative,
          action_moderate,
          action_aggressive,
          created_at,
          updated_at
        )
      `)
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) return { data: null, error: error.message };

    // Flatten the nested alerts join + enrich with ticker names
    const tickerNamesMap = await fetchTickerNamesMap();
    const items: WatchlistItem[] = (data ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      alert_id: row.alert_id,
      added_at: row.added_at,
      alert: row.alerts
        ? {
            ...row.alerts,
            ticker_name: tickerNamesMap.get(row.alerts.ticker?.toUpperCase()) ?? undefined,
          }
        : undefined,
    }));

    return { data: items, error: null };
  },

  /**
   * Get just the alert_ids in the user's watchlist — used for fast membership checks.
   */
  async getUserWatchlistAlertIds(userId: string): Promise<{ data: string[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('watchlist')
      .select('alert_id')
      .eq('user_id', userId);

    if (error) return { data: null, error: error.message };
    return { data: (data ?? []).map((r: any) => r.alert_id), error: null };
  },

  /**
   * Add an alert to the user's watchlist.
   */
  async addToWatchlist(userId: string, alertId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('watchlist')
      .insert({ user_id: userId, alert_id: alertId });

    if (error) {
      // Unique constraint violation = already in watchlist, treat as success
      if (error.code === '23505') return { error: null };
      return { error: error.message };
    }
    return { error: null };
  },

  /**
   * Remove an alert from the user's watchlist by watchlist row id.
   */
  async removeFromWatchlistById(watchlistId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('id', watchlistId);

    return { error: error ? error.message : null };
  },

  /**
   * Remove an alert from the user's watchlist by alert_id.
   */
  async removeFromWatchlistByAlertId(userId: string, alertId: string): Promise<{ error: string | null }> {
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('alert_id', alertId);

    return { error: error ? error.message : null };
  },
};

async function fetchTickerNamesMap(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('ticker_names').select('ticker, name');
  if (error || !data) return new Map();
  return new Map(data.map((row: { ticker: string; name: string }) => [row.ticker.toUpperCase(), row.name]));
}
