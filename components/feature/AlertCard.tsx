import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/hooks/useLanguage';
import { Alert, AlertCondition, ProfileAction } from '@/types/stock';
import {
  formatPriceARS,
  formatPriceUSD,
  formatElapsed,
  calculateElapsedDays,
  calculateYieldForMarket,
  getAlertMarkets,
} from '@/services/alertService';

interface AlertCardProps {
  item: Alert;
  // Watchlist controls
  canWatchlist?: boolean;
  isInWatchlist?: boolean;
  isTogglingWatchlist?: boolean;
  onWatchlistToggle?: () => void;
  // Remove (watchlist screen)
  showRemoveBtn?: boolean;
  isRemoving?: boolean;
  onRemove?: () => void;
  // Market preference
  marketFilter?: 'EEUU' | 'ARG' | 'ALL';
}

export function AlertCard({
  item,
  canWatchlist = false,
  isInWatchlist = false,
  isTogglingWatchlist = false,
  onWatchlistToggle,
  showRemoveBtn = false,
  isRemoving = false,
  onRemove,
  marketFilter = 'ALL',
}: AlertCardProps) {
  const { colors } = useTheme();
  const { t, language } = useLanguage();
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);

  const isClosed = item.alert_condition === 'Closed';
  const { hasARS, hasUSD } = getAlertMarkets(item);

  // Defensive guard:
  // If this AlertCard is rendered from a screen that forgot to filter by market,
  // don't render the card when it doesn't belong to the selected market.
  if (
    (marketFilter === 'ARG' && !hasARS) ||
    (marketFilter === 'EEUU' && !hasUSD)
  ) {
    return null;
  }

  // Determine which market blocks to show based on filter
  const showARS = hasARS && (marketFilter === 'ALL' || marketFilter === 'ARG');
  const showUSD = hasUSD && (marketFilter === 'ALL' || marketFilter === 'EEUU');

  // If filter doesn't match any available market, show both
  const effectiveShowARS = hasARS && (!hasUSD || marketFilter === 'ARG' || marketFilter === 'ALL');
  const effectiveShowUSD = hasUSD && (!hasARS || marketFilter === 'EEUU' || marketFilter === 'ALL');

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

  const formatPercent = (val: number | null) => {
    if (val == null) return null;
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  const getProfileActionColor = (action: ProfileAction | string) => {
    if (action === 'Buy' || action === 'Double') return colors.bullish;
    if (action === 'Sell' || action === 'Close') return colors.bearish;
    return colors.textSecondary;
  };

  const getConditionColor = (cond: AlertCondition) =>
    cond === 'Current' ? colors.bullish : colors.textSecondary;

  const getYieldColor = (yieldVal: number | null) => {
    if (yieldVal == null) return colors.textSecondary;
    return yieldVal >= 0 ? colors.bullish : colors.bearish;
  };

  const getProfileActionLabel = (a: string) => {
    switch (a) {
      case 'Buy': return language === 'es' ? 'Comprar' : 'Buy';
      case 'Sell': return language === 'es' ? 'Vender' : 'Sell';
      case 'Double': return 'Double';
      case 'Hold': return 'Hold';
      case 'Close': return 'Close';
      case 'Keep Out': return 'Keep Out';
      default: return language === 'es' ? 'Abstenerse' : 'Refrain';
    }
  };

  const elapsedDays = calculateElapsedDays(item);
  const arsYield = calculateYieldForMarket(item, 'ARS');
  const usdYield = calculateYieldForMarket(item, 'USD');

  // Yield priority: USD if alert has USD data, else ARS (regardless of market filter display)
  const displayYield = hasUSD ? usdYield : arsYield;

  // Pick the right details field based on language
  const localizedDetails = language === 'es'
    ? (item.alert_details ?? null)
    : (item.alert_detail_en ?? item.alert_details ?? null);
  const hasAlertDetails = localizedDetails != null && localizedDetails.trim().length > 0;

  // Resolve Balanz URL from TickerNames based on marketFilter:
  // - ALL or ARG → use balanz_url_arg (falls back to balanz_url_usa if arg is absent)
  // - EEUU       → use balanz_url_usa (falls back to balanz_url_arg if usa is absent)
  // Falls back to legacy balanz_url if ticker-name URLs are both absent.
  const resolvedBalanzUrl: string | null = (() => {
    const argUrl = item.balanz_url_arg?.trim() || null;
    const usaUrl = item.balanz_url_usa?.trim() || null;
    const legacyUrl = item.balanz_url?.trim() || null;
    if (marketFilter === 'EEUU') return usaUrl || argUrl || legacyUrl;
    return argUrl || usaUrl || legacyUrl;
  })();
  const hasResolvedBalanzUrl = Boolean(resolvedBalanzUrl);

  const handleBalanzLink = async () => {
    if (!resolvedBalanzUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(resolvedBalanzUrl);
      if (canOpen) await Linking.openURL(resolvedBalanzUrl);
    } catch {}
  };

  // Right-side action buttons count (for padding)
  const rightBtnCount = (showRemoveBtn ? 1 : 0) + (canWatchlist ? 1 : 0);
  const rightPadding = rightBtnCount * 40 + 12;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Remove button (watchlist screen) */}
      {showRemoveBtn && (
        <TouchableOpacity
          style={[styles.actionBtn, styles.removeBtnPos, { backgroundColor: `${colors.error}15` }]}
          onPress={onRemove}
          disabled={isRemoving}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          {isRemoving
            ? <ActivityIndicator size="small" color={colors.error} />
            : <MaterialIcons name="close" size={16} color={colors.error} />
          }
        </TouchableOpacity>
      )}

      {/* Watchlist bookmark button */}
      {canWatchlist && (
        <TouchableOpacity
          style={[
            styles.actionBtn,
            showRemoveBtn ? styles.watchlistBtnPosSecond : styles.watchlistBtnPos,
            {
              backgroundColor: isInWatchlist ? `${colors.primary}20` : `${colors.border}30`,
              borderColor: isInWatchlist ? `${colors.primary}60` : colors.border,
              borderWidth: 1,
            },
          ]}
          onPress={onWatchlistToggle}
          disabled={isTogglingWatchlist}
          hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        >
          {isTogglingWatchlist
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <MaterialIcons
                name={isInWatchlist ? 'bookmark' : 'bookmark-border'}
                size={18}
                color={isInWatchlist ? colors.primary : colors.textSecondary}
              />
          }
        </TouchableOpacity>
      )}

      {/* ── Header ── */}
      <View style={[styles.cardHeader, { paddingRight: rightPadding }]}>
        <View style={styles.tickerBlock}>
          <Text style={[styles.ticker, { color: colors.text }]}>{item.ticker}</Text>
          {item.ticker_name ? (
            <Text style={[styles.tickerName, { color: colors.textSecondary }]}>{item.ticker_name}</Text>
          ) : null}
          <Text style={[styles.metaDate, { color: colors.textSecondary }]}>
            {t('openingDate')}: {formatDate(item.opening_date)}
          </Text>
          {isClosed && item.closing_date ? (
            <Text style={[styles.metaDate, { color: colors.textSecondary }]}>
              {t('closingDate')}: {formatDate(item.closing_date)}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerRight}>
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
          <View style={[styles.conditionBadge, { backgroundColor: `${getConditionColor(item.alert_condition)}18` }]}>
            <View style={[styles.conditionDot, { backgroundColor: getConditionColor(item.alert_condition) }]} />
            <Text style={[styles.conditionText, { color: getConditionColor(item.alert_condition) }]}>
              {item.alert_condition === 'Current' ? t('conditionCurrent') : t('conditionClosed')}
            </Text>
          </View>
        </View>
      </View>

      {/* ── ARS Price Block ── */}
      {effectiveShowARS && hasARS && (
        <View style={[styles.priceBlock, { borderTopColor: colors.border }]}>
          <View style={styles.priceRow}>
            <View style={styles.priceCell}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                {language === 'es' ? 'Precio de Entrada' : 'Entry Price'}
              </Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>
                {formatPriceARS(item.entry_price_ars ?? (item.market === 'ARG' ? item.entry_price : null))}
              </Text>
            </View>
            <View style={styles.priceCell}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                {language === 'es' ? 'Re-Entrada' : 'Re-Entry Price'}
              </Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>
                {formatPriceARS(item.re_entry_price_ars ?? (item.market === 'ARG' ? item.re_entry_price : null))}
              </Text>
            </View>
            <View style={styles.priceCell}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                {isClosed ? (language === 'es' ? 'Precio Cierre' : 'Closing Price') : (language === 'es' ? 'Precio Actual' : 'Current Price')}
              </Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>
                {isClosed
                  ? formatPriceARS(item.closing_price_ars ?? (item.market === 'ARG' ? item.closing_price : null))
                  : formatPriceARS(item.current_price_ars ?? (item.market === 'ARG' ? item.current_price : null))}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── USD Price Block ── */}
      {effectiveShowUSD && hasUSD && (
        <View style={[styles.priceBlock, { borderTopColor: colors.border }]}>
          <View style={styles.priceRow}>
            <View style={styles.priceCell}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                {language === 'es' ? 'Precio de Entrada' : 'Entry Price'}
              </Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>
                {formatPriceUSD(item.entry_price_usd ?? (item.market === 'EEUU' ? item.entry_price : null))}
              </Text>
            </View>
            <View style={styles.priceCell}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                {language === 'es' ? 'Re-Entrada' : 'Re-Entry Price'}
              </Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>
                {formatPriceUSD(item.re_entry_price_usd ?? (item.market === 'EEUU' ? item.re_entry_price : null))}
              </Text>
            </View>
            <View style={styles.priceCell}>
              <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
                {isClosed ? (language === 'es' ? 'Precio Cierre' : 'Closing Price') : (language === 'es' ? 'Precio Actual' : 'Current Price')}
              </Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>
                {isClosed
                  ? formatPriceUSD(item.closing_price_usd ?? (item.market === 'EEUU' ? item.closing_price : null))
                  : formatPriceUSD(item.current_price_usd ?? (item.market === 'EEUU' ? item.current_price : null))}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* ── Yield / Goals row ── */}
      <View style={[styles.metricsRow, { borderTopColor: colors.border }]}>
        <View style={styles.metricCell}>
          <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
            {language === 'es' ? 'Rendimiento' : 'Current Yield'}
          </Text>
          <Text style={[styles.priceValue, { color: getYieldColor(displayYield) }]}>
            {formatPercent(displayYield) ?? '-'}
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
            {language === 'es' ? 'Meta Corto Plazo' : 'Short-Term Goal'}
          </Text>
          <Text style={[styles.priceValue, { color: colors.primary }]}>
            {(item.short_term_goal ?? item.three_months_goal) != null
              ? `${Math.round((item.short_term_goal ?? item.three_months_goal)!)}%`
              : '-'}
          </Text>
        </View>
        <View style={styles.metricCell}>
          <Text style={[styles.priceLabel, { color: colors.textSecondary }]}>
            {language === 'es' ? 'Meta Largo Plazo' : 'Long-Term Goal'}
          </Text>
          <Text style={[styles.priceValue, { color: colors.primary }]}>
            {item.long_term_goal != null ? `${Math.round(item.long_term_goal)}%` : '-'}
          </Text>
        </View>
      </View>

      {/* ── Profile actions row ── */}
      <View style={[styles.profileActionsRow, { borderTopColor: colors.border }]}>
        {[
          { key: 'action_conservative', label: language === 'es' ? 'Conserv.' : 'Conservative' },
          { key: 'action_moderate', label: language === 'es' ? 'Moderado' : 'Moderate' },
          { key: 'action_aggressive', label: language === 'es' ? 'Agresivo' : 'Aggressive' },
          { key: 'action_ultra_aggressive', label: language === 'es' ? 'Ultra-Agres.' : 'Ultra-Aggr.' },
        ].map(({ key, label }) => {
          const val = (item[key as keyof Alert] as ProfileAction) ?? 'Refrain';
          return (
            <View key={key} style={styles.profileActionCell}>
              <Text style={[styles.profileActionLabel, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[styles.profileActionValue, { color: getProfileActionColor(val) }]}>
                {getProfileActionLabel(val)}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── Bottom bar: Trade with Balanz + Alert Details ── */}
      <View style={[styles.bottomBar, { borderTopColor: colors.border }]}>
        <View style={styles.bottomBarItem}>
          <Text style={[styles.bottomBarLabel, { color: colors.textSecondary }]}>
            {language === 'es' ? 'Operar con Balanz' : 'Trade with Balanz'}
          </Text>
          <TouchableOpacity
            style={[
              styles.bottomBarBtn,
              {
                backgroundColor: hasResolvedBalanzUrl ? `${colors.primary}15` : `${colors.border}20`,
                borderColor: hasResolvedBalanzUrl ? `${colors.primary}40` : colors.border,
              },
            ]}
            onPress={hasResolvedBalanzUrl ? handleBalanzLink : undefined}
            disabled={!hasResolvedBalanzUrl}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 22 }}>🔗</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.bottomBarDivider, { backgroundColor: colors.border }]} />
        <View style={styles.bottomBarItem}>
          <Text style={[styles.bottomBarLabel, { color: colors.textSecondary }]}>
            {language === 'es' ? 'Detalles' : 'Alert Details'}
          </Text>
          <TouchableOpacity
            style={[
              styles.bottomBarBtn,
              {
                backgroundColor: hasAlertDetails ? `${colors.primary}15` : `${colors.border}20`,
                borderColor: hasAlertDetails ? `${colors.primary}40` : colors.border,
              },
            ]}
            onPress={hasAlertDetails ? () => setDetailsModalVisible(true) : undefined}

            disabled={!hasAlertDetails}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={{ fontSize: 22 }}>✉️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Alert Details Modal ── */}
      <Modal
        visible={detailsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailsModal, { backgroundColor: colors.surface }]}>
            <View style={styles.detailsModalHeader}>
              <Text style={[styles.detailsModalTitle, { color: colors.text }]}>
                {item.ticker} — {language === 'es' ? 'Detalles de Alerta' : 'Alert Details'}
              </Text>
              <TouchableOpacity
                onPress={() => setDetailsModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.detailsText, { color: colors.text }]}>
                {localizedDetails ?? ''}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    position: 'relative',
  },

  // Action buttons (top-right)
  actionBtn: {
    position: 'absolute',
    top: 10,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnPos: { right: 10 },
  watchlistBtnPos: { right: 10 },
  watchlistBtnPosSecond: { right: 48 },

  // Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  tickerBlock: { flex: 1, marginRight: spacing.sm },
  ticker: { ...typography.h3 },
  tickerName: { ...typography.caption, marginTop: 2, marginBottom: 2 },
  metaDate: { ...typography.caption },
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
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 8,
  },
  conditionDot: { width: 7, height: 7, borderRadius: 4 },
  conditionText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },

  // Price blocks
  priceBlock: {
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
  },
  priceCell: {
    flex: 1,
    paddingRight: spacing.xs,
  },
  priceLabel: { ...typography.caption, marginBottom: 2 },
  priceValue: { ...typography.bodySmall, fontWeight: '600' },

  // Metrics row
  metricsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  metricCell: { flex: 1, paddingRight: spacing.xs },

  // Profile actions
  profileActionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  profileActionCell: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  profileActionLabel: {
    fontSize: 8,
    textAlign: 'center',
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  profileActionValue: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    textAlign: 'center',
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bottomBarItem: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  bottomBarDivider: {
    width: 1,
    marginHorizontal: spacing.sm,
  },
  bottomBarLabel: {
    ...typography.caption,
    textAlign: 'center',
  },
  bottomBarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Alert Details Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  detailsModal: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    maxHeight: '70%',
  },
  detailsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  detailsModalTitle: {
    ...typography.h3,
    flex: 1,
    marginRight: spacing.sm,
  },
  detailsText: {
    ...typography.body,
    lineHeight: 24,
  },
});
