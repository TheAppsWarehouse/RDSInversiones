import { AlertProvider, AuthProvider, useAuth } from '@/template';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AccountTypeProvider } from '@/contexts/AccountTypeContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { WatchlistProvider } from '@/contexts/WatchlistContext';
import { Stack, router } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

// Inner component so useAuth() can be called after AuthProvider mounts
function AppWithAccountType({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    let cleanup: (() => void) | undefined;

    const setupNotifications = async () => {
      try {
        const Notifications = await import('expo-notifications');

        // Request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }

        // Setup notification channel for Android (required for Android 8+)
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('alerts', {
            name: 'Stock Alerts',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#10b981',
            enableVibrate: true,
            showBadge: true,
          });
        }

        notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
        responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {
          router.replace('/(tabs)');
        });

        cleanup = () => {
          try {
            if (notificationListener.current) {
              Notifications.removeNotificationSubscription(notificationListener.current);
            }
            if (responseListener.current) {
              Notifications.removeNotificationSubscription(responseListener.current);
            }
          } catch {}
        };
      } catch {
        // Notifications not available in this environment
      }
    };

    setupNotifications();

    return () => { cleanup?.(); };
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
          <AuthProvider>
            <LanguageProvider>
              <AppWithAccountType>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="login" options={{ headerShown: false }} />
                  <Stack.Screen name="language-selection" options={{ headerShown: false }} />
                  <Stack.Screen name="terms-and-conditions" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                </Stack>
              </AppWithAccountType>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </AlertProvider>
  );
}
