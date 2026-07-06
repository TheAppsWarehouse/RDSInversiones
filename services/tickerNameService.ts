import { getSupabaseClient } from '@/template';
import { TickerName } from '@/types/stock';

const supabase = getSupabaseClient();

export const tickerNameService = {
  async getAllTickerNames(): Promise<{ data: TickerName[] | null; error: string | null }> {
    const { data, error } = await supabase
      .from('ticker_names')
      .select('*')
      .order('ticker', { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  },

  async upsertTickerName(
    ticker: string,
    name: string,
    balanz_url_arg?: string | null,
    balanz_url_usa?: string | null
  ): Promise<{ error: string | null }> {
    const tickerUpper = ticker.toUpperCase();
    const payload: any = { ticker: tickerUpper, name, updated_at: new Date().toISOString() };
    if (balanz_url_arg !== undefined) payload.balanz_url_arg = balanz_url_arg || null;
    if (balanz_url_usa !== undefined) payload.balanz_url_usa = balanz_url_usa || null;
    const { error } = await supabase
      .from('ticker_names')
      .upsert(payload, { onConflict: 'ticker' });
    return { error: error ? error.message : null };
  },

  async deleteTickerName(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('ticker_names').delete().eq('id', id);
    return { error: error ? error.message : null };
  },

  async batchImportTickerNames(
    namesData: Array<{ ticker: string; name: string; balanz_url_arg?: string | null; balanz_url_usa?: string | null }>
  ): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const row of namesData) {
      const tickerUpper = row.ticker.toUpperCase().trim();
      const name = row.name.trim();
      if (!tickerUpper || !name) { failedCount++; errors.push(`${row.ticker}: Ticker and Name required`); continue; }
      const payload: any = { ticker: tickerUpper, name, updated_at: new Date().toISOString() };
      if (row.balanz_url_arg !== undefined) payload.balanz_url_arg = row.balanz_url_arg || null;
      if (row.balanz_url_usa !== undefined) payload.balanz_url_usa = row.balanz_url_usa || null;
      const { error } = await supabase
        .from('ticker_names')
        .upsert(payload, { onConflict: 'ticker' });
      if (error) { failedCount++; errors.push(`${tickerUpper}: ${error.message}`); } else { successCount++; }
    }

    return { successCount, failedCount, errors };
  },
};
