import { AlertProvider, AuthProvider, useAuth } from '@/template';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AccountTypeProvider } from '@/contexts/AccountTypeContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { WatchlistProvider } from '@/contexts/WatchlistContext';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { requestNotificationPermissions } from '@/services/notificationService';

// Inner component so useAuth() can be called after AuthProvider mounts
function AppWithAccountType({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // Request notification permissions on mount
    requestNotificationPermissions().catch(() => {});

    // Listen for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Notification received — no action needed, handler config handles display
    });

    // Handle notification tap — navigate to Alerts tab
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.screen) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(tabs)');
      }
    });

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return (
    <AccountTypeProvider userEmail={user?.email ?? null}>
      <WatchlistProvider>
        {children}
      </WatchlistProvider>
    </AccountTypeProvider>
  );
}

export default function RootLayout() {
  return (
    <AlertProvider>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <AppWithAccountType>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="login" options={{ headerShown: false }} />
                  <Stack.Screen name="language-selection" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                </Stack>
              </AppWithAccountType>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
