import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { useAuth, useAlert } from '@/template';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { alertService } from '@/services/alertService';
import { Alert } from '@/types/stock';
import { useLanguage } from '@/hooks/useLanguage';
import { useAccountType } from '@/hooks/useAccountType';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { AlertCard } from '@/components/feature/AlertCard';
import { useSortedAlerts } from '@/hooks/useSortedAlerts';
import { alertListRendering } from '@/constants/performance';

type SortType = 'newestFirst' | 'oldestFirst' | 'alphabetAZ' | 'alphabetZA' | 'currentFirst' | 'closedFirst';

export default function AlertsScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { t, language, marketFilter } = useLanguage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { accountType } = useAccountType();
  const { isInWatchlist, addToWatchlist, removeFromWatchlist, loadWatchlist } = useWatchlist();

  const isSubscriber = accountType === 'Affiliate' || accountType === 'Admin' || accountType === 'Dev';
  const canWatchlist = accountType === 'Free' || accountType === 'Affiliate';

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortType, setSortType] = useState<SortType>('newestFirst');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [search, setSearch] = useState('');
  const [togglingWatchlist, setTogglingWatchlist] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data, error } = await alertService.getVisibleAlerts(isSubscriber);
    if (error) {
      showAlert(t('error'), error);
    } else if (data) {
      const todayStr = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
      const filtered = data.filter((a) => {
        if (a.alert_condition !== 'Closed') return true;
        if (!a.closing_date) return true;
        // Keep closed alert only if its closing date is today or in the future
        const closingDateStr = new Date(a.closing_date).toISOString().slice(0, 10);
        return closingDateStr >= todayStr;
      });
      setAlerts(filtered);
    }
    setLoading(false);
    setRefreshing(false);
  }, [isSubscriber]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      if (canWatchlist) loadWatchlist();
    }, [loadData, canWatchlist])
  );

  const displayAlerts = useSortedAlerts({ alerts, sortType, search, marketFilter });

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleWatchlistToggle = useCallback(async (alertId: string) => {
    setTogglingWatchlist(alertId);
    if (isInWatchlist(alertId)) {
      await removeFromWatchlist(alertId);
    } else {
      await addToWatchlist(alertId);
    }
    setTogglingWatchlist(null);
  }, [isInWatchlist, removeFromWatchlist, addToWatchlist]);

  const sortOptions: { key: SortType; label: string }[] = [
    { key: 'newestFirst', label: t('newestFirst') },
    { key: 'oldestFirst', label: t('oldestFirst') },
    { key: 'alphabetAZ', label: t('alphabeticalAZ') },
    { key: 'alphabetZA', label: t('alphabeticalZA') },
    { key: 'currentFirst', label: t('currentFirst') },
    { key: 'closedFirst', label: t('closedFirst') },
  ];

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('myAlerts')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {language === 'es' ? 'Alertas vigentes' : 'Current alerts'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowSortMenu(!showSortMenu)}
          style={styles.headerActionButton}
        >
          <MaterialIcons name="sort" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <MaterialIcons name="search" size={20} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder={language === 'es' ? 'Buscar ticker o nombre...' : 'Search ticker or name...'}
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort menu */}
      {showSortMenu && (
        <View style={[styles.sortMenu, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {sortOptions.map(({ key, label }) => (
            <TouchableOpacity key={key} style={styles.sortOption} onPress={() => { setSortType(key); setShowSortMenu(false); }}>
              <Text style={[styles.sortOptionText, { color: colors.text }]}>{label}</Text>
              {sortType === key && <MaterialIcons name="check" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {displayAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="notifications-none" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {search.trim() ? (language === 'es' ? 'Sin resultados' : 'No results') : t('noAlerts')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {search.trim()
              ? (language === 'es' ? 'Intenta con otro término.' : 'Try a different search term.')
              : t('noAlertsSubtitle')}
          </Text>
        </View>
      ) : (
        <FlatList
          {...alertListRendering}
          data={displayAlerts}
          renderItem={({ item }) => (
            <AlertCard
              item={item}
              canWatchlist={canWatchlist}
              isInWatchlist={isInWatchlist(item.id)}
              isTogglingWatchlist={togglingWatchlist === item.id}
              onWatchlistToggle={handleWatchlistToggle}
              marketFilter={marketFilter}
            />
          )}
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
  headerSubtitle: { ...typography.bodySmall, marginTop: spacing.xs },
  headerActionButton: { padding: spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  searchInput: { ...typography.body, flex: 1, paddingVertical: 6 },
  sortMenu: { borderBottomWidth: 1, paddingVertical: spacing.xs },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  sortOptionText: { ...typography.body },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyTitle: { ...typography.h3, marginTop: spacing.lg },
  emptySubtitle: { ...typography.body, marginTop: spacing.sm, textAlign: 'center' },
});
