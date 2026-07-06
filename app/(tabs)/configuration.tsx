import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
  RefreshControl,
  Linking,
} from 'react-native';
import { useAuth, useAlert } from '@/template';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import {
  alertService,
  calculateYieldForMarket,
  calculateElapsedDays,
  formatPriceARS,
  formatPriceUSD,
  getAlertMarkets,
} from '@/services/alertService';
import { accountService, AccountType } from '@/services/accountService';
import { tickerNameService } from '@/services/tickerNameService';
import {
  Alert as AlertType,
  AlertTerm,
  ProfileAction,
  TargetAccounts,
  TickerName,
  CreateAlertPayload,
  UpdateAlertPayload,
  CloseAlertPayload,
} from '@/types/stock';
import { router } from 'expo-router';
import { useAccountType } from '@/hooks/useAccountType';
import { useLanguage } from '@/hooks/useLanguage';
import { exportToExcel, importFromExcel } from '@/services/excelService';

type SortType = 'newestFirst' | 'oldestFirst' | 'alphabetAZ' | 'alphabetZA' | 'currentFirst' | 'closedFirst';
type ActiveTab = 'alerts' | 'names' | 'accounts';

interface ManagedAccount {
  id: string;
  email: string;
  account_type: AccountType;
  created_at: string;
  new_affiliates: boolean | null;
}

const ADMIN_ALLOWED_TYPES: AccountType[] = ['Free', 'Affiliate'];
const DEV_ALLOWED_TYPES: AccountType[] = ['Free', 'Affiliate', 'Admin'];

// Profile actions for New Alert
const CREATE_PROFILE_ACTIONS: ProfileAction[] = ['Buy', 'Sell', 'Refrain'];
// Profile actions for Update Alert
const UPDATE_PROFILE_ACTIONS: ProfileAction[] = ['Double', 'Hold', 'Close', 'Keep Out'];

export default function ConfigurationScreen() {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { t, language, notificationsEnabled } = useLanguage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { accountType } = useAccountType();

  const userIsAdmin = accountType === 'Admin';
  const userIsDev = accountType === 'Dev';

  const [activeTab, setActiveTab] = useState<ActiveTab>('alerts');

  // ─── Alerts state ──────────────────────────────────────────────────────────
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [displayAlerts, setDisplayAlerts] = useState<AlertType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortType, setSortType] = useState<SortType>('newestFirst');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [alertSearch, setAlertSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [exportingAlerts, setExportingAlerts] = useState(false);
  const [importingAlerts, setImportingAlerts] = useState(false);

  // ── Create alert form state ────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newTerm, setNewTerm] = useState<AlertTerm>('Short');
  const [newTargetAccounts, setNewTargetAccounts] = useState<TargetAccounts>('Subscribers');
  const [newActionConservative, setNewActionConservative] = useState<ProfileAction>('Refrain');
  const [newActionModerate, setNewActionModerate] = useState<ProfileAction>('Refrain');
  const [newActionAggressive, setNewActionAggressive] = useState<ProfileAction>('Refrain');
  const [newActionUltraAggressive, setNewActionUltraAggressive] = useState<ProfileAction>('Refrain');
  const [newEntryPriceARS, setNewEntryPriceARS] = useState('');
  const [newReEntryPriceARS, setNewReEntryPriceARS] = useState('');
  const [newEntryPriceUSD, setNewEntryPriceUSD] = useState('');
  const [newReEntryPriceUSD, setNewReEntryPriceUSD] = useState('');
  const [newShortTermGoal, setNewShortTermGoal] = useState('');
  const [newLongTermGoal, setNewLongTermGoal] = useState('');

  const [newAlertDetails, setNewAlertDetails] = useState('');
  const [newAlertDetailEn, setNewAlertDetailEn] = useState('');

  // ── Update alert form state ────────────────────────────────────────────────
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updatingAlert, setUpdatingAlert] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertType | null>(null);
  const [editCurrentPriceARS, setEditCurrentPriceARS] = useState('');
  const [editCurrentPriceUSD, setEditCurrentPriceUSD] = useState('');
  const [editShortTermGoal, setEditShortTermGoal] = useState('');
  const [editLongTermGoal, setEditLongTermGoal] = useState('');
  const [editActionConservative, setEditActionConservative] = useState<ProfileAction>('Hold');
  const [editActionModerate, setEditActionModerate] = useState<ProfileAction>('Hold');
  const [editActionAggressive, setEditActionAggressive] = useState<ProfileAction>('Hold');
  const [editActionUltraAggressive, setEditActionUltraAggressive] = useState<ProfileAction>('Hold');

  const [editAlertDetails, setEditAlertDetails] = useState('');
  const [editAlertDetailEn, setEditAlertDetailEn] = useState('');

  // ── Close alert form state ─────────────────────────────────────────────────
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingAlert, setClosingAlert] = useState(false);
  const [closingAlertTarget, setClosingAlertTarget] = useState<AlertType | null>(null);
  const [closePriceARS, setClosePriceARS] = useState('');
  const [closePriceUSD, setClosePriceUSD] = useState('');

  // ─── Ticker Names state ────────────────────────────────────────────────────
  const [tickerNames, setTickerNames] = useState<TickerName[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const [showAddNameModal, setShowAddNameModal] = useState(false);
  const [editingName, setEditingName] = useState<TickerName | null>(null);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newNameTicker, setNewNameTicker] = useState('');
  const [newNameValue, setNewNameValue] = useState('');
  const [newNameBalanzUrlArg, setNewNameBalanzUrlArg] = useState('');
  const [newNameBalanzUrlUsa, setNewNameBalanzUrlUsa] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [namesSearch, setNamesSearch] = useState('');
  const [exportingNames, setExportingNames] = useState(false);
  const [importingNames, setImportingNames] = useState(false);

  // ─── Accounts state ────────────────────────────────────────────────────────
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManagedAccount | null>(null);
  const [newAccountEmail, setNewAccountEmail] = useState('');
  const [newAccountType, setNewAccountType] = useState<AccountType>('Affiliate');
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [exportingAccounts, setExportingAccounts] = useState(false);
  const [importingAccounts, setImportingAccounts] = useState(false);
  const [togglingNewAffiliates, setTogglingNewAffiliates] = useState<string | null>(null);

  // ─── Alert Details modal (config cards) ──────────────────────────────────
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsAlert, setDetailsAlert] = useState<AlertType | null>(null);

  const allowedAccountTypes: AccountType[] = userIsDev ? DEV_ALLOWED_TYPES : ADMIN_ALLOWED_TYPES;
  const getEditableTypesForAccount = (account: ManagedAccount): AccountType[] => {
    if (userIsDev) return ['Free', 'Affiliate', 'Admin'];
    if (account.account_type === 'Dev' || account.account_type === 'Admin') return [];
    return ['Free', 'Affiliate'];
  };

  useEffect(() => {
    if (!userIsAdmin && !userIsDev) {
      router.replace('/(tabs)');
      return;
    }
    setLoading(false);
    loadAlerts();
  }, [userIsAdmin, userIsDev]);

  useEffect(() => {
    if (activeTab === 'names' && userIsDev) loadTickerNames();
    if (activeTab === 'accounts') loadAccounts();
  }, [activeTab]);

  useEffect(() => {
    applySort(sortType);
  }, [alerts, sortType, alertSearch]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (activeTab === 'alerts') await loadAlerts();
    else if (activeTab === 'names') await loadTickerNames();
    else await loadAccounts();
    setRefreshing(false);
  }, [activeTab]);

  // ─── Alerts handlers ──────────────────────────────────────────────────────

  const loadAlerts = useCallback(async () => {
    const { data, error } = await alertService.getAllAlerts();
    if (error) showAlert(t('error'), error);
    else if (data) {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const filtered = data.filter((a) => {
        if (a.alert_condition !== 'Closed') return true;
        if (!a.closing_date) return true;
        return new Date(a.closing_date).getTime() >= oneWeekAgo;
      });
      setAlerts(filtered);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  const applySort = (type: SortType) => {
    const q = alertSearch.trim().toLowerCase();
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
        case 'newestFirst': return new Date(b.opening_date).getTime() - new Date(a.opening_date).getTime();
        case 'oldestFirst': return new Date(a.opening_date).getTime() - new Date(b.opening_date).getTime();
        case 'currentFirst': return a.alert_condition === 'Current' ? -1 : 1;
        case 'closedFirst': return a.alert_condition === 'Closed' ? -1 : 1;
        default: return 0;
      }
    });
    setDisplayAlerts(sorted);
  };

  const resetCreateForm = () => {
    setNewTicker('');
    setNewTerm('Short');
    setNewTargetAccounts('Subscribers');
    setNewActionConservative('Refrain');
    setNewActionModerate('Refrain');
    setNewActionAggressive('Refrain');
    setNewActionUltraAggressive('Refrain');
    setNewEntryPriceARS('');
    setNewReEntryPriceARS('');
    setNewEntryPriceUSD('');
    setNewReEntryPriceUSD('');
    setNewShortTermGoal('');
    setNewLongTermGoal('');

    setNewAlertDetails('');
    setNewAlertDetailEn('');
  };

  const handleCreateAlert = async () => {
    if (!newTicker.trim()) { showAlert(t('error'), 'Ticker is required'); return; }
    const entryARS = newEntryPriceARS ? parseFloat(newEntryPriceARS) : null;
    const entryUSD = newEntryPriceUSD ? parseFloat(newEntryPriceUSD) : null;
    if (entryARS == null && entryUSD == null) {
      showAlert(t('error'), language === 'es'
        ? 'Debe ingresar al menos un precio de entrada (AR$ o US$)'
        : 'At least one Entry Price (AR$ or US$) is required');
      return;
    }
    setCreating(true);
    const payload: CreateAlertPayload = {
      ticker: newTicker.trim().toUpperCase(),
      term: newTerm,
      target_accounts: newTargetAccounts,
      action_conservative: newActionConservative,
      action_moderate: newActionModerate,
      action_aggressive: newActionAggressive,
      action_ultra_aggressive: newActionUltraAggressive,
      entry_price_ars: entryARS,
      re_entry_price_ars: newReEntryPriceARS ? parseFloat(newReEntryPriceARS) : null,
      entry_price_usd: entryUSD,
      re_entry_price_usd: newReEntryPriceUSD ? parseFloat(newReEntryPriceUSD) : null,
      short_term_goal: newShortTermGoal ? parseFloat(newShortTermGoal) : null,
      long_term_goal: newLongTermGoal ? parseFloat(newLongTermGoal) : null,

      alert_details: newAlertDetails.trim() || null,
      alert_detail_en: newAlertDetailEn.trim() || null,
    };
    const { error } = await alertService.createAlert(payload, true, notificationsEnabled);
    setCreating(false);
    if (error) { showAlert(t('error'), error); return; }
    setShowCreateModal(false);
    resetCreateForm();
    loadAlerts();
    showAlert(t('success'), t('alertAddedSuccess'));
  };

  const openUpdateModal = (alert: AlertType) => {
    setEditingAlert(alert);
    setEditCurrentPriceARS(alert.current_price_ars?.toString() ?? '');
    setEditCurrentPriceUSD(alert.current_price_usd?.toString() ?? (alert.market === 'EEUU' ? alert.current_price?.toString() ?? '' : ''));
    setEditShortTermGoal((alert.short_term_goal ?? alert.three_months_goal)?.toString() ?? '');
    setEditLongTermGoal(alert.long_term_goal?.toString() ?? '');
    // Preserve 'Refrain' as a locked value; convert other non-update actions to 'Hold'
    const toUpdateAction = (v: ProfileAction): ProfileAction => {
      if (v === 'Refrain') return 'Refrain'; // locked — cannot be changed in updates
      return (['Double', 'Hold', 'Close', 'Keep Out'] as ProfileAction[]).includes(v) ? v : 'Hold';
    };
    setEditActionConservative(toUpdateAction(alert.action_conservative));
    setEditActionModerate(toUpdateAction(alert.action_moderate));
    setEditActionAggressive(toUpdateAction(alert.action_aggressive));
    setEditActionUltraAggressive(toUpdateAction(alert.action_ultra_aggressive ?? 'Hold'));

    setEditAlertDetails(alert.alert_details ?? '');
    setEditAlertDetailEn(alert.alert_detail_en ?? '');
    setShowUpdateModal(true);
  };

  const handleUpdateAlert = async () => {
    if (!editingAlert) return;
    setUpdatingAlert(true);
    const { hasARS, hasUSD } = getAlertMarkets(editingAlert);
    // If the original action was 'Refrain', it is locked and cannot be changed
    const payload: UpdateAlertPayload = {
      current_price_ars: hasARS && editCurrentPriceARS ? parseFloat(editCurrentPriceARS) : null,
      current_price_usd: hasUSD && editCurrentPriceUSD ? parseFloat(editCurrentPriceUSD) : null,
      short_term_goal: editShortTermGoal ? parseFloat(editShortTermGoal) : null,
      long_term_goal: editLongTermGoal ? parseFloat(editLongTermGoal) : null,
      action_conservative: editingAlert.action_conservative === 'Refrain' ? 'Refrain' : editActionConservative,
      action_moderate: editingAlert.action_moderate === 'Refrain' ? 'Refrain' : editActionModerate,
      action_aggressive: editingAlert.action_aggressive === 'Refrain' ? 'Refrain' : editActionAggressive,
      action_ultra_aggressive: (editingAlert.action_ultra_aggressive ?? 'Refrain') === 'Refrain' ? 'Refrain' : editActionUltraAggressive,

      alert_details: editAlertDetails.trim() || null,
      alert_detail_en: editAlertDetailEn.trim() || null,
    };
    const { error } = await alertService.updateAlert(editingAlert.id, payload, editingAlert, true, notificationsEnabled);
    setUpdatingAlert(false);
    if (error) { showAlert(t('error'), error); return; }
    setShowUpdateModal(false);
    setEditingAlert(null);
    loadAlerts();
    showAlert(t('success'), t('alertUpdatedSuccess'));
  };

  const openCloseModal = (alert: AlertType) => {
    setClosingAlertTarget(alert);
    const { hasARS, hasUSD } = getAlertMarkets(alert);
    setClosePriceARS(hasARS ? (alert.current_price_ars?.toString() ?? '') : '');
    setClosePriceUSD(hasUSD ? (alert.current_price_usd?.toString() ?? alert.current_price?.toString() ?? '') : '');
    setShowCloseModal(true);
  };

  const handleCloseAlert = async () => {
    if (!closingAlertTarget) return;
    setClosingAlert(true);
    const payload: CloseAlertPayload = {
      closing_price_ars: closePriceARS ? parseFloat(closePriceARS) : null,
      closing_price_usd: closePriceUSD ? parseFloat(closePriceUSD) : null,
    };
    const { error } = await alertService.closeAlert(closingAlertTarget.id, payload, closingAlertTarget, true, notificationsEnabled);
    setClosingAlert(false);
    if (error) { showAlert(t('error'), error); return; }
    setShowCloseModal(false);
    setClosingAlertTarget(null);
    setClosePriceARS(''); setClosePriceUSD('');
    loadAlerts();
    showAlert(t('success'), t('alertClosedSuccess'));
  };

  const handleDeleteAlert = (alert: AlertType) => {
    Alert.alert(
      `${t('confirmDeleteAlert')} ${alert.ticker}?`,
      language === 'es' ? 'Esta acción no se puede deshacer.' : 'This action cannot be undone.',
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('delete'), style: 'destructive', onPress: async () => {
          const { error } = await alertService.deleteAlert(alert.id);
          if (error) { showAlert(t('error'), error); return; }
          loadAlerts();
          showAlert(t('success'), t('alertDeletedSuccess'));
        }},
      ]
    );
  };

  const handleExportAlerts = async () => {
    try {
      setExportingAlerts(true);
      const rows = displayAlerts.length > 0
        ? displayAlerts.map((a) => ({
            'Ticker': a.ticker,
            'Target Accounts': a.target_accounts,
            'Alert Condition': a.alert_condition,
            'Entry Price ARS': a.entry_price_ars ?? '',
            'Re-Entry Price ARS': a.re_entry_price_ars ?? '',
            'Current Price ARS': a.current_price_ars ?? '',
            'Closing Price ARS': a.closing_price_ars ?? '',
            'Entry Price USD': a.entry_price_usd ?? '',
            'Re-Entry Price USD': a.re_entry_price_usd ?? '',
            'Current Price USD': a.current_price_usd ?? '',
            'Closing Price USD': a.closing_price_usd ?? '',
            'Short-Term Goal (%)': a.short_term_goal ?? '',
            'Long-Term Goal (%)': a.long_term_goal ?? '',
            'Conservative': a.action_conservative,
            'Moderate': a.action_moderate,
            'Aggressive': a.action_aggressive,
            'Ultra-Aggressive': a.action_ultra_aggressive ?? '',
            'Balanz URL': a.balanz_url ?? '',
            'Alert Details': a.alert_details ?? '',
            'Opening Date': a.opening_date,
            'Closing Date': a.closing_date ?? '',
          }))
        : [{ 'Ticker': '' }];
      await exportToExcel('Alerts', rows, `alerts_${new Date().toISOString().split('T')[0]}.xlsx`);
      setExportingAlerts(false);
    } catch { setExportingAlerts(false); showAlert(t('error'), 'Failed to export alerts.'); }
  };

  const handleShareAlert = async (item: AlertType) => {
    const lang = language;
    const { hasARS, hasUSD } = getAlertMarkets(item);
    const isClosed = item.alert_condition === 'Closed';
    const isUpdated = !isClosed && (item.current_price_ars != null || item.current_price_usd != null);
    const stGoal = item.short_term_goal ?? item.three_months_goal;
    // balanz_url_arg from TickerNames (enriched at fetch time)
    const balanzLink = item.balanz_url_arg ?? null;

    // Raw number formatters (no currency prefix — prefix is added inline)
    const numARS = (val: number) =>
      val.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    const numUSD = (val: number) =>
      val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const profileActionLabel = (a: string) => {
      switch (a) {
        case 'Buy': return lang === 'es' ? 'Comprar' : 'Buy';
        case 'Sell': return lang === 'es' ? 'Vender' : 'Sell';
        case 'Double': return 'Double';
        case 'Hold': return 'Hold';
        case 'Close': return 'Close';
        case 'Keep Out': return 'Keep Out';
        default: return lang === 'es' ? 'Abstenerse' : 'Refrain';
      }
    };

    const termLabel = item.term === 'Short'
      ? (lang === 'es' ? 'Corto Plazo' : 'Short-Term')
      : (lang === 'es' ? 'Largo Plazo' : 'Long-Term');

    // Entry price line: (*1) combined if both currencies, (*2) ARS-only otherwise
    const entryLine = (): string | null => {
      if (hasUSD && item.entry_price_usd != null) {
        const arsRef = hasARS && item.entry_price_ars != null
          ? ` (referencia CEDEAR: AR$ ${numARS(item.entry_price_ars)})`
          : '';
        return `💱 ${lang === 'es' ? 'Precio de Entrada' : 'Entry Price'}: US$ ${numUSD(item.entry_price_usd)}${arsRef}`;
      }
      if (hasARS && item.entry_price_ars != null) {
        return `💱 ${lang === 'es' ? 'Precio de Entrada' : 'Entry Price'}: AR$ ${numARS(item.entry_price_ars)}`;
      }
      return null;
    };

    // Re-entry price line: same (*1)/(*2) logic
    const reEntryLine = (): string | null => {
      if (hasUSD && item.re_entry_price_usd != null) {
        const arsRef = hasARS && item.re_entry_price_ars != null
          ? ` (referencia CEDEAR: AR$ ${numARS(item.re_entry_price_ars)})`
          : '';
        return `💱 ${lang === 'es' ? 'Precio Re-Entrada' : 'Re-entry Price'}: US$ ${numUSD(item.re_entry_price_usd)}${arsRef}`;
      }
      if (hasARS && item.re_entry_price_ars != null) {
        return `💱 ${lang === 'es' ? 'Precio Re-Entrada' : 'Re-entry Price'}: AR$ ${numARS(item.re_entry_price_ars)}`;
      }
      return null;
    };

    // Current price line for updates
    const currentPriceLine = (): string | null => {
      if (hasUSD && item.current_price_usd != null) {
        const arsRef = hasARS && item.current_price_ars != null
          ? ` (referencia CEDEAR: AR$ ${numARS(item.current_price_ars)})`
          : '';
        return `💱 ${lang === 'es' ? 'Precio Actual' : 'Current Price'}: US$ ${numUSD(item.current_price_usd)}${arsRef}`;
      }
      if (hasARS && item.current_price_ars != null) {
        return `💱 ${lang === 'es' ? 'Precio Actual' : 'Current Price'}: AR$ ${numARS(item.current_price_ars)}`;
      }
      return null;
    };

    // Closing price line for closed alerts
    const closingPriceLine = (): string | null => {
      if (hasUSD && item.closing_price_usd != null) {
        const arsRef = hasARS && item.closing_price_ars != null
          ? ` (referencia CEDEAR: AR$ ${numARS(item.closing_price_ars)})`
          : '';
        return `💱 ${lang === 'es' ? 'Precio de Cierre' : 'Closing Price'}: US$ ${numUSD(item.closing_price_usd)}${arsRef}`;
      }
      if (hasARS && item.closing_price_ars != null) {
        return `💱 ${lang === 'es' ? 'Precio de Cierre' : 'Closing Price'}: AR$ ${numARS(item.closing_price_ars)}`;
      }
      return null;
    };

    const compact = (arr: (string | null)[]): string[] => arr.filter((l): l is string => l != null);

    let lines: string[];

    if (isClosed) {
      lines = compact([
        `🚨 ${lang === 'es' ? 'Alerta de Cierre' : 'Closing Alert'}: ${item.ticker}${item.ticker_name ? ` (${item.ticker_name})` : ''}`,
        `🗓️ ${lang === 'es' ? 'Plazo' : 'Term'}: ${termLabel}`,
        entryLine(),
        closingPriceLine(),
        stGoal != null ? `🎯 ${lang === 'es' ? 'Meta Corto Plazo' : 'Short-Term Goal'}: ${Math.round(stGoal)}%` : null,
        item.long_term_goal != null ? `🎯 ${lang === 'es' ? 'Meta Largo Plazo' : 'Long-Term Goal'}: ${Math.round(item.long_term_goal)}%` : null,
        balanzLink ? `🔗 ${lang === 'es' ? 'Operar con Balanz' : 'Trade with Balanz'}: ${balanzLink}` : null,
        item.alert_details ? `✉️ ${lang === 'es' ? 'Detalles' : 'Alert Details'}: ${item.alert_details}` : null,
      ]);
    } else if (isUpdated) {
      lines = compact([
        `🚨 ${lang === 'es' ? 'Actualización' : 'Update'}: ${item.ticker}${item.ticker_name ? ` (${item.ticker_name})` : ''}`,
        `🗓️ ${lang === 'es' ? 'Plazo' : 'Term'}: ${termLabel}`,
        `👴🏻 ${lang === 'es' ? 'Conservador' : 'Conservative'}: ${profileActionLabel(item.action_conservative)}`,
        `👩‍🌾 ${lang === 'es' ? 'Moderado' : 'Moderate'}: ${profileActionLabel(item.action_moderate)}`,
        `👽 ${lang === 'es' ? 'Agresivo' : 'Aggressive'}: ${profileActionLabel(item.action_aggressive)}`,
        `🛸 Ultra-${lang === 'es' ? 'Agresivo' : 'Aggressive'}: ${profileActionLabel(item.action_ultra_aggressive ?? 'Refrain')}`,
        currentPriceLine(),
        stGoal != null ? `🎯 ${lang === 'es' ? 'Meta Corto Plazo' : 'Short-Term Goal'}: ${Math.round(stGoal)}%` : null,
        item.long_term_goal != null ? `🎯 ${lang === 'es' ? 'Meta Largo Plazo' : 'Long-Term Goal'}: ${Math.round(item.long_term_goal)}%` : null,
        balanzLink ? `🔗 ${lang === 'es' ? 'Operar con Balanz' : 'Trade with Balanz'}: ${balanzLink}` : null,
        item.alert_details ? `✉️ ${lang === 'es' ? 'Detalles' : 'Alert Details'}: ${item.alert_details}` : null,
      ]);
    } else {
      lines = compact([
        `🚨 ${lang === 'es' ? 'Nueva Alerta' : 'New Alert'}: ${item.ticker}${item.ticker_name ? ` (${item.ticker_name})` : ''}`,
        `🗓️ ${lang === 'es' ? 'Plazo' : 'Term'}: ${termLabel}`,
        `👴🏻 ${lang === 'es' ? 'Conservador' : 'Conservative'}: ${profileActionLabel(item.action_conservative)}`,
        `👩‍🌾 ${lang === 'es' ? 'Moderado' : 'Moderate'}: ${profileActionLabel(item.action_moderate)}`,
        `👽 ${lang === 'es' ? 'Agresivo' : 'Aggressive'}: ${profileActionLabel(item.action_aggressive)}`,
        `🛸 Ultra-${lang === 'es' ? 'Agresivo' : 'Aggressive'}: ${profileActionLabel(item.action_ultra_aggressive ?? 'Refrain')}`,
        entryLine(),
        reEntryLine(),
        stGoal != null ? `🎯 ${lang === 'es' ? 'Meta Corto Plazo' : 'Short-Term Goal'}: ${Math.round(stGoal)}%` : null,
        item.long_term_goal != null ? `🎯 ${lang === 'es' ? 'Meta Largo Plazo' : 'Long-Term Goal'}: ${Math.round(item.long_term_goal)}%` : null,
        balanzLink ? `🔗 ${lang === 'es' ? 'Operar con Balanz' : 'Trade with Balanz'}: ${balanzLink}` : null,
        item.alert_details ? `✉️ ${lang === 'es' ? 'Detalles' : 'Alert Details'}: ${item.alert_details}` : null,
      ]);
    }

    const message = lines.join('\n');
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showAlert(t('error'), 'WhatsApp is not installed on this device.');
      }
    } catch {
      showAlert(t('error'), 'Could not open WhatsApp.');
    }
  };

  // ─── Ticker Names handlers ────────────────────────────────────────────────

  const loadTickerNames = useCallback(async () => {
    setLoadingNames(true);
    const { data, error } = await tickerNameService.getAllTickerNames();
    if (error) showAlert(t('error'), error);
    else if (data) setTickerNames(data);
    setLoadingNames(false);
    setRefreshing(false);
  }, []);

  const handleSaveName = async () => {
    if (!newNameTicker.trim() || !newNameValue.trim()) { showAlert(t('error'), 'Ticker and Name are required'); return; }
    setSavingName(true);
    const { error } = await tickerNameService.upsertTickerName(
      newNameTicker.trim(),
      newNameValue.trim(),
      newNameBalanzUrlArg.trim() || null,
      newNameBalanzUrlUsa.trim() || null
    );
    setSavingName(false);
    if (error) { showAlert(t('error'), error); return; }
    setShowAddNameModal(false);
    setNewNameTicker(''); setNewNameValue(''); setNewNameBalanzUrlArg(''); setNewNameBalanzUrlUsa('');
    loadTickerNames(); loadAlerts();
    showAlert(t('success'), 'Name saved successfully');
  };

  const handleUpdateName = async () => {
    if (!editingName || !newNameValue.trim()) { showAlert(t('error'), 'Name is required'); return; }
    setSavingName(true);
    const { error } = await tickerNameService.upsertTickerName(
      editingName.ticker,
      newNameValue.trim(),
      newNameBalanzUrlArg.trim() || null,
      newNameBalanzUrlUsa.trim() || null
    );
    setSavingName(false);
    if (error) { showAlert(t('error'), error); return; }
    setShowEditNameModal(false); setEditingName(null); setNewNameValue(''); setNewNameBalanzUrlArg(''); setNewNameBalanzUrlUsa('');
    loadTickerNames(); loadAlerts();
    showAlert(t('success'), 'Name updated successfully');
  };

  const handleDeleteName = (item: TickerName) => {
    Alert.alert('Delete Name', `Remove name for ${item.ticker}?`, [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        const { error } = await tickerNameService.deleteTickerName(item.id);
        if (error) { showAlert(t('error'), error); return; }
        loadTickerNames(); loadAlerts();
      }},
    ]);
  };

  const handleExportNames = async () => {
    try {
      setExportingNames(true);
      const rows = tickerNames.length > 0
        ? tickerNames.map((n) => ({
            'Ticker': n.ticker,
            'Name': n.name,
            'Balanz URL (ARG)': n.balanz_url_arg ?? '',
            'Balanz URL (USA)': n.balanz_url_usa ?? '',
          }))
        : [{ 'Ticker': '', 'Name': '', 'Balanz URL (ARG)': '', 'Balanz URL (USA)': '' }];
      await exportToExcel('Ticker Names', rows, `ticker_names_${new Date().toISOString().split('T')[0]}.xlsx`);
      setExportingNames(false);
    } catch { setExportingNames(false); showAlert(t('error'), 'Failed to export.'); }
  };

  const handleImportNames = async () => {
    try {
      setImportingNames(true);
      const data = await importFromExcel();
      if (!data) { setImportingNames(false); return; }
      const namesData: Array<{ ticker: string; name: string; balanz_url_arg?: string | null; balanz_url_usa?: string | null }> = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 2) continue;
        const ticker = row[0]?.toString().trim().toUpperCase();
        const name = row[1]?.toString().trim();
        if (!ticker || !name) continue;
        const balanz_url_arg = row[2]?.toString().trim() || null;
        const balanz_url_usa = row[3]?.toString().trim() || null;
        namesData.push({ ticker, name, balanz_url_arg, balanz_url_usa });
      }
      if (namesData.length === 0) { setImportingNames(false); showAlert(t('error'), 'No valid data found. Columns: ticker | name | Balanz URL (ARG) | Balanz URL (USA)'); return; }
      const { successCount, failedCount, errors } = await tickerNameService.batchImportTickerNames(namesData);
      setImportingNames(false);
      if (errors.length > 0) {
        Alert.alert(t('importResultsTitle'), `Imported: ${successCount}\nFailed: ${failedCount}\n\nErrors:\n${errors.slice(0, 5).join('\n')}`, [{ text: 'OK', onPress: () => { loadTickerNames(); loadAlerts(); } }]);
      } else {
        showAlert(t('success'), `Imported ${successCount} ticker names!`);
        loadTickerNames(); loadAlerts();
      }
    } catch { setImportingNames(false); showAlert(t('error'), 'Failed to import file.'); }
  };

  // ─── Accounts handlers ────────────────────────────────────────────────────

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    const { data, error } = await accountService.getAllManagedAccounts();
    if (error) showAlert(t('error'), error);
    else if (data) setAccounts(data as ManagedAccount[]);
    setLoadingAccounts(false);
    setRefreshing(false);
  }, []);

  const handleToggleNewAffiliates = async (account: ManagedAccount) => {
    if (!userIsDev) return;
    const newValue = account.new_affiliates === true ? false : true;
    setTogglingNewAffiliates(account.email);
    const { error } = await accountService.updateNewAffiliates(account.email, newValue);
    setTogglingNewAffiliates(null);
    if (error) { showAlert(t('error'), error); return; }
    setAccounts((prev) =>
      prev.map((a) => a.email === account.email ? { ...a, new_affiliates: newValue } : a)
    );
  };

  const handleAddAccount = async () => {
    if (!newAccountEmail.trim()) { showAlert(t('error'), 'Please enter an email address'); return; }
    const emailLower = newAccountEmail.trim().toLowerCase();
    if (userIsAdmin && !['Free', 'Affiliate'].includes(newAccountType)) { showAlert(t('error'), 'Admins can only create Free or Affiliate accounts'); return; }
    setSavingAccount(true);
    const { error } = await accountService.upsertAccount(emailLower, newAccountType);
    setSavingAccount(false);
    if (error) { showAlert(t('error'), error); return; }
    setShowAddAccountModal(false); setNewAccountEmail(''); setNewAccountType('Affiliate');
    loadAccounts();
    showAlert(t('success'), t('accountAddedSuccess'));
  };

  const handleUpdateAccount = async () => {
    if (!editingAccount) return;
    const editableTypes = getEditableTypesForAccount(editingAccount);
    if (editableTypes.length === 0) {
      showAlert(t('error'), language === 'es' ? 'No tienes permisos para editar esta cuenta.' : 'You do not have permission to edit this account.');
      return;
    }
    if (!editableTypes.includes(newAccountType)) {
      showAlert(t('error'), language === 'es' ? 'Tipo de cuenta no permitido.' : 'Account type not allowed.');
      return;
    }
    setSavingAccount(true);
    const { error } = await accountService.upsertAccount(editingAccount.email, newAccountType);
    setSavingAccount(false);
    if (error) { showAlert(t('error'), error); return; }
    setShowEditAccountModal(false); setEditingAccount(null);
    loadAccounts();
    showAlert(t('success'), t('accountUpdatedSuccess'));
  };

  const handleDeleteAccount = (account: ManagedAccount) => {
    if (userIsAdmin && (account.account_type === 'Dev' || account.account_type === 'Admin')) {
      showAlert(t('error'), 'Admins can only remove Free or Affiliate accounts');
      return;
    }
    Alert.alert(`${t('confirmDeleteAccount2')} ${account.email}?`, t('confirmDeleteAccountMsg'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('delete'), style: 'destructive', onPress: async () => {
        const { error } = await accountService.deleteAccount(account.email);
        if (error) { showAlert(t('error'), error); return; }
        loadAccounts();
        showAlert(t('success'), t('accountDeletedSuccess'));
      }},
    ]);
  };

  const handleExportAccounts = async () => {
    try {
      setExportingAccounts(true);
      const rows = accounts.length > 0
        ? accounts.map((a) => ({
            'email': a.email,
            'account_type': a.account_type,
            'new_affiliates': a.new_affiliates === null ? '' : a.new_affiliates ? 'TRUE' : 'FALSE',
          }))
        : [{ 'email': '', 'account_type': '', 'new_affiliates': '' }];
      await exportToExcel('Accounts', rows, `accounts_${new Date().toISOString().split('T')[0]}.xlsx`);
      setExportingAccounts(false);
    } catch { setExportingAccounts(false); showAlert(t('error'), 'Failed to export accounts.'); }
  };

  const handleBatchImportAccounts = async () => {
    try {
      setImportingAccounts(true);
      const data = await importFromExcel();
      if (!data) { setImportingAccounts(false); return; }
      const accountsData: Array<{ email: string; account_type: AccountType }> = [];
      const newAffiliatesUpdates: Array<{ email: string; new_affiliates: boolean | null }> = [];
      const validTypes = userIsDev ? ['Affiliate', 'Admin', 'Free'] : ['Affiliate', 'Free'];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 2) continue;
        const email = row[0]?.toString().trim().toLowerCase();
        const type = row[1]?.toString().trim();
        if (!email || !type || !validTypes.includes(type)) continue;
        accountsData.push({ email, account_type: type as AccountType });
        if (userIsDev && row.length >= 3) {
          const rawNA = row[2]?.toString().trim().toUpperCase();
          if (rawNA === 'TRUE' || rawNA === '1') {
            newAffiliatesUpdates.push({ email, new_affiliates: true });
          } else if (rawNA === 'FALSE' || rawNA === '0') {
            newAffiliatesUpdates.push({ email, new_affiliates: false });
          }
        }
      }
      if (accountsData.length === 0) { setImportingAccounts(false); showAlert(t('error'), 'No valid data. Columns: email | account_type | new_affiliates (optional)'); return; }
      const { successCount, failedCount, errors } = await accountService.batchUpsertAccounts(accountsData);
      if (userIsDev && newAffiliatesUpdates.length > 0) {
        await accountService.batchUpdateNewAffiliates(newAffiliatesUpdates);
      }
      setImportingAccounts(false);
      if (errors.length > 0) {
        Alert.alert(t('importResultsTitle'), `Imported: ${successCount}\nFailed: ${failedCount}\n\nErrors:\n${errors.slice(0, 5).join('\n')}`, [{ text: 'OK', onPress: () => loadAccounts() }]);
      } else {
        showAlert(t('success'), `Processed ${successCount} accounts!`);
        loadAccounts();
      }
    } catch { setImportingAccounts(false); showAlert(t('error'), 'Failed to import file.'); }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString(language === 'es' ? 'es-AR' : 'en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

  const getYieldColor = (y: number | null) => {
    if (y == null) return colors.textSecondary;
    return y >= 0 ? colors.bullish : colors.bearish;
  };

  const getConditionColor = (cond: string) => cond === 'Current' ? colors.bullish : colors.textSecondary;

  const getProfileActionLabel = (a: string) => {
    switch (a) {
      case 'Buy': return t('actionBuy');
      case 'Sell': return t('actionSell');
      case 'Double': return 'Double';
      case 'Hold': return 'Hold';
      case 'Close': return 'Close';
      case 'Keep Out': return 'Keep Out';
      default: return t('actionRefrain');
    }
  };

  const getProfileActionColor = (a: string) => {
    if (a === 'Buy' || a === 'Double') return colors.bullish;
    if (a === 'Sell' || a === 'Close') return colors.bearish;
    return colors.textSecondary;
  };

  const getAccountTypeBadgeColor = (type: AccountType) => {
    switch (type) {
      case 'Dev': return colors.primary;
      case 'Admin': return '#9C27B0';
      case 'Affiliate': return colors.success;
      default: return colors.textSecondary;
    }
  };

  // ─── ProfileAction slider ─────────────────────────────────────────────────

  const renderProfileActionSlider = (
    label: string,
    value: ProfileAction,
    onChange: (v: ProfileAction) => void,
    actions: ProfileAction[] = UPDATE_PROFILE_ACTIONS,
    locked: boolean = false
  ) => (
    <View style={styles.sliderGroup} key={label}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {locked ? (
        <View style={[styles.lockedActionRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialIcons name="lock" size={14} color={colors.textTertiary} />
          <Text style={[styles.lockedActionText, { color: colors.textTertiary }]}>
            {getProfileActionLabel('Refrain')} ({language === 'es' ? 'bloqueado' : 'locked'})
          </Text>
        </View>
      ) : (
        <View style={styles.sliderRow}>
          {actions.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[
                styles.sliderOption,
                { backgroundColor: colors.card, borderColor: colors.border },
                value === opt && { backgroundColor: getProfileActionColor(opt), borderColor: getProfileActionColor(opt) },
              ]}
              onPress={() => onChange(opt)}
            >
              <Text style={[styles.sliderOptionText, { color: value === opt ? '#fff' : colors.textSecondary }]}>
                {getProfileActionLabel(opt)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  // ─── Alert list item (config view — admin/dev) ────────────────────────────

  const renderAlertItem = ({ item }: { item: AlertType }) => {
    const { hasARS, hasUSD } = getAlertMarkets(item);
    const isClosed = item.alert_condition === 'Closed';
    const arsYield = hasARS ? calculateYieldForMarket(item, 'ARS') : null;
    const usdYield = hasUSD ? calculateYieldForMarket(item, 'USD') : null;
    const displayYield = hasUSD ? usdYield : arsYield;
    const stGoal = item.short_term_goal ?? item.three_months_goal;

    const resolvedBalanzUrl: string | null = (() => {
      const argUrl = item.balanz_url_arg?.trim() || null;
      const usaUrl = item.balanz_url_usa?.trim() || null;
      const legacyUrl = item.balanz_url?.trim() || null;
      return argUrl || usaUrl || legacyUrl;
    })();
    const hasResolvedBalanzUrl = Boolean(resolvedBalanzUrl);
    const hasAlertDetails = item.alert_details != null && item.alert_details.trim().length > 0;

    const handleBalanzLink = async () => {
      if (!resolvedBalanzUrl) return;
      try {
        const canOpen = await Linking.canOpenURL(resolvedBalanzUrl);
        if (canOpen) await Linking.openURL(resolvedBalanzUrl);
      } catch {}
    };

    const formatPercent = (val: number | null) => {
      if (val == null) return null;
      const sign = val >= 0 ? '+' : '';
      return `${sign}${val.toFixed(2)}%`;
    };

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>

        {/* ── Header ── */}
        <View style={styles.cardHeader}>
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
            <View style={[styles.miniChip, {
              backgroundColor: item.target_accounts === 'Subscribers' ? `${colors.primary}15` : `${colors.textSecondary}12`,
              borderColor: item.target_accounts === 'Subscribers' ? `${colors.primary}40` : colors.border,
            }]}>
              <MaterialIcons
                name={item.target_accounts === 'Subscribers' ? 'star' : 'public'}
                size={11}
                color={item.target_accounts === 'Subscribers' ? colors.primary : colors.textSecondary}
              />
              <Text style={[styles.miniChipText, { color: item.target_accounts === 'Subscribers' ? colors.primary : colors.textSecondary }]}>
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
        {hasARS && (
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
        {hasUSD && (
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
              {stGoal != null ? `${Math.round(stGoal)}%` : '-'}
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

        {/* ── Profile actions row (full labels, matching AlertCard) ── */}
        <View style={[styles.profileActionsRow, { borderTopColor: colors.border }]}>
          {[
            { key: 'action_conservative', label: language === 'es' ? 'Conserv.' : 'Conservative' },
            { key: 'action_moderate', label: language === 'es' ? 'Moderado' : 'Moderate' },
            { key: 'action_aggressive', label: language === 'es' ? 'Agresivo' : 'Aggressive' },
            { key: 'action_ultra_aggressive', label: language === 'es' ? 'Ultra-Agres.' : 'Ultra-Aggr.' },
          ].map(({ key, label }) => {
            const val = (item[key as keyof AlertType] as string) ?? 'Refrain';
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

        {/* ── Bottom bar: Balanz + Alert Details (matching AlertCard) ── */}
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
              onPress={hasAlertDetails ? () => { setDetailsAlert(item); setShowDetailsModal(true); } : undefined}
              disabled={!hasAlertDetails}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={{ fontSize: 22 }}>✉️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Action buttons ── */}
        <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
          {!isClosed && (
            <TouchableOpacity
              style={[styles.cardActionBtn, { flex: 1, backgroundColor: `${colors.primary}15`, borderColor: `${colors.primary}30` }]}
              onPress={() => openUpdateModal(item)}
            >
              <MaterialIcons name="edit" size={16} color={colors.primary} />
              <Text style={[styles.cardActionText, { color: colors.primary }]}>{t('update')}</Text>
            </TouchableOpacity>
          )}
          {!isClosed && (
            <TouchableOpacity
              style={[styles.cardActionBtn, { flex: 1, backgroundColor: `${colors.warning ?? '#f59e0b'}15`, borderColor: `${colors.warning ?? '#f59e0b'}30` }]}
              onPress={() => openCloseModal(item)}
            >
              <MaterialIcons name="lock" size={16} color={colors.warning ?? '#f59e0b'} />
              <Text style={[styles.cardActionText, { color: colors.warning ?? '#f59e0b' }]}>{t('close')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.cardActionBtn, { flex: 1, backgroundColor: `${colors.error}12`, borderColor: `${colors.error}30` }]}
            onPress={() => handleDeleteAlert(item)}
          >
            <MaterialIcons name="delete" size={16} color={colors.error} />
            <Text style={[styles.cardActionText, { color: colors.error }]}>{t('delete')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cardActionBtn, { flex: 1, backgroundColor: '#25D36615', borderColor: '#25D36630' }]}
            onPress={() => handleShareAlert(item)}
          >
            <MaterialIcons name="share" size={16} color="#25D366" />
            <Text style={[styles.cardActionText, { color: '#25D366' }]}>Share</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderNameItem = ({ item }: { item: TickerName }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.ticker, { color: colors.text }]}>{item.ticker}</Text>
          <Text style={[styles.tickerName, { color: colors.textSecondary }]}>{item.name}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TouchableOpacity
            onPress={() => {
              setEditingName(item);
              setNewNameValue(item.name);
              setNewNameBalanzUrlArg(item.balanz_url_arg ?? '');
              setNewNameBalanzUrlUsa(item.balanz_url_usa ?? '');
              setShowEditNameModal(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="edit" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteName(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="delete" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      {(item.balanz_url_arg || item.balanz_url_usa) && (
        <View style={[styles.nameUrlRow, { borderTopColor: colors.border }]}>
          {item.balanz_url_arg ? (
            <TouchableOpacity
              style={[styles.nameUrlChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}
              onPress={() => Linking.openURL(item.balanz_url_arg!)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialIcons name="link" size={13} color={colors.primary} />
              <Text style={[styles.nameUrlChipText, { color: colors.primary }]}>Balanz AR$</Text>
            </TouchableOpacity>
          ) : null}
          {item.balanz_url_usa ? (
            <TouchableOpacity
              style={[styles.nameUrlChip, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}
              onPress={() => Linking.openURL(item.balanz_url_usa!)}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <MaterialIcons name="link" size={13} color={colors.primary} />
              <Text style={[styles.nameUrlChipText, { color: colors.primary }]}>Balanz US$</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </View>
  );

  const renderAccountItem = ({ item }: { item: ManagedAccount }) => {
    const badgeColor = getAccountTypeBadgeColor(item.account_type);
    const canEdit = userIsDev || (userIsAdmin && item.account_type !== 'Dev' && item.account_type !== 'Admin');
    const isTogglingThis = togglingNewAffiliates === item.email;
    const naValue = item.new_affiliates;
    const naColor = naValue === true ? colors.success : naValue === false ? colors.textSecondary : colors.textTertiary;
    const naLabel = naValue === true ? 'TRUE' : naValue === false ? 'FALSE' : 'N/A';

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={[styles.ticker, { color: colors.text }]} numberOfLines={1}>{item.email}</Text>
            <View style={[styles.accountBadge, { backgroundColor: `${badgeColor}18`, borderColor: `${badgeColor}40` }]}>
              <Text style={[styles.accountBadgeText, { color: badgeColor }]}>{item.account_type}</Text>
            </View>
          </View>
          {canEdit && (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity onPress={() => { setEditingAccount(item); setNewAccountType(item.account_type); setShowEditAccountModal(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="edit" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteAccount(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <MaterialIcons name="delete" size={20} color={colors.error} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={[styles.naRow, { borderTopColor: colors.border }]}>
          <View style={styles.naLeft}>
            <MaterialIcons name="fiber-new" size={16} color={naColor} />
            <Text style={[styles.naLabel, { color: colors.textSecondary }]}>
              {language === 'es' ? 'Nuevo Afiliado' : 'New Affiliate'}
            </Text>
          </View>
          <View style={styles.naRight}>
            <View style={[styles.naBadge, { backgroundColor: `${naColor}15`, borderColor: `${naColor}40` }]}>
              <Text style={[styles.naBadgeText, { color: naColor }]}>{naLabel}</Text>
            </View>
            {userIsDev && (
              isTogglingThis ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />
              ) : (
                <TouchableOpacity
                  onPress={() => handleToggleNewAffiliates(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={{ marginLeft: spacing.sm }}
                >
                  <MaterialIcons
                    name={naValue === true ? 'toggle-on' : 'toggle-off'}
                    size={28}
                    color={naValue === true ? colors.success : colors.textSecondary}
                  />
                </TouchableOpacity>
              )
            )}
          </View>
        </View>
      </View>
    );
  };

  if (!userIsAdmin && !userIsDev) return null;

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const sortOptions: { key: SortType; label: string }[] = [
    { key: 'newestFirst', label: t('newestFirst') },
    { key: 'oldestFirst', label: t('oldestFirst') },
    { key: 'alphabetAZ', label: t('alphabeticalAZ') },
    { key: 'alphabetZA', label: t('alphabeticalZA') },
    { key: 'currentFirst', label: t('currentFirst') },
    { key: 'closedFirst', label: t('closedFirst') },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('configuration')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {activeTab === 'alerts' ? t('manageAlerts') : activeTab === 'names' ? t('tickerNames') : t('manageAccounts')}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {activeTab === 'alerts' && (
            <>
              <TouchableOpacity onPress={handleExportAlerts} style={styles.headerActionButton} disabled={exportingAlerts}>
                {exportingAlerts ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialIcons name="file-download" size={24} color={colors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSortMenu(!showSortMenu)} style={styles.headerActionButton}>
                <MaterialIcons name="sort" size={24} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowCreateModal(true)} style={styles.headerActionButton}>
                <MaterialIcons name="add" size={24} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
          {activeTab === 'names' && userIsDev && (
            <>
              <TouchableOpacity onPress={handleExportNames} style={styles.headerActionButton} disabled={exportingNames}>
                {exportingNames ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialIcons name="file-download" size={24} color={colors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleImportNames} style={styles.headerActionButton} disabled={importingNames}>
                {importingNames ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialIcons name="upload-file" size={24} color={colors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddNameModal(true)} style={styles.headerActionButton}>
                <MaterialIcons name="add" size={24} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
          {activeTab === 'accounts' && (
            <>
              <TouchableOpacity onPress={handleExportAccounts} style={styles.headerActionButton} disabled={exportingAccounts}>
                {exportingAccounts ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialIcons name="file-download" size={24} color={colors.primary} />}
              </TouchableOpacity>
              {userIsDev && (
                <TouchableOpacity onPress={handleBatchImportAccounts} style={styles.headerActionButton} disabled={importingAccounts}>
                  {importingAccounts ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialIcons name="upload-file" size={24} color={colors.primary} />}
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { setNewAccountEmail(''); setNewAccountType('Affiliate'); setShowAddAccountModal(true); }} style={styles.headerActionButton}>
                <MaterialIcons name="add" size={24} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBarScroll, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal={userIsDev}
          scrollEnabled={userIsDev}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.tabBar, !userIsDev && styles.tabBarFull]}
        >
          <TouchableOpacity style={[styles.tab, activeTab === 'alerts' && { borderBottomColor: colors.primary }]} onPress={() => setActiveTab('alerts')}>
            <MaterialIcons name="notifications" size={18} color={activeTab === 'alerts' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === 'alerts' ? colors.primary : colors.textSecondary }]}>{t('myAlerts')}</Text>
          </TouchableOpacity>
          {userIsDev && (
            <TouchableOpacity style={[styles.tab, activeTab === 'names' && { borderBottomColor: colors.primary }]} onPress={() => setActiveTab('names')}>
              <MaterialIcons name="label" size={18} color={activeTab === 'names' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === 'names' ? colors.primary : colors.textSecondary }]}>{t('tickerNames')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.tab, activeTab === 'accounts' && { borderBottomColor: colors.primary }]} onPress={() => setActiveTab('accounts')}>
            <MaterialIcons name="manage-accounts" size={18} color={activeTab === 'accounts' ? colors.primary : colors.textSecondary} />
            <Text style={[styles.tabText, { color: activeTab === 'accounts' ? colors.primary : colors.textSecondary }]}>{t('accountsManagement')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Search bars */}
      {activeTab === 'alerts' && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <MaterialIcons name="search" size={20} color={colors.textSecondary} />
          <TextInput style={[styles.searchInput, { color: colors.text }]} value={alertSearch} onChangeText={setAlertSearch}
            placeholder={language === 'es' ? 'Buscar ticker...' : 'Search ticker...'} placeholderTextColor={colors.textTertiary}
            autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" />
          {alertSearch.length > 0 && (
            <TouchableOpacity onPress={() => setAlertSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}
      {activeTab === 'names' && userIsDev && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <MaterialIcons name="search" size={20} color={colors.textSecondary} />
          <TextInput style={[styles.searchInput, { color: colors.text }]} value={namesSearch} onChangeText={setNamesSearch}
            placeholder={language === 'es' ? 'Buscar...' : 'Search...'} placeholderTextColor={colors.textTertiary}
            autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" />
          {namesSearch.length > 0 && (
            <TouchableOpacity onPress={() => setNamesSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}
      {activeTab === 'accounts' && (
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <MaterialIcons name="search" size={20} color={colors.textSecondary} />
          <TextInput style={[styles.searchInput, { color: colors.text }]} value={accountSearch} onChangeText={setAccountSearch}
            placeholder={language === 'es' ? 'Buscar...' : 'Search...'} placeholderTextColor={colors.textTertiary}
            autoCapitalize="none" autoCorrect={false} clearButtonMode="while-editing" />
          {accountSearch.length > 0 && (
            <TouchableOpacity onPress={() => setAccountSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Sort menu */}
      {activeTab === 'alerts' && showSortMenu && (
        <View style={[styles.sortMenu, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          {sortOptions.map(({ key, label }) => (
            <TouchableOpacity key={key} style={styles.sortOption} onPress={() => { setSortType(key); setShowSortMenu(false); }}>
              <Text style={[styles.sortOptionText, { color: colors.text }]}>{label}</Text>
              {sortType === key && <MaterialIcons name="check" size={20} color={colors.primary} />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Alerts tab */}
      {activeTab === 'alerts' && (
        displayAlerts.length === 0 ? (
          <ScrollView contentContainerStyle={styles.emptyState} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
            <MaterialIcons name="notifications-none" size={64} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{alertSearch ? (language === 'es' ? 'Sin resultados' : 'No results') : t('noAlertsConfigured')}</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{alertSearch ? '' : t('addAlertsToStart')}</Text>
          </ScrollView>
        ) : (
          <FlatList
            data={displayAlerts}
            renderItem={renderAlertItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          />
        )
      )}

      {/* Ticker Names tab */}
      {activeTab === 'names' && userIsDev && (
        loadingNames ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (() => {
          const filtered = namesSearch.trim()
            ? tickerNames.filter((n) => n.ticker.toLowerCase().includes(namesSearch.trim().toLowerCase()) || n.name.toLowerCase().includes(namesSearch.trim().toLowerCase()))
            : tickerNames;
          return filtered.length === 0 ? (
            <ScrollView contentContainerStyle={styles.emptyState} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
              <MaterialIcons name="label-off" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('noTickerNames')}</Text>
            </ScrollView>
          ) : (
            <FlatList data={filtered} renderItem={renderNameItem} keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />} />
          );
        })()
      )}

      {/* Accounts tab */}
      {activeTab === 'accounts' && (
        loadingAccounts ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : (() => {
          const filtered = accountSearch.trim()
            ? accounts.filter((a) => a.email.toLowerCase().includes(accountSearch.trim().toLowerCase()) || a.account_type.toLowerCase().includes(accountSearch.trim().toLowerCase()))
            : accounts;
          return filtered.length === 0 ? (
            <ScrollView contentContainerStyle={styles.emptyState} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}>
              <MaterialIcons name="group-off" size={64} color={colors.textTertiary} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>{t('noAccountsConfigured')}</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{t('addAccountsToStart')}</Text>
            </ScrollView>
          ) : (
            <FlatList data={filtered} renderItem={renderAccountItem} keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />} />
          );
        })()
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CREATE ALERT MODAL — 14-field new unified format
          ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => { setShowCreateModal(false); resetCreateForm(); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('addNewAlert')}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* 1. Ticker */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('ticker')} *</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newTicker} onChangeText={setNewTicker} placeholder="e.g., AAPL"
                  placeholderTextColor={colors.textTertiary} autoCapitalize="characters" autoCorrect={false} />
              </View>

              {/* 2. Term */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Plazo *' : 'Term *'}
                </Text>
                <View style={styles.sliderRow}>
                  {(['Short', 'Long'] as AlertTerm[]).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.sliderOption,
                        { backgroundColor: colors.card, borderColor: colors.border },
                        newTerm === opt && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setNewTerm(opt)}
                    >
                      <Text style={[styles.sliderOptionText, { color: newTerm === opt ? '#fff' : colors.textSecondary }]}>
                        {opt === 'Short' ? (language === 'es' ? 'Corto' : 'Short') : (language === 'es' ? 'Largo' : 'Long')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 3. Target Accounts */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('targetAccounts')} *</Text>
                <View style={styles.sliderRow}>
                  {(['Subscribers', 'Free-Accounts'] as TargetAccounts[]).map((opt) => (
                    <TouchableOpacity key={opt}
                      style={[styles.sliderOption, { backgroundColor: colors.card, borderColor: colors.border }, newTargetAccounts === opt && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => setNewTargetAccounts(opt)}>
                      <Text style={[styles.sliderOptionText, { color: newTargetAccounts === opt ? '#fff' : colors.textSecondary }]}>
                        {opt === 'Subscribers' ? t('targetSubscribers') : t('targetFreeAccounts')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 3-6. Profile actions */}
              {renderProfileActionSlider(`${language === 'es' ? 'Conservador' : 'Conservative'} *`, newActionConservative, setNewActionConservative, CREATE_PROFILE_ACTIONS)}
              {renderProfileActionSlider(`${language === 'es' ? 'Moderado' : 'Moderate'} *`, newActionModerate, setNewActionModerate, CREATE_PROFILE_ACTIONS)}
              {renderProfileActionSlider(`${language === 'es' ? 'Agresivo' : 'Aggressive'} *`, newActionAggressive, setNewActionAggressive, CREATE_PROFILE_ACTIONS)}
              {renderProfileActionSlider(`Ultra-${language === 'es' ? 'Agresivo' : 'Aggressive'} *`, newActionUltraAggressive, setNewActionUltraAggressive, CREATE_PROFILE_ACTIONS)}

              {/* 7. Entry Price ARS — mandatory if no USD */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Precio de Entrada (AR$)' : 'Entry Price (AR$)'}
                  {newEntryPriceUSD ? '' : ' *'}
                </Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newEntryPriceARS} onChangeText={setNewEntryPriceARS} placeholder="e.g., 52600"
                  placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>

              {/* 8. Re-Entry Price ARS — optional */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Precio Re-Entrada (AR$)' : 'Re-Entry Price (AR$)'}
                </Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newReEntryPriceARS} onChangeText={setNewReEntryPriceARS} placeholder="e.g., 50600"
                  placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>

              {/* 9. Entry Price USD — mandatory if no ARS */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Precio de Entrada (US$)' : 'Entry Price (US$)'}
                  {newEntryPriceARS ? '' : ' *'}
                </Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newEntryPriceUSD} onChangeText={setNewEntryPriceUSD} placeholder="e.g., 173.00"
                  placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>

              {/* 10. Re-Entry Price USD — optional */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Precio Re-Entrada (US$)' : 'Re-Entry Price (US$)'}
                </Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newReEntryPriceUSD} onChangeText={setNewReEntryPriceUSD} placeholder="e.g., 153.00"
                  placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>

              {/* 11. Short-Term Goal */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Objetivo Corto Plazo (%)' : 'Short-Term Goal (%)'}
                </Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newShortTermGoal} onChangeText={setNewShortTermGoal} placeholder="e.g., 15"
                  placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>

              {/* 12. Long-Term Goal — optional */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Objetivo Largo Plazo (%)' : 'Long-Term Goal (%)'}
                </Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newLongTermGoal} onChangeText={setNewLongTermGoal} placeholder="e.g., 45"
                  placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>

              {/* 14. Alert Details (ES) — optional, max 1000 chars, emoji support */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Detalles de la Alerta (ES)' : 'Alert Details (ES)'} ({newAlertDetails.length}/1000)
                </Text>
                <TextInput
                  style={[styles.textArea, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newAlertDetails}
                  onChangeText={(t) => setNewAlertDetails(t.slice(0, 1000))}
                  placeholder={language === 'es' ? 'Descripción detallada, análisis, emojis...' : 'Detailed description, analysis, emojis...'}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              {/* 14b. Alert Details (EN) — optional, max 1000 chars, emoji support */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Detalles de la Alerta (EN)' : 'Alert Details (EN)'} ({newAlertDetailEn.length}/1000)
                </Text>
                <TextInput
                  style={[styles.textArea, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newAlertDetailEn}
                  onChangeText={(t) => setNewAlertDetailEn(t.slice(0, 1000))}
                  placeholder="Detailed description, analysis, emojis..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => { setShowCreateModal(false); resetCreateForm(); }} disabled={creating}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, creating && styles.buttonDisabled]}
                onPress={handleCreateAlert} disabled={creating}>
                {creating ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={[styles.buttonPrimaryText, { color: colors.background }]}>{t('add')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          UPDATE ALERT MODAL
          ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={showUpdateModal} transparent animationType="slide" onRequestClose={() => { setShowUpdateModal(false); setEditingAlert(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('updateAlert')}: {editingAlert?.ticker}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Current prices based on alert markets */}
              {editingAlert && getAlertMarkets(editingAlert).hasARS && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {language === 'es' ? 'Precio Actual (AR$)' : 'Current Price (AR$)'}
                  </Text>
                  <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                    value={editCurrentPriceARS} onChangeText={setEditCurrentPriceARS} placeholder="e.g., 55600"
                    placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
                </View>
              )}
              {editingAlert && getAlertMarkets(editingAlert).hasUSD && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    {language === 'es' ? 'Precio Actual (US$)' : 'Current Price (US$)'}
                  </Text>
                  <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                    value={editCurrentPriceUSD} onChangeText={setEditCurrentPriceUSD} placeholder="e.g., 183.00"
                    placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Objetivo Corto Plazo (%)' : 'Short-Term Goal (%)'}
                </Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={editShortTermGoal} onChangeText={setEditShortTermGoal} placeholder="e.g., 15"
                  placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Objetivo Largo Plazo (%)' : 'Long-Term Goal (%)'}
                </Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={editLongTermGoal} onChangeText={setEditLongTermGoal} placeholder="e.g., 45"
                  placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>

              {renderProfileActionSlider(language === 'es' ? 'Conservador' : 'Conservative', editActionConservative, setEditActionConservative, UPDATE_PROFILE_ACTIONS, editingAlert?.action_conservative === 'Refrain')}
              {renderProfileActionSlider(language === 'es' ? 'Moderado' : 'Moderate', editActionModerate, setEditActionModerate, UPDATE_PROFILE_ACTIONS, editingAlert?.action_moderate === 'Refrain')}
              {renderProfileActionSlider(language === 'es' ? 'Agresivo' : 'Aggressive', editActionAggressive, setEditActionAggressive, UPDATE_PROFILE_ACTIONS, editingAlert?.action_aggressive === 'Refrain')}
              {renderProfileActionSlider(`Ultra-${language === 'es' ? 'Agresivo' : 'Aggressive'}`, editActionUltraAggressive, setEditActionUltraAggressive, UPDATE_PROFILE_ACTIONS, (editingAlert?.action_ultra_aggressive ?? 'Refrain') === 'Refrain')}

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Detalles de la Alerta (ES)' : 'Alert Details (ES)'} ({editAlertDetails.length}/1000)
                </Text>
                <TextInput
                  style={[styles.textArea, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={editAlertDetails}
                  onChangeText={(t) => setEditAlertDetails(t.slice(0, 1000))}
                  placeholder={language === 'es' ? 'Descripción, análisis, emojis...' : 'Description, analysis, emojis...'}
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Detalles de la Alerta (EN)' : 'Alert Details (EN)'} ({editAlertDetailEn.length}/1000)
                </Text>
                <TextInput
                  style={[styles.textArea, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={editAlertDetailEn}
                  onChangeText={(t) => setEditAlertDetailEn(t.slice(0, 1000))}
                  placeholder="Description, analysis, emojis..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              </View>

            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => { setShowUpdateModal(false); setEditingAlert(null); }} disabled={updatingAlert}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, updatingAlert && styles.buttonDisabled]}
                onPress={handleUpdateAlert} disabled={updatingAlert}>
                {updatingAlert ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={[styles.buttonPrimaryText, { color: colors.background }]}>{t('update')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════════
          CLOSE ALERT MODAL
          ══════════════════════════════════════════════════════════════════ */}
      <Modal visible={showCloseModal} transparent animationType="slide" onRequestClose={() => { setShowCloseModal(false); setClosingAlertTarget(null); setClosePriceARS(''); setClosePriceUSD(''); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('closeAlert')}: {closingAlertTarget?.ticker}</Text>
            {closingAlertTarget && getAlertMarkets(closingAlertTarget).hasARS && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Precio de Cierre (AR$)' : 'Closing Price (AR$)'}
                </Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={closePriceARS} onChangeText={setClosePriceARS} placeholder="e.g., 55600"
                  placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
            )}
            {closingAlertTarget && getAlertMarkets(closingAlertTarget).hasUSD && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Precio de Cierre (US$)' : 'Closing Price (US$)'}
                </Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={closePriceUSD} onChangeText={setClosePriceUSD} placeholder="e.g., 183.00"
                  placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => { setShowCloseModal(false); setClosingAlertTarget(null); setClosePriceARS(''); setClosePriceUSD(''); }} disabled={closingAlert}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.warning ?? '#f59e0b' }, closingAlert && styles.buttonDisabled]}
                onPress={handleCloseAlert} disabled={closingAlert}>
                {closingAlert ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.buttonPrimaryText, { color: '#fff' }]}>{t('closeAlert')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Alert Details Modal (Config cards) ── */}
      <Modal
        visible={showDetailsModal}
        transparent
        animationType="slide"
        onRequestClose={() => { setShowDetailsModal(false); setDetailsAlert(null); }}
      >
        <View style={styles.detailsModalOverlay}>
          <View style={[styles.detailsModalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.detailsModalHeader}>
              <Text style={[styles.detailsModalTitle, { color: colors.text }]}>
                {detailsAlert?.ticker}{detailsAlert?.ticker_name ? ` — ${detailsAlert.ticker_name}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => { setShowDetailsModal(false); setDetailsAlert(null); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.detailsText, { color: colors.text }]}>
                {detailsAlert?.alert_details ?? ''}
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ── Add Ticker Name Modal ── */}
      <Modal visible={showAddNameModal} transparent animationType="slide" onRequestClose={() => setShowAddNameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('addTickerName')}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('tickerSymbol')} *</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newNameTicker} onChangeText={setNewNameTicker} placeholder="e.g., AAPL"
                  placeholderTextColor={colors.textTertiary} autoCapitalize="characters" autoCorrect={false} />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('companyName')} *</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newNameValue} onChangeText={setNewNameValue} placeholder="e.g., Apple Inc."
                  placeholderTextColor={colors.textTertiary} autoCapitalize="words" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Balanz URL (AR$)' : 'Balanz URL (AR$)'}
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newNameBalanzUrlArg}
                  onChangeText={setNewNameBalanzUrlArg}
                  placeholder="https://..."
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>
                  {language === 'es' ? 'Balanz URL (US$)' : 'Balanz URL (US$)'}
                </Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newNameBalanzUrlUsa}
                  onChangeText={setNewNameBalanzUrlUsa}
                  placeholder="https://..."
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => { setShowAddNameModal(false); setNewNameTicker(''); setNewNameValue(''); setNewNameBalanzUrlArg(''); setNewNameBalanzUrlUsa(''); }} disabled={savingName}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, savingName && styles.buttonDisabled]}
                onPress={handleSaveName} disabled={savingName}>
                {savingName ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={[styles.buttonPrimaryText, { color: colors.background }]}>{t('save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Ticker Name Modal ── */}
      <Modal visible={showEditNameModal} transparent animationType="slide" onRequestClose={() => setShowEditNameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit: {editingName?.ticker}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('companyName')} *</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newNameValue} onChangeText={setNewNameValue} placeholder="e.g., Apple Inc."
                  placeholderTextColor={colors.textTertiary} autoCapitalize="words" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Balanz URL (AR$)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newNameBalanzUrlArg}
                  onChangeText={setNewNameBalanzUrlArg}
                  placeholder="https://..."
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>Balanz URL (US$)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                  value={newNameBalanzUrlUsa}
                  onChangeText={setNewNameBalanzUrlUsa}
                  placeholder="https://..."
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                />
              </View>
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => { setShowEditNameModal(false); setEditingName(null); setNewNameValue(''); setNewNameBalanzUrlArg(''); setNewNameBalanzUrlUsa(''); }} disabled={savingName}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, savingName && styles.buttonDisabled]}
                onPress={handleUpdateName} disabled={savingName}>
                {savingName ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={[styles.buttonPrimaryText, { color: colors.background }]}>{t('update')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Account Modal ── */}
      <Modal visible={showAddAccountModal} transparent animationType="slide" onRequestClose={() => setShowAddAccountModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('addAccount')}</Text>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('emailAddress2')}</Text>
              <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]}
                value={newAccountEmail} onChangeText={setNewAccountEmail} placeholder="user@example.com"
                placeholderTextColor={colors.textTertiary} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('selectAccountType')}</Text>
              <View style={styles.sliderRow}>
                {allowedAccountTypes.map((type) => (
                  <TouchableOpacity key={type}
                    style={[styles.sliderOption, { backgroundColor: colors.card, borderColor: colors.border }, newAccountType === type && { backgroundColor: getAccountTypeBadgeColor(type), borderColor: getAccountTypeBadgeColor(type) }]}
                    onPress={() => setNewAccountType(type)}>
                    <Text style={[styles.sliderOptionText, { color: newAccountType === type ? '#fff' : colors.textSecondary }]}>
                      {type === 'Free' ? 'Free (F)' : type === 'Affiliate' ? 'Affiliate (A)' : type === 'Admin' ? 'Admin (M)' : 'Dev (D)'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowAddAccountModal(false)} disabled={savingAccount}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, savingAccount && styles.buttonDisabled]}
                onPress={handleAddAccount} disabled={savingAccount}>
                {savingAccount ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={[styles.buttonPrimaryText, { color: colors.background }]}>{t('add')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Edit Account Modal ── */}
      <Modal visible={showEditAccountModal} transparent animationType="slide" onRequestClose={() => { setShowEditAccountModal(false); setEditingAccount(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('editAccount')}</Text>
            <Text style={[styles.emailLabel, { color: colors.textSecondary }]}>{editingAccount?.email}</Text>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('selectAccountType')}</Text>
              <View style={styles.sliderRow}>
                {allowedAccountTypes.map((type) => (
                  <TouchableOpacity key={type}
                    style={[styles.sliderOption, { backgroundColor: colors.card, borderColor: colors.border }, newAccountType === type && { backgroundColor: getAccountTypeBadgeColor(type), borderColor: getAccountTypeBadgeColor(type) }]}
                    onPress={() => setNewAccountType(type)}>
                    <Text style={[styles.sliderOptionText, { color: newAccountType === type ? '#fff' : colors.textSecondary }]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => { setShowEditAccountModal(false); setEditingAccount(null); }} disabled={savingAccount}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, savingAccount && styles.buttonDisabled]}
                onPress={handleUpdateAccount} disabled={savingAccount}>
                {savingAccount ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={[styles.buttonPrimaryText, { color: colors.background }]}>{t('update')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1 },
  headerTitle: { ...typography.h2 },
  headerSubtitle: { ...typography.bodySmall, marginTop: spacing.xs },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  headerActionButton: { padding: spacing.sm },
  tabBarScroll: { borderBottomWidth: 1 },
  tabBar: { flexDirection: 'row', alignItems: 'center' },
  tabBarFull: { flex: 1 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { ...typography.bodySmall, fontWeight: '600' },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, gap: spacing.sm },
  searchInput: { ...typography.body, flex: 1, paddingVertical: 6 },
  sortMenu: { borderBottomWidth: 1, paddingVertical: spacing.xs },
  sortOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  sortOptionText: { ...typography.body },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl },
  emptyTitle: { ...typography.h3, marginTop: spacing.lg },
  emptySubtitle: { ...typography.body, marginTop: spacing.sm, textAlign: 'center' },
  card: { borderRadius: 14, borderWidth: 1, marginBottom: spacing.sm, overflow: 'hidden' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: spacing.md, paddingBottom: spacing.sm },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ticker: { ...typography.h3 },
  tickerName: { ...typography.caption, marginTop: 2 },
  miniChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  miniChipText: { fontSize: 10, fontWeight: '600' },
  conditionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
  conditionDot: { width: 7, height: 7, borderRadius: 4 },
  conditionText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  // kept for backward compat (name items, account items)
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  gridCell: { width: '33.33%', paddingVertical: spacing.xs, paddingRight: spacing.xs },
  gridLabel: { ...typography.caption, marginBottom: 2 },
  gridValue: { ...typography.bodySmall, fontWeight: '600' },
  // Alert card layout (mirrors AlertCard.tsx)
  tickerBlock: { flex: 1, marginRight: spacing.sm },
  metaDate: { ...typography.caption },
  headerRight: { alignItems: 'flex-end', gap: spacing.xs },
  priceBlock: { borderTopWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  priceRow: { flexDirection: 'row' },
  priceCell: { flex: 1, paddingRight: spacing.xs },
  priceLabel: { ...typography.caption, marginBottom: 2 },
  priceValue: { ...typography.bodySmall, fontWeight: '600' },
  metricsRow: { flexDirection: 'row', borderTopWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  metricCell: { flex: 1, paddingRight: spacing.xs },
  profileActionsRow: { flexDirection: 'row', borderTopWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  profileActionCell: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  profileActionLabel: { fontSize: 8, textAlign: 'center', marginBottom: 2, textTransform: 'uppercase', fontWeight: '600' },
  profileActionValue: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', textAlign: 'center' },
  bottomBar: { flexDirection: 'row', borderTopWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  bottomBarItem: { flex: 1, alignItems: 'center', gap: spacing.xs },
  bottomBarDivider: { width: 1, marginHorizontal: spacing.sm },
  bottomBarLabel: { ...typography.caption, textAlign: 'center' },
  bottomBarBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  detailsModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  detailsModalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, maxHeight: '70%' },
  detailsModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  detailsModalTitle: { ...typography.h3, flex: 1, marginRight: spacing.sm },
  detailsText: { ...typography.body, lineHeight: 24 },
  cardActions: { flexDirection: 'row', borderTopWidth: 1, padding: spacing.sm, gap: spacing.sm },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingVertical: 8 },
  cardActionText: { fontSize: 12, fontWeight: '600' },
  accountBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 3, marginTop: spacing.xs },
  accountBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  nameUrlRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, borderTopWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  nameUrlChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  nameUrlChipText: { fontSize: 11, fontWeight: '600' },
  naRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  naLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  naLabel: { ...typography.bodySmall, fontWeight: '500' },
  naRight: { flexDirection: 'row', alignItems: 'center' },
  naBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  naBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: spacing.lg },
  modal: { borderRadius: 16, padding: spacing.lg, maxHeight: '90%' },
  modalTitle: { ...typography.h2, marginBottom: spacing.lg },
  emailLabel: { ...typography.body, marginBottom: spacing.lg, marginTop: -spacing.sm },
  inputGroup: { marginBottom: spacing.md },
  sliderGroup: { marginBottom: spacing.md },
  label: { ...typography.bodySmall, fontWeight: '500', marginBottom: spacing.sm },
  input: { ...typography.body, padding: spacing.md, borderRadius: 12, borderWidth: 1 },
  textArea: { ...typography.body, padding: spacing.md, borderRadius: 12, borderWidth: 1, minHeight: 100 },
  sliderRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  sliderOption: { flex: 1, minWidth: 70, padding: spacing.sm, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  sliderOptionText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  lockedActionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, alignSelf: 'flex-start' },
  lockedActionText: { fontSize: 12, fontWeight: '500', fontStyle: 'italic' },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: { flex: 1, padding: spacing.md, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#10b981' },
  buttonPrimaryText: { ...typography.body, fontWeight: '600' },
  buttonSecondary: { borderWidth: 1 },
  buttonSecondaryText: { ...typography.body, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
});
