import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth, useAlert } from '@/template';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { alertService, calculateYield } from '@/services/alertService';
import { Alert } from '@/types/stock';
import { useLanguage } from '@/hooks/useLanguage';
import { useAccountType } from '@/hooks/useAccountType';

type SortType = 'newestClose' | 'oldestClose' | 'alphabetAZ' | 'alphabetZA' | 'yieldHigh' | 'yieldLow';

export default function PerformanceScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { t, language } = useLanguage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { accountType } = useAccountType();

  const isSubscriber = accountType === 'Affiliate' || accountType === 'Admin' || accountType === 'Dev';

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [displayAlerts, setDisplayAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [sortType, setSortType] = useState<SortType>('newestClose');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const loadData = useCallback(async () => {
    const { data, error } = await alertService.getVisibleAlerts(isSubscriber);
    if (error) {
      showAlert(t('error'), error);
    } else if (data) {
      // Only closed alerts for performance section
      const closed = data.filter((a) => a.alert_condition === 'Closed');
      setAlerts(closed);
    }
    setLoading(false);
    setRefreshing(false);
  }, [isSubscriber]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  React.useEffect(() => {
    applySort(sortType);
  }, [alerts, sortType, search]);

  const applySort = (type: SortType) => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? alerts.filter(
          (a) =>
            a.ticker.toLowerCase().includes(q) ||
            (a.ticker_name ?? '').toLowerCase().includes(q)
        )
      : alerts;

    const sorted = [...filtered].sort((a, b) => {
      switch (type) {
        case 'alphabetAZ': return a.ticker.localeCompare(b.ticker);
        case 'alphabetZA': return b.ticker.localeCompare(a.ticker);
        case 'newestClose': {
          const aDate = a.closing_date ? new Date(a.closing_date).getTime() : 0;
          const bDate = b.closing_date ? new Date(b.closing_date).getTime() : 0;
          return bDate - aDate;
        }
        case 'oldestClose': {
          const aDate = a.closing_date ? new Date(a.closing_date).getTime() : 0;
          const bDate = b.closing_date ? new Date(b.closing_date).getTime() : 0;
          return aDate - bDate;
        }
        case 'yieldHigh': {
          const ay = calculateYield(a) ?? -Infinity;
          const by = calculateYield(b) ?? -Infinity;
          return by - ay;
        }
        case 'yieldLow': {
          const ay = calculateYield(a) ?? Infinity;
          const by = calculateYield(b) ?? Infinity;
          return ay - by;
        }
        default: return 0;
      }
    });
    setDisplayAlerts(sorted);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatPercent = (val: number | null) => {
    if (val == null) return '-';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  const getYieldColor = (val: number | null) => {
    if (val == null) return colors.textSecondary;
    return val >= 0 ? colors.bullish : colors.bearish;
  };

  const sortOptions: { key: SortType; label: string }[] = [
    { key: 'newestClose', label: language === 'es' ? 'Cierre más reciente' : 'Newest Close' },
    { key: 'oldestClose', label: language === 'es' ? 'Cierre más antiguo' : 'Oldest Close' },
    { key: 'alphabetAZ', label: t('alphabeticalAZ') },
    { key: 'alphabetZA', label: t('alphabeticalZA') },
    { key: 'yieldHigh', label: language === 'es' ? 'Mayor Rendimiento' : 'Highest Yield' },
    { key: 'yieldLow', label: language === 'es' ? 'Menor Rendimiento' : 'Lowest Yield' },
  ];

  const renderItem = ({ item }: { item: Alert }) => {
    const yieldVal = calculateYield(item);

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Ticker + Target */}
        <View style={styles.cardHeader}>
          <View style={styles.tickerBlock}>
            <Text style={[styles.ticker, { color: colors.text }]}>{item.ticker}</Text>
            {item.ticker_name ? (
              <Text style={[styles.tickerName, { color: colors.textSecondary }]}>{item.ticker_name}</Text>
            ) : null}
          </View>
          <View style={[styles.targetBadge, {
            backgroundColor: item.target_accounts === 'Subscribers' ? `${colors.primary}15` : `${colors.textSecondary}12`,
            borderColor: item.target_accounts === 'Subscribers' ? `${colors.primary}40` : colors.border,
          }]}>
            <MaterialIcons
              name={item.target_accounts === 'Subscribers' ? 'star' : 'public'}
              size={11}
              color={item.target_accounts === 'Subscribers' ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.targetBadgeText, {
              color: item.target_accounts === 'Subscribers' ? colors.primary : colors.textSecondary,
            }]}>
              {item.target_accounts === 'Subscribers' ? t('targetSubscribers') : t('targetFreeAccounts')}
            </Text>
          </View>
        </View>

        {/* Dates + Yield grid */}
        <View style={[styles.grid, { borderColor: colors.border }]}>
          <View style={styles.gridCell}>
            <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('openingDate')}</Text>
            <Text style={[styles.gridValue, { color: colors.text }]}>{formatDate(item.opening_date)}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('closingDate')}</Text>
            <Text style={[styles.gridValue, { color: colors.text }]}>{formatDate(item.closing_date)}</Text>
          </View>
          <View style={styles.gridCell}>
            <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('yieldLabel')}</Text>
            <Text style={[styles.gridValue, { color: getYieldColor(yieldVal), fontSize: 15, fontWeight: '700' }]}>
              {formatPercent(yieldVal)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

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
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {language === 'es' ? 'Rendimientos' : 'Performance'}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {language === 'es' ? 'Alertas cerradas' : 'Closed alerts'}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setShowSortMenu(!showSortMenu)} style={styles.headerActionButton}>
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
            <TouchableOpacity
              key={key}
              style={styles.sortOption}
              onPress={() => { setSortType(key); setShowSortMenu(false); }}
            >
              <Text style={[styles.sortOptionText, { color: colors.text }]}>{label}</Text>
              {sortType === key && <MaterialIcons name="check" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {displayAlerts.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="bar-chart" size={64} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {search.trim()
              ? (language === 'es' ? 'Sin resultados' : 'No results')
              : (language === 'es' ? 'Sin rendimientos' : 'No performance data')}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            {search.trim()
              ? (language === 'es' ? 'Intenta con otro término.' : 'Try a different search term.')
              : (language === 'es' ? 'Las alertas cerradas aparecerán aquí.' : 'Closed alerts will appear here.')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayAlerts}
          renderItem={renderItem}
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
  sortOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  sortOptionText: { ...typography.body },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyTitle: { ...typography.h3, marginTop: spacing.lg },
  emptySubtitle: { ...typography.body, marginTop: spacing.sm, textAlign: 'center' },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  tickerBlock: { flex: 1, marginRight: spacing.sm },
  ticker: { ...typography.h3 },
  tickerName: { ...typography.caption, marginTop: 2 },
  targetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  targetBadgeText: { fontSize: 10, fontWeight: '600' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  gridCell: {
    width: '33.33%',
    paddingVertical: spacing.xs,
    paddingRight: spacing.xs,
  },
  gridLabel: { ...typography.caption, marginBottom: 2 },
  gridValue: { ...typography.bodySmall, fontWeight: '600' },
});
