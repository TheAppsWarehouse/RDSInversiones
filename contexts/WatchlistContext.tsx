import React, { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/template';
import { watchlistService } from '@/services/watchlistService';

interface WatchlistContextType {
  watchlistAlertIds: Set<string>;
  loading: boolean;
  loadWatchlist: () => Promise<void>;
  addToWatchlist: (alertId: string) => Promise<void>;
  removeFromWatchlist: (alertId: string) => Promise<void>;
  isInWatchlist: (alertId: string) => boolean;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(undefined);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [watchlistAlertIds, setWatchlistAlertIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadWatchlist = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await watchlistService.getUserWatchlistAlertIds(user.id);
    if (data) setWatchlistAlertIds(new Set(data));
    setLoading(false);
  }, [user?.id]);

  const addToWatchlist = useCallback(async (alertId: string) => {
    if (!user?.id) return;
    const { error } = await watchlistService.addToWatchlist(user.id, alertId);
    if (!error) {
      setWatchlistAlertIds((prev) => new Set([...prev, alertId]));
    }
  }, [user?.id]);

  const removeFromWatchlist = useCallback(async (alertId: string) => {
    if (!user?.id) return;
    const { error } = await watchlistService.removeFromWatchlistByAlertId(user.id, alertId);
    if (!error) {
      setWatchlistAlertIds((prev) => {
        const next = new Set(prev);
        next.delete(alertId);
        return next;
      });
    }
  }, [user?.id]);

  const isInWatchlist = useCallback((alertId: string) => {
    return watchlistAlertIds.has(alertId);
  }, [watchlistAlertIds]);

  return (
    <WatchlistContext.Provider value={{ watchlistAlertIds, loading, loadWatchlist, addToWatchlist, removeFromWatchlist, isInWatchlist }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider');
  return ctx;
}
