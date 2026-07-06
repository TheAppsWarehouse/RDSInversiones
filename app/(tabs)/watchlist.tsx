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
} from 'react-native';
import { useAuth, useAlert } from '@/template';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { calculateYield, calculateElapsedDays, formatElapsed, formatPrice } from '@/services/alertService';
import { watchlistService, WatchlistItem } from '@/services/watchlistService';
import { useWatchlist } from '@/contexts/WatchlistContext';
import { Alert, AlertCondition } from '@/types/stock';
import { useLanguage } from '@/hooks/useLanguage';
import { useAccountType } from '@/hooks/useAccountType';

export default function WatchlistScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { t, language } = useLanguage();
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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

  const formatPercent = (val: number | null) => {
    if (val == null) return '-';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
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

  const getYieldColor = (y: number | null) => {
    if (y == null) return colors.textSecondary;
    return y >= 0 ? colors.bullish : colors.bearish;
  };

  const renderCard = ({ item }: { item: WatchlistItem }) => {
    const alert = item.alert;
    if (!alert) return null;

    const yieldVal = calculateYield(alert);
    const elapsedDays = calculateElapsedDays(alert);
    const isClosed = alert.alert_condition === 'Closed';
    const market = alert.market ?? 'EEUU';
    const isRemoving = removingId === item.id;

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* Remove button */}
        <TouchableOpacity
          style={[styles.removeBtn, { backgroundColor: `${colors.error}15` }]}
          onPress={() => handleRemove(item)}
          disabled={isRemoving}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          {isRemoving
            ? <ActivityIndicator size="small" color={colors.error} />
            : <MaterialIcons name="close" size={16} color={colors.error} />
          }
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.tickerBlock}>
            <View style={styles.tickerRow}>
              <Text style={[styles.ticker, { color: colors.text }]}>{alert.ticker}</Text>
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
            {alert.ticker_name ? (
              <Text style={[styles.tickerName, { color: colors.textSecondary }]}>{alert.ticker_name}</Text>
            ) : null}
          </View>
          <View style={styles.headerRight}>
            <View style={[styles.conditionBadge, { backgroundColor: `${getConditionColor(alert.alert_condition)}18` }]}>
              <View style={[styles.conditionDot, { backgroundColor: getConditionColor(alert.alert_condition) }]} />
              <Text style={[styles.conditionText, { color: getConditionColor(alert.alert_condition) }]}>
                {alert.alert_condition === 'Current' ? t('conditionCurrent') : t('conditionClosed')}
              </Text>
            </View>
          </View>
        </View>

        {/* Action + Dates */}
        <View style={styles.metaRow}>
          {alert.action != null && (
            <View style={[styles.actionChip, { backgroundColor: `${getActionColor(alert.action)}18` }]}>
              <Text style={[styles.actionChipText, { color: getActionColor(alert.action) }]}>
                {alert.action === 'Buy' ? t('actionBuy') : t('actionSell')}
              </Text>
            </View>
          )}
          <Text style={[styles.metaDate, { color: colors.textSecondary }]}>
            {t('openingDate')}: {formatDate(alert.opening_date)}
          </Text>
          {isClosed && alert.closing_date ? (
            <Text style={[styles.metaDate, { color: colors.textSecondary }]}>
              {t('closingDate')}: {formatDate(alert.closing_date)}
            </Text>
          ) : null}
        </View>

        {/* Prices grid */}
        <View style={[styles.grid, { borderColor: colors.border }]}>
          {alert.entry_price != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('entryPrice')}</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{formatPrice(alert.entry_price, market)}</Text>
            </View>
          )}
          {alert.re_entry_price != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('reEntryPrice')}</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{formatPrice(alert.re_entry_price, market)}</Text>
            </View>
          )}
          {!isClosed && alert.current_price != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('currentPrice')}</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{formatPrice(alert.current_price, market)}</Text>
            </View>
          )}
          {isClosed && alert.closing_price != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('closingPrice')}</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{formatPrice(alert.closing_price, market)}</Text>
            </View>
          )}
          {alert.three_months_goal != null && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('threeMonthsGoal')}</Text>
              <Text style={[styles.gridValue, { color: colors.primary }]}>{alert.three_months_goal.toFixed(1)}%</Text>
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
            const val = alert[key as keyof Alert] as string;
            return (
              <View key={key} style={styles.profileActionCell}>
                <Text style={[styles.profileActionLabel, { color: colors.textSecondary }]}>{label}</Text>
                <Text style={[styles.profileActionValue, { color: getProfileActionColor(val) }]}>
                  {val === 'Buy' ? t('actionBuy')
                    : val === 'Sell' ? t('actionSell')
                    : val === 'Double' ? 'Double'
                    : val === 'Hold' ? 'Hold'
                    : val === 'Close' ? 'Close'
                    : val === 'Keep Out' ? 'Keep Out'
                    : t('actionRefrain')}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
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
              : 'Tap the checkbox on an alert to add it here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderCard}
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

  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  removeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingRight: 46,
    paddingBottom: spacing.sm,
  },
  tickerBlock: { flex: 1, marginRight: spacing.sm },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ticker: { ...typography.h3 },
  marketBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  marketBadgeText: { fontSize: 10, fontWeight: '700' },
  tickerName: { ...typography.caption, marginTop: 2 },
  headerRight: { alignItems: 'flex-end', gap: spacing.xs },
  conditionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  actionChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
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
  gridCell: { width: '33.33%', paddingVertical: spacing.xs, paddingRight: spacing.xs },
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
