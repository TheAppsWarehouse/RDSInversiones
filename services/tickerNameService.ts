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

  async upsertTickerName(ticker: string, name: string): Promise<{ error: string | null }> {
    const tickerUpper = ticker.toUpperCase();
    const { error } = await supabase
      .from('ticker_names')
      .upsert({ ticker: tickerUpper, name, updated_at: new Date().toISOString() }, { onConflict: 'ticker' });
    return { error: error ? error.message : null };
  },

  async deleteTickerName(id: string): Promise<{ error: string | null }> {
    const { error } = await supabase.from('ticker_names').delete().eq('id', id);
    return { error: error ? error.message : null };
  },

  async batchImportTickerNames(
    namesData: Array<{ ticker: string; name: string }>
  ): Promise<{ successCount: number; failedCount: number; errors: string[] }> {
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const row of namesData) {
      const tickerUpper = row.ticker.toUpperCase().trim();
      const name = row.name.trim();
      if (!tickerUpper || !name) { failedCount++; errors.push(`${row.ticker}: Ticker and Name required`); continue; }
      const { error } = await supabase
        .from('ticker_names')
        .upsert({ ticker: tickerUpper, name, updated_at: new Date().toISOString() }, { onConflict: 'ticker' });
      if (error) { failedCount++; errors.push(`${tickerUpper}: ${error.message}`); } else { successCount++; }
    }

    return { successCount, failedCount, errors };
  },
};
