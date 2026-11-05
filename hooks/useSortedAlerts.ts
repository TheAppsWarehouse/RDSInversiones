import { useMemo } from 'react';
import { sortAlertList, type AlertListOptions } from '@/services/alertListService';

/** Derived data, not duplicate state: search/sort changes require no follow-up state update. */
export function useSortedAlerts({ alerts, sortType, search = '', marketFilter = 'ALL' }: AlertListOptions) {
  return useMemo(
    () => sortAlertList({ alerts, sortType, search, marketFilter }),
    [alerts, sortType, search, marketFilter],
  );
}
