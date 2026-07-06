import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/template';
import { useLanguage } from '@/hooks/useLanguage';
import { useAccountType } from '@/hooks/useAccountType';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { accountType } = useAccountType();
  const { colors } = useTheme();

  const userIsAdmin = accountType === 'Admin';
  const userIsDev = accountType === 'Dev';
  const canAccessConfig = userIsAdmin || userIsDev;
  const canAccessWatchlist = accountType === 'Free' || accountType === 'Affiliate';

  const { loadWatchlist } = useWatchlist();
  useFocusEffect(useCallback(() => { if (canAccessWatchlist) loadWatchlist(); }, [canAccessWatchlist]));

  const tabBarStyle = {
    height: Platform.select({
      ios: insets.bottom + 60,
      android: insets.bottom + 60,
      default: 70,
    }),
    paddingTop: 8,
    paddingBottom: Platform.select({
      ios: insets.bottom + 8,
      android: insets.bottom + 8,
      default: 8,
    }),
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('myAlerts'),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="visibility" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="performance"
        options={{
          title: language === 'es' ? 'Rend.' : 'Perf.',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="bar-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="configuration"
        options={{
          title: t('configuration'),
          href: canAccessConfig ? '/(tabs)/configuration' : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="settings" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{
          title: language === 'es' ? 'Seguimiento' : 'Watchlist',
          href: canAccessWatchlist ? '/(tabs)/watchlist' : null,
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="visibility" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="extras"
        options={{
          title: 'Extras',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="explore" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('profile'),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
