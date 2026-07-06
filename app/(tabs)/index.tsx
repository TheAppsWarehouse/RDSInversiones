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
import { MaterialIcons } from '@expo/vector-icons';
import { alertService, calculateYield, calculateElapsedDays, formatElapsed, formatPrice } from '@/services/alertService';
import { Alert, AlertCondition } from '@/types/stock';
import { useLanguage } from '@/hooks/useLanguage';
import { useAccountType } from '@/hooks/useAccountType';
import { useWatchlist } from '@/contexts/WatchlistContext';

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
  const [displayAlerts, setDisplayAlerts] = useState<Alert[]>([]);
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
      const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const filtered = data.filter((a) => {
        if (a.alert_condition !== 'Closed') return true;
        if (!a.closing_date) return true;
        return new Date(a.closing_date).getTime() >= oneMonthAgo;
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

  React.useEffect(() => {
    applySort(sortType);
  }, [alerts, sortType, search, marketFilter]);

  const applySort = (type: SortType) => {
    const q = search.trim().toLowerCase();

    let marketFiltered = alerts;
    if (marketFilter !== 'ALL') {
      marketFiltered = alerts.filter((a) => (a.market ?? 'EEUU') === marketFilter);
    }

    const filtered = q
      ? marketFiltered.filter(
          (a) =>
            a.ticker.toLowerCase().includes(q) ||
            (a.ticker_name ?? '').toLowerCase().includes(q)
        )
      : marketFiltered;

    const sorted = [...filtered].sort((a, b) => {
      switch (type) {
        case 'alphabetAZ': return a.ticker.localeCompare(b.ticker);
        case 'alphabetZA': return b.ticker.localeCompare(a.ticker);
        case 'newestFirst': return new Date(b.opening_date).getTime() - new Date(a.opening_date).getTime();
        case 'oldestFirst': return new Date(a.opening_date).getTime() - new Date(b.opening_date).getTime();
        case 'currentFirst': return a.alert_condition === 'Current' ? -1 : 1;
        case 'closedFirst': return a.alert_condition === 'Closed' ? -1 : 1;
        default: return 0;
      }
    });
    setDisplayAlerts(sorted);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleWatchlistToggle = async (alertId: string) => {
    setTogglingWatchlist(alertId);
    if (isInWatchlist(alertId)) {
      await removeFromWatchlist(alertId);
    } else {
      await addToWatchlist(alertId);
    }
    setTogglingWatchlist(null);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const formatPercent = (val: number | null) => {
    if (val == null) return '-';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  const getActionLabel = (action: string | null) => {
    if (!action) return '-';
    if (action === 'Buy') return t('actionBuy');
    if (action === 'Sell') return t('actionSell');
    return t('actionRefrain');
  };

  const getActionColor = (action: string | null) => {
    if (action === 'Buy') return colors.bullish;
    if (action === 'Sell') return colors.bearish;
    return colors.textSecondary;
  };

  const getProfileActionColor = (action: string) => {
    if (action === 'Buy' || action === 'Double') return colors.bullish;
    if (action === 'Sell' || action === 'Close') return colors.bearish;
    return colors.textSecondary;
  };

  const getConditionColor = (cond: AlertCondition) =>
    cond === 'Current' ? colors.bullish : colors.textSecondary;

  const getConditionLabel = (cond: AlertCondition) =>
    cond === 'Current' ? t('conditionCurrent') : t('conditionClosed');

  const getYieldColor = (yieldVal: number | null) => {
    if (yieldVal == null) return colors.textSecondary;
    return yieldVal >= 0 ? colors.bullish : colors.bearish;
  };

  const sortOptions: { key: SortType; label: string }[] = [
    { key: 'newestFirst', label: t('newestFirst') },
    { key: 'oldestFirst', label: t('oldestFirst') },
    { key: 'alphabetAZ', label: t('alphabeticalAZ') },
    { key: 'alphabetZA', label: t('alphabeticalZA') },
    { key: 'currentFirst', label: t('currentFirst') },
    { key: 'closedFirst', label: t('closedFirst') },
  ];

  const renderAlertCard = ({ item }: { item: Alert }) => {
    const yieldVal = calculateYield(item);
    const elapsedDays = calculateElapsedDays(item);
    const isClosed = item.alert_condition === 'Closed';
    const market = item.market ?? 'EEUU';
    const inWatchlist = isInWatchlist(item.id);
    const isToggling = togglingWatchlist === item.id;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Watchlist bookmark — Free and Affiliate only */}
        {canWatchlist && (
          <TouchableOpacity
            style={[styles.watchlistBtn, {
              backgroundColor: inWatchlist ? `${colors.primary}20` : `${colors.border}30`,
              borderColor: inWatchlist ? `${colors.primary}60` : colors.border,
            }]}
            onPress={() => handleWatchlistToggle(item.id)}
            disabled={isToggling}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
          >
            {isToggling
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <MaterialIcons
                  name={inWatchlist ? 'bookmark' : 'bookmark-border'}
                  size={18}
                  color={inWatchlist ? colors.primary : colors.textSecondary}
                />
            }
          </TouchableOpacity>
        )}

        {/* Header row: ticker + badges */}
        <View style={[styles.cardHeader, canWatchlist && { paddingRight: 48 }]}>
          <View style={styles.tickerBlock}>
            <View style={styles.tickerRow}>
              <Text style={[styles.ticker, { color: colors.text }]}>{item.ticker}</Text>
              <View style={[styles.marketBadge, {
                backgroundColor: market === 'ARG' ? `${colors.primary}20` : `${colors.success ?? colors.primary}15`,
                borderColor: market === 'ARG' ? `${colors.primary}50` : `${colors.success ?? colors.primary}40`,
              }]}>
                <Text style={[styles.marketBadgeText, {
                  color: market === 'ARG' ? colors.primary : (colors.success ?? colors.primary),
                }]}>
                  {market === 'ARG' ? 'AR$' : 'US$'}
                </Text>
              </View>
            </View>
            {item.ticker_name ? (
              <Text style={[styles.tickerName, { color: colors.textSecondary }]}>{item.ticker_name}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.targetBadge, {
              backgroundColor: item.target_accounts === 'Subscribers' ? `${colors.primary}15` : `${colors.textSecondary}12`,
              borderColor: item.target_accounts === 'Subscribers' ? `${colors.primary}40` : `${colors.border}`,
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
            <View style={[styles.conditionBadge, { backgroundColor: `${getConditionColor(item.alert_condition)}18` }]}>
              <View style={[styles.conditionDot, { backgroundColor: getConditionColor(item.alert_condition) }]} />
              <Text style={[styles.conditionText, { color: getConditionColor(item.alert_condition) }]}>
                {getConditionLabel(item.alert_condition)}
              </Text>
            </View>
          </View>
        </View>

        {/* Action + Dates */}
        <View style={styles.metaRow}>
          {item.action != null && (
            <View style={[styles.actionChip, { backgroundColor: `${getActionColor(item.action)}18` }]}>
              <Text style={[styles.actionChipText, { color: getActionColor(item.action) }]}>
                {getActionLabel(item.action)}
              </Text>
            </View>
          )}
          <Text style={[styles.metaDate, { color: colors.textSecondary }]}>
            {t('openingDate')}: {formatDate(item.opening_date)}
          </Text>
          {isClosed && item.closing_date ? (
            <Text style={[styles.metaDate, { color: colors.textSecondary }]}>
              {t('closingDate')}: {formatDate(item.closing_date)}
            </Text>
          ) : null}
        </View>

        {/* Prices grid */}
        <View style={[styles.grid, { borderColor: colors.border }]}>
          {item.entry_price != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('entryPrice')}</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{formatPrice(item.entry_price, market)}</Text>
            </View>
          )}
          {item.re_entry_price != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('reEntryPrice')}</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{formatPrice(item.re_entry_price, market)}</Text>
            </View>
          )}
          {!isClosed && item.current_price != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('currentPrice')}</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{formatPrice(item.current_price, market)}</Text>
            </View>
          )}
          {isClosed && item.closing_price != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('closingPrice')}</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{formatPrice(item.closing_price, market)}</Text>
            </View>
          )}
          {item.three_months_goal != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('threeMonthsGoal')}</Text>
              <Text style={[styles.gridValue, { color: colors.primary }]}>{item.three_months_goal.toFixed(1)}%</Text>
            </View>
          )}
          {yieldVal != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('yieldLabel')}</Text>
              <Text style={[styles.gridValue, { color: getYieldColor(yieldVal) }]}>{formatPercent(yieldVal)}</Text>
            </View>
          )}
          <View style={styles.gridCell}>
            <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('elapsedTime')}</Text>
            <Text style={[styles.gridValue, { color: colors.text }]}>{formatElapsed(elapsedDays)}</Text>
          </View>
        </View>

        {/* Profile actions */}
        <View style={[styles.profileActionsRow, { borderTopColor: colors.border }]}>
          {[
            { key: 'action_conservative', label: t('actionConservative') },
            { key: 'action_moderate', label: t('actionModerate') },
            { key: 'action_aggressive', label: t('actionRisky') },
          ].map(({ key, label }) => {
            const val = item[key as keyof Alert] as string;
            return (
              <View key={key} style={styles.profileActionCell}>
                <Text style={[styles.profileActionLabel, { color: colors.textSecondary }]}>{label}</Text>
                <Text style={[styles.profileActionValue, { color: getProfileActionColor(val) }]}>
                  {val === 'Buy' ? t('actionBuy') : val === 'Sell' ? t('actionSell') : val === 'Double' ? 'Double' : val === 'Hold' ? 'Hold' : val === 'Close' ? 'Close' : val === 'Keep Out' ? 'Keep Out' : t('actionRefrain')}
                </Text>
              </View>
            );
          })}
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
          data={displayAlerts}
          renderItem={renderAlertCard}
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

  // Card
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  watchlistBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  tickerBlock: { flex: 1, marginRight: spacing.sm },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ticker: { ...typography.h3 },
  marketBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  marketBadgeText: { fontSize: 10, fontWeight: '700' },
  tickerName: { ...typography.caption, marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: spacing.xs },
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
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
  },
  conditionDot: { width: 7, height: 7, borderRadius: 4 },
  conditionText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  actionChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
  },
  actionChipText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  metaDate: { ...typography.caption },

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

  profileActionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  profileActionCell: { flex: 1, alignItems: 'center' },
  profileActionLabel: { fontSize: 9, textAlign: 'center', marginBottom: 2, textTransform: 'uppercase', fontWeight: '600' },
  profileActionValue: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
});
