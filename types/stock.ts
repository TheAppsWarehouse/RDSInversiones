export type AlertCondition = 'Current' | 'Closed';
export type AlertAction = 'Buy' | 'Sell';
export type ProfileAction = 'Buy' | 'Sell' | 'Refrain' | 'Double' | 'Hold' | 'Close' | 'Keep Out';
export type TargetAccounts = 'Subscribers' | 'Free-Accounts';
export type AlertMarket = 'EEUU' | 'ARG';

// Ticker name mapping
export interface TickerName {
  id: string;
  ticker: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// ─── Alert System ──────────────────────────────────────────────────────────────

export interface Alert {
  id: string;
  ticker: string;
  market: AlertMarket;
  target_accounts: TargetAccounts;
  alert_condition: AlertCondition;
  opening_date: string;
  closing_date: string | null;
  action: AlertAction | null;
  entry_price: number | null;
  re_entry_price: number | null;
  current_price: number | null;
  closing_price: number | null;
  three_months_goal: number | null;
  action_conservative: ProfileAction;
  action_moderate: ProfileAction;
  action_aggressive: ProfileAction;
  created_at: string;
  updated_at: string;
  // Computed
  ticker_name?: string;
}

export interface CreateAlertPayload {
  ticker: string;
  market: AlertMarket;
  target_accounts: TargetAccounts;
  action: AlertAction | null;
  entry_price: number | null;
  re_entry_price: number | null;
  three_months_goal: number | null;
  action_conservative: ProfileAction;
  action_moderate: ProfileAction;
  action_aggressive?: ProfileAction;
}

export interface UpdateAlertPayload {
  current_price?: number | null;
  three_months_goal?: number | null;
  action_conservative?: ProfileAction;
  action_moderate?: ProfileAction;
  action_aggressive?: ProfileAction;
}

export interface CloseAlertPayload {
  closing_price: number | null;
}
