export type AlertCondition = 'Current' | 'Closed';
export type AlertAction = 'Buy' | 'Sell';
export type ProfileAction = 'Buy' | 'Sell' | 'Refrain' | 'Double' | 'Hold' | 'Close' | 'Keep Out';
export type TargetAccounts = 'Subscribers' | 'Free-Accounts';
export type AlertMarket = 'EEUU' | 'ARG';
export type AlertTerm = 'Short' | 'Long';

// Ticker name mapping
export interface TickerName {
  id: string;
  ticker: string;
  name: string;
  balanz_url_arg: string | null;
  balanz_url_usa: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Alert System ──────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  ticker: string;
  market: AlertMarket; // kept for legacy compatibility
  target_accounts: TargetAccounts;
  alert_condition: AlertCondition;
  opening_date: string;
  closing_date: string | null;
  action: AlertAction | null; // legacy field
  // ARS prices
  entry_price_ars: number | null;
  re_entry_price_ars: number | null;
  current_price_ars: number | null;
  closing_price_ars: number | null;
  // USD prices
  entry_price_usd: number | null;
  re_entry_price_usd: number | null;
  current_price_usd: number | null;
  closing_price_usd: number | null;
  // Legacy price fields (kept for backward compat)
  entry_price: number | null;
  re_entry_price: number | null;
  current_price: number | null;
  closing_price: number | null;
  // Goals
  short_term_goal: number | null;
  long_term_goal: number | null;
  three_months_goal: number | null; // legacy
  // Profile actions
  action_conservative: ProfileAction;
  action_moderate: ProfileAction;
  action_aggressive: ProfileAction;
  action_ultra_aggressive: ProfileAction;
  // Term
  term: AlertTerm;
  // Extra info
  balanz_url: string | null;
  alert_details: string | null;
  alert_detail_en: string | null;
  created_at: string;
  updated_at: string;
  // Computed
  ticker_name?: string;
  balanz_url_arg?: string | null;
  balanz_url_usa?: string | null;
}

export interface CreateAlertPayload {
  ticker: string;
  term: AlertTerm;
  target_accounts: TargetAccounts;
  action_conservative: ProfileAction;
  action_moderate: ProfileAction;
  action_aggressive: ProfileAction;
  action_ultra_aggressive: ProfileAction;
  // ARS
  entry_price_ars: number | null;
  re_entry_price_ars: number | null;
  // USD
  entry_price_usd: number | null;
  re_entry_price_usd: number | null;
  // Goals
  short_term_goal: number | null;
  long_term_goal: number | null;
  // Extra
  balanz_url: string | null;
  alert_details: string | null;
  alert_detail_en: string | null;
}

export interface UpdateAlertPayload {
  current_price_ars?: number | null;
  current_price_usd?: number | null;
  short_term_goal?: number | null;
  long_term_goal?: number | null;
  action_conservative?: ProfileAction;
  action_moderate?: ProfileAction;
  action_aggressive?: ProfileAction;
  action_ultra_aggressive?: ProfileAction;
  balanz_url?: string | null;
  alert_details?: string | null;
  alert_detail_en?: string | null;
}

export interface CloseAlertPayload {
  closing_price_ars: number | null;
  closing_price_usd: number | null;
}
