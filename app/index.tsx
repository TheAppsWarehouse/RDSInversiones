import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';

export default function RootScreen() {
  const { user, loading } = useAuth();
  const { termsUpToDate, isFirstLaunch, refreshTermsStatus, prefsLoading } = useLanguage();
  // Track whether we've already run the DB sync for this session
  const syncedRef = useRef(false);

  useEffect(() => {
    // Wait for both auth state AND local preferences to finish loading
    if (loading || prefsLoading) return;

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
  }, [loading, prefsLoading, user, termsUpToDate, isFirstLaunch]);

  // Render a minimal loading indicator — never return null on Android
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#10b981" />
    </View>
  );
}
