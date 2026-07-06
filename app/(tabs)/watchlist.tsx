import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth, useAlert } from '@/template';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { watchlistService, WatchlistItem } from '@/services/watchlistService';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { useLanguage } from '@/hooks/useLanguage';
import { useAccountType } from '@/hooks/useAccountType';
import { AlertCard } from '@/components/feature/AlertCard';

export default function WatchlistScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { t, language, marketFilter } = useLanguage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { accountType } = useAccountType();
  const { removeFromWatchlist, loadWatchlist } = useWatchlist();

  const canAccess = accountType === 'Free' || accountType === 'Affiliate';

  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    const { data, error } = await watchlistService.getUserWatchlist(user.id);
    if (error) showAlert(t('error'), error);
    else if (data) setItems(data);
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRemove = async (item: WatchlistItem) => {
    setRemovingId(item.id);
    await removeFromWatchlist(item.alert_id);
    await loadData();
    setRemovingId(null);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  if (!canAccess) return null;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Watchlist</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {items.length > 0
              ? `${items.length} ${language === 'es' ? 'alerta(s) seguida(s)' : 'tracked alert(s)'}`
              : (language === 'es' ? 'Sin alertas guardadas' : 'No saved alerts')}
          </Text>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="bookmark-border" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {language === 'es' ? 'Tu watchlist está vacía' : 'Your watchlist is empty'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {language === 'es'
              ? 'Marca el checkbox en una alerta para agregarla aquí'
              : 'Tap the bookmark on an alert to add it here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={({ item }) => {
            if (!item.alert) return null;
            return (
              <AlertCard
                item={item.alert}
                showRemoveBtn={true}
                isRemoving={removingId === item.id}
                onRemove={() => handleRemove(item)}
                marketFilter={marketFilter}
              />
            );
          }}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerTitle: { ...typography.h2 },
  headerSubtitle: { ...typography.caption, marginTop: 2 },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyTitle: { ...typography.h3, marginTop: spacing.lg, textAlign: 'center' },
  emptySubtitle: { ...typography.body, marginTop: spacing.sm, textAlign: 'center' },
});
