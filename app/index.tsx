import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';

export default function RootScreen() {
  const { user, loading } = useAuth();
  const { termsUpToDate, isFirstLaunch, refreshTermsStatus } = useLanguage();
  // Track whether we've already run the DB sync for this session
  const syncedRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (user) {
      // Sync DB acceptance status once per session before routing
      if (!syncedRef.current) {
        syncedRef.current = true;
        refreshTermsStatus(user.id).then(() => {
          // After sync, termsUpToDate will update via state — let the next
          // effect invocation (triggered by termsUpToDate change) do the routing.
        });
        return;
      }

      // T&C check (uses up-to-date local state after DB sync)
      if (!termsUpToDate) {
        router.replace('/terms-and-conditions?mode=accept');
      } else {
        router.replace('/(tabs)');
      }
    } else {
      syncedRef.current = false;
      router.replace('/language-selection');
    }
  }, [loading, user, termsUpToDate, isFirstLaunch]);

  return null;
}
