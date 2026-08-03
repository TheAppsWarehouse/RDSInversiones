import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';

/**
 * Root entry point — decides where to send the user.
 *
 * Strategy:
 *  1. Wait for auth + AsyncStorage prefs to resolve.
 *  2. Hard cap at 4 s so the app never hangs forever, even if a
 *     provider or network call stalls. The LanguageContext already
 *     has its own 3 s AsyncStorage timeout, so 4 s is enough buffer.
 *  3. Use <Redirect> (declarative) instead of router.replace()
 *     (imperative) — no timing issues with the router not being ready,
 *     and no ref-based "already navigated" guards that can prevent
 *     retries when navigation fails silently.
 *  4. Do NOT block navigation on any DB call. T&C DB sync is done in
 *     the background after the user reaches the next screen.
 */
export default function RootScreen() {
  const { user, loading: authLoading } = useAuth();
  const { termsUpToDate, prefsLoading } = useLanguage();

  // Absolute fallback — render Redirect after 4 s no matter what
  const [forceNav, setForceNav] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceNav(true), 4000);
    return () => clearTimeout(t);
  }, []);

  const ready = forceNav || (!authLoading && !prefsLoading);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  // Not logged in → language selection (first-time) / login
  if (!user) return <Redirect href="/language-selection" />;

  // Logged in but T&C not accepted for current version → acceptance screen
  if (!termsUpToDate) return <Redirect href="/terms-and-conditions" />;

  // All good → main app
  return <Redirect href="/(tabs)" />;
}
