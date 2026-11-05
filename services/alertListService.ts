import type { Alert } from '@/types/stock';
import { calculateYield, getAlertMarkets } from '@/services/alertService';

export type AlertSortType =
  | 'newestFirst' | 'oldestFirst' | 'alphabetAZ' | 'alphabetZA'
  | 'currentFirst' | 'closedFirst' | 'newestClose' | 'oldestClose'
  | 'yieldHigh' | 'yieldLow';

export interface AlertListOptions {
  alerts: Alert[];
  sortType: AlertSortType;
  search?: string;
  marketFilter?: 'ALL' | 'ARG' | 'EEUU';
}

function dateValue(value: string | null): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/** One filtering pass; financial/date keys are calculated once per row, not per comparison. */
export function sortAlertList({
  alerts, sortType, search = '', marketFilter = 'ALL',
}: AlertListOptions): Alert[] {
  const query = search.trim().toLowerCase();
  const filtered = alerts.filter((alert) => {
    if (query && !alert.ticker.toLowerCase().includes(query)
      && !(alert.ticker_name ?? '').toLowerCase().includes(query)) return false;
    if (marketFilter === 'ALL') return true;
    const { hasARS, hasUSD } = getAlertMarkets(alert);
    return marketFilter === 'ARG' ? hasARS : hasUSD;
  });

  if (sortType === 'alphabetAZ' || sortType === 'alphabetZA') {
    const direction = sortType === 'alphabetAZ' ? 1 : -1;
    return filtered.sort((a, b) => direction * a.ticker.localeCompare(b.ticker));
  }

  const rows = filtered.map((alert) => {
    let key: number;
    switch (sortType) {
      case 'newestFirst': case 'oldestFirst': key = dateValue(alert.opening_date); break;
      case 'newestClose': case 'oldestClose': key = dateValue(alert.closing_date); break;
      case 'yieldHigh': key = calculateYield(alert) ?? -Infinity; break;
      case 'yieldLow': key = calculateYield(alert) ?? Infinity; break;
      case 'currentFirst': key = alert.alert_condition === 'Current' ? 0 : 1; break;
      case 'closedFirst': key = alert.alert_condition === 'Closed' ? 0 : 1; break;
      default: key = 0;
    }
    return { alert, key };
  });
  const descending = sortType === 'newestFirst' || sortType === 'newestClose' || sortType === 'yieldHigh';
  rows.sort((a, b) => {
    if (a.key === b.key) return 0;
    const order = a.key < b.key ? -1 : 1;
    return descending ? -order : order;
  });
  return rows.map(({ alert }) => alert);
}
