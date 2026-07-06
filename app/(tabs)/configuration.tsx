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
import { alertService, calculateYield, calculateElapsedDays, formatElapsed, formatPrice } from '@/services/alertService';
import { accountService, AccountType } from '@/services/accountService';
import { tickerNameService } from '@/services/tickerNameService';
import {
  Alert as AlertType,
  AlertAction,
  ProfileAction,
  TargetAccounts,
  AlertMarket,
  TickerName,
  CreateAlertPayload,
  UpdateAlertPayload,
} from '@/types/stock';
import { router } from 'expo-router';
import { useAccountType } from '@/hooks/useAccountType';
import { useLanguage } from '@/hooks/useLanguage';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

type SortType = 'newestFirst' | 'oldestFirst' | 'alphabetAZ' | 'alphabetZA' | 'currentFirst' | 'closedFirst';
type ActiveTab = 'alerts' | 'names' | 'accounts';

interface ManagedAccount {
  id: string;
  email: string;
  account_type: AccountType;
  created_at: string;
  new_affiliates: boolean | null;
}

// kept for legacy import compatibility
const ADMIN_ALLOWED_TYPES: AccountType[] = ['Free', 'Affiliate'];
const DEV_ALLOWED_TYPES: AccountType[] = ['Free', 'Affiliate', 'Admin'];

// Profile actions for New Alert (initial indications: Buy / Sell / Refrain)
const CREATE_PROFILE_ACTIONS: ProfileAction[] = ['Buy', 'Sell', 'Refrain'];
// Profile actions for Update Alert (updating indications: Double / Hold / Close / Keep Out)
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

  // Create alert form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTicker, setNewTicker] = useState('');
  const [newMarket, setNewMarket] = useState<AlertMarket>('EEUU');
  const [newTargetAccounts, setNewTargetAccounts] = useState<TargetAccounts>('Subscribers');
  const [newAction, setNewAction] = useState<AlertAction | null>('Buy');
  const [newEntryPrice, setNewEntryPrice] = useState('');
  const [newReEntryPrice, setNewReEntryPrice] = useState('');
  const [newThreeMonthsGoal, setNewThreeMonthsGoal] = useState('');
  const [newActionConservative, setNewActionConservative] = useState<ProfileAction>('Refrain');
  const [newActionModerate, setNewActionModerate] = useState<ProfileAction>('Refrain');
  const [newActionAggressive, setNewActionAggressive] = useState<ProfileAction>('Refrain');

  // Update alert form
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updatingAlert, setUpdatingAlert] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertType | null>(null);
  const [editCurrentPrice, setEditCurrentPrice] = useState('');
  const [editThreeMonthsGoal, setEditThreeMonthsGoal] = useState('');
  const [editActionConservative, setEditActionConservative] = useState<ProfileAction>('Hold');
  const [editActionModerate, setEditActionModerate] = useState<ProfileAction>('Hold');
  const [editActionAggressive, setEditActionAggressive] = useState<ProfileAction>('Hold');

  // Close alert form
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingAlert, setClosingAlert] = useState(false);
  const [closingAlertTarget, setClosingAlertTarget] = useState<AlertType | null>(null);
  const [closePrice, setClosePrice] = useState('');

  // ─── Ticker Names state ────────────────────────────────────────────────────
  const [tickerNames, setTickerNames] = useState<TickerName[]>([]);
  const [loadingNames, setLoadingNames] = useState(false);
  const [showAddNameModal, setShowAddNameModal] = useState(false);
  const [editingName, setEditingName] = useState<TickerName | null>(null);
  const [showEditNameModal, setShowEditNameModal] = useState(false);
  const [newNameTicker, setNewNameTicker] = useState('');
  const [newNameValue, setNewNameValue] = useState('');
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

  // Dev: Free/Affiliate/Admin; Admin: Free/Affiliate
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
    setNewMarket('EEUU');
    setNewTargetAccounts('Subscribers');
    setNewAction('Buy');
    setNewEntryPrice('');
    setNewReEntryPrice('');
    setNewThreeMonthsGoal('');
    setNewActionConservative('Refrain');
    setNewActionModerate('Refrain');
    setNewActionAggressive('Refrain');
  };

  const handleCreateAlert = async () => {
    if (!newTicker.trim()) { showAlert(t('error'), 'Ticker is required'); return; }
    setCreating(true);
    const payload: CreateAlertPayload = {
      ticker: newTicker.trim().toUpperCase(),
      market: newMarket,
      target_accounts: newTargetAccounts,
      action: newAction,
      entry_price: newEntryPrice ? parseFloat(newEntryPrice) : null,
      re_entry_price: newReEntryPrice ? parseFloat(newReEntryPrice) : null,
      three_months_goal: newThreeMonthsGoal ? parseFloat(newThreeMonthsGoal) : null,
      action_conservative: newActionConservative,
      action_moderate: newActionModerate,
      action_aggressive: newActionAggressive,
    };
    // Admin/Dev are always subscribers; push enabled based on their preference
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
    setEditCurrentPrice(alert.current_price?.toString() ?? '');
    setEditThreeMonthsGoal(alert.three_months_goal?.toString() ?? '');
    setEditActionConservative((['Double', 'Hold', 'Close', 'Keep Out'] as ProfileAction[]).includes(alert.action_conservative) ? alert.action_conservative : 'Hold');
    setEditActionModerate((['Double', 'Hold', 'Close', 'Keep Out'] as ProfileAction[]).includes(alert.action_moderate) ? alert.action_moderate : 'Hold');
    setEditActionAggressive((['Double', 'Hold', 'Close', 'Keep Out'] as ProfileAction[]).includes(alert.action_aggressive) ? alert.action_aggressive : 'Hold');
    setShowUpdateModal(true);
  };

  const handleUpdateAlert = async () => {
    if (!editingAlert) return;
    setUpdatingAlert(true);
    const payload: UpdateAlertPayload = {
      current_price: editCurrentPrice ? parseFloat(editCurrentPrice) : null,
      three_months_goal: editThreeMonthsGoal ? parseFloat(editThreeMonthsGoal) : null,
      action_conservative: editActionConservative,
      action_moderate: editActionModerate,
      action_aggressive: editActionAggressive,
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
    setClosePrice(alert.current_price?.toString() ?? '');
    setShowCloseModal(true);
  };

  const handleCloseAlert = async () => {
    if (!closingAlertTarget) return;
    setClosingAlert(true);
    const { error } = await alertService.closeAlert(closingAlertTarget.id, {
      closing_price: closePrice ? parseFloat(closePrice) : null,
    }, closingAlertTarget, true, notificationsEnabled);
    setClosingAlert(false);
    if (error) { showAlert(t('error'), error); return; }
    setShowCloseModal(false);
    setClosingAlertTarget(null);
    setClosePrice('');
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
      const excelData = displayAlerts.length > 0
        ? displayAlerts.map((a) => ({
            'Ticker': a.ticker,
            'Market': a.market ?? 'EEUU',
            'Target Accounts': a.target_accounts,
            'Alert Condition': a.alert_condition,
            'Action': a.action ?? '',
            'Entry Price': a.entry_price ?? '',
            'Re-Entry Price': a.re_entry_price ?? '',
            'Current Price': a.current_price ?? '',
            'Closing Price': a.closing_price ?? '',
            '3-Month Goal (%)': a.three_months_goal ?? '',
            'Conservative': a.action_conservative,
            'Moderate': a.action_moderate,
            'Aggressive': a.action_aggressive,
            'Opening Date': a.opening_date,
            'Closing Date': a.closing_date ?? '',
          }))
        : [{ 'Ticker': '', 'Market': '', 'Target Accounts': '', 'Alert Condition': '', 'Action': '', 'Entry Price': '', 'Re-Entry Price': '', 'Current Price': '', 'Closing Price': '', '3-Month Goal (%)': '', 'Conservative': '', 'Moderate': '', 'Risky': '', 'Opening Date': '', 'Closing Date': '' }];
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Alerts');
      const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileUri = FileSystem.documentDirectory + `alerts_${new Date().toISOString().split('T')[0]}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, buf, { encoding: FileSystem.EncodingType.Base64 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) { await Sharing.shareAsync(fileUri); } else { showAlert(t('success'), 'File saved'); }
      setExportingAlerts(false);
    } catch { setExportingAlerts(false); showAlert(t('error'), 'Failed to export alerts.'); }
  };

  const handleImportAlerts = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setImportingAlerts(true);
      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const wb = XLSX.read(fileContent, { type: 'base64' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const validTargets = ['Subscribers', 'Free-Accounts'];
      const validActions = ['Buy', 'Sell'];
      const validProfileActions = ['Buy', 'Sell', 'Refrain', 'Double', 'Hold', 'Close', 'Keep Out'];
      const validMarkets = ['EEUU', 'ARG'];
      const rows: CreateAlertPayload[] = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 1) continue;
        const ticker = row[0]?.toString().trim().toUpperCase();
        if (!ticker) continue;
        const market = validMarkets.includes(row[1]?.toString().trim()) ? row[1].toString().trim() : 'EEUU';
        const target = row[2]?.toString().trim();
        const action = row[3]?.toString().trim();
        const entryPrice = row[4] ? parseFloat(row[4]) : null;
        const reEntryPrice = row[5] ? parseFloat(row[5]) : null;
        const threeMonths = row[6] ? parseFloat(row[6]) : null;
        const conservative = validProfileActions.includes(row[7]?.toString().trim()) ? row[7].toString().trim() : 'Refrain';
        const moderate = validProfileActions.includes(row[8]?.toString().trim()) ? row[8].toString().trim() : 'Refrain';
        const risky = validProfileActions.includes(row[9]?.toString().trim()) ? row[9].toString().trim() : 'Refrain';
        rows.push({
          ticker,
          market: market as AlertMarket,
          target_accounts: validTargets.includes(target) ? target as TargetAccounts : 'Subscribers',
          action: validActions.includes(action) ? action as AlertAction : null,
          entry_price: isNaN(entryPrice as number) ? null : entryPrice,
          re_entry_price: isNaN(reEntryPrice as number) ? null : reEntryPrice,
          three_months_goal: isNaN(threeMonths as number) ? null : threeMonths,
          action_conservative: conservative as ProfileAction,
          action_moderate: moderate as ProfileAction,
          action_aggressive: risky as ProfileAction,
        });
      }
      if (rows.length === 0) { setImportingAlerts(false); showAlert(t('error'), 'No valid rows found. Columns: Ticker | Market | Target | Action | Entry Price | Re-Entry Price | 3M Goal | Conservative | Moderate | Risky'); return; }
      const { successCount, failedCount, errors } = await alertService.batchImportAlerts(rows);
      setImportingAlerts(false);
      if (errors.length > 0) {
        Alert.alert(t('importResultsTitle'), `Imported: ${successCount}\nFailed: ${failedCount}\n\nErrors:\n${errors.slice(0, 5).join('\n')}`, [{ text: 'OK', onPress: () => loadAlerts() }]);
      } else {
        showAlert(t('success'), `Imported ${successCount} alerts!`);
        loadAlerts();
      }
    } catch { setImportingAlerts(false); showAlert(t('error'), 'Failed to import file.'); }
  };

  const handleShareAlert = async (item: AlertType) => {
    const lang = language;
    const market = item.market ?? 'EEUU';
    const fmtP = (val: number | null) => formatPrice(val, market);
    const formatPct = (val: number | null) => {
      if (val == null) return '-';
      const s = val >= 0 ? '+' : '';
      return `${s}${val.toFixed(2)}%`;
    };
    const yieldVal = calculateYield(item);
    const isClosed = item.alert_condition === 'Closed';
    // Updated = current state + current_price has been set at least once
    const isUpdated = !isClosed && item.current_price != null;
    // Creation = current state + never updated (no current_price yet)
    const isCreation = !isClosed && item.current_price == null;

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

    let message = '';

    if (isClosed) {
      // ── Alert Closing Message ──
      const lines: string[] = [
        `🚨 ${lang === 'es' ? 'Alerta de Cierre' : 'Closing Alert'}: ${item.ticker}${item.ticker_name ? ` (${item.ticker_name})` : ''}`,
        ...(item.entry_price != null ? [`💱 ${lang === 'es' ? 'Precio de Entrada' : 'Entry Price'}: ${fmtP(item.entry_price)}`] : []),
        ...(item.closing_price != null ? [`💱 ${lang === 'es' ? 'Precio de Cierre' : 'Closing Price'}: ${fmtP(item.closing_price)}`] : []),
        ...(yieldVal != null ? [`🚀 ${lang === 'es' ? 'Rendimiento' : 'Yield'}: ${formatPct(yieldVal)}`] : []),
      ];
      message = lines.join('\n');
    } else if (isUpdated) {
      // ── Alert Update Message ──
      const elapsedDays = calculateElapsedDays(item);
      const lines: string[] = [
        `🚨 ${lang === 'es' ? 'Actualización' : 'Update'}: ${item.ticker}${item.ticker_name ? ` (${item.ticker_name})` : ''}`,
        `👨\u200d🦳 ${lang === 'es' ? 'Perfiles Conservadores' : 'Conservative Profiles'}: ${profileActionLabel(item.action_conservative)}`,
        `👩\u200d🌾 ${lang === 'es' ? 'Perfiles Moderados' : 'Moderate Profiles'}: ${profileActionLabel(item.action_moderate)}`,
        `👽 ${lang === 'es' ? 'Perfiles Agresivos' : 'Aggressive Profiles'}: ${profileActionLabel(item.action_aggressive)}`,
        ...(item.three_months_goal != null ? [`🎯 ${lang === 'es' ? 'Meta 3 meses' : '3-Month Goal'}: ${item.three_months_goal.toFixed(1)}%`] : []),
        `⏰ ${lang === 'es' ? 'Tiempo transcurrido' : 'Elapsed time'}: ${formatElapsed(elapsedDays)}`,
      ];
      message = lines.join('\n');
    } else {
      // ── Alert Creation Message ──
      const alertTitle = item.action === 'Buy'
        ? (lang === 'es' ? 'Alerta de Compra' : 'Buy Alert')
        : item.action === 'Sell'
          ? (lang === 'es' ? 'Alerta de Venta' : 'Sell Alert')
          : (lang === 'es' ? 'Alerta' : 'Alert');
      const lines: string[] = [
        `🚨 ${alertTitle}: ${item.ticker}${item.ticker_name ? ` (${item.ticker_name})` : ''}`,
        `👨\u200d🦳 ${lang === 'es' ? 'Perfiles Conservadores' : 'Conservative Profiles'}: ${profileActionLabel(item.action_conservative)}`,
        `👩\u200d🌾 ${lang === 'es' ? 'Perfiles Moderados' : 'Moderate Profiles'}: ${profileActionLabel(item.action_moderate)}`,
        `👽 ${lang === 'es' ? 'Perfiles Agresivos' : 'Aggressive Profiles'}: ${profileActionLabel(item.action_aggressive)}`,
        ...(item.entry_price != null ? [`💱 ${lang === 'es' ? 'Precio de Entrada' : 'Entry Price'}: ${fmtP(item.entry_price)}`] : []),
        ...(item.re_entry_price != null ? [`💱 ${lang === 'es' ? 'Precio de Re-Entrada' : 'Re-Entry Price'}: ${fmtP(item.re_entry_price)}`] : []),
        ...(item.three_months_goal != null ? [`🎯 ${lang === 'es' ? 'Meta 3 meses' : '3-Month Goal'}: ${item.three_months_goal.toFixed(1)}%`] : []),
      ];
      message = lines.join('\n');
    }

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
    const { error } = await tickerNameService.upsertTickerName(newNameTicker.trim(), newNameValue.trim());
    setSavingName(false);
    if (error) { showAlert(t('error'), error); return; }
    setShowAddNameModal(false);
    setNewNameTicker(''); setNewNameValue('');
    loadTickerNames(); loadAlerts();
    showAlert(t('success'), 'Name saved successfully');
  };

  const handleUpdateName = async () => {
    if (!editingName || !newNameValue.trim()) { showAlert(t('error'), 'Name is required'); return; }
    setSavingName(true);
    const { error } = await tickerNameService.upsertTickerName(editingName.ticker, newNameValue.trim());
    setSavingName(false);
    if (error) { showAlert(t('error'), error); return; }
    setShowEditNameModal(false); setEditingName(null); setNewNameValue('');
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
      const excelData = tickerNames.length > 0
        ? tickerNames.map((n) => ({ 'Ticker': n.ticker, 'Name': n.name }))
        : [{ 'Ticker': '', 'Name': '' }];
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Ticker Names');
      const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileUri = FileSystem.documentDirectory + `ticker_names_${new Date().toISOString().split('T')[0]}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, buf, { encoding: FileSystem.EncodingType.Base64 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) { await Sharing.shareAsync(fileUri); } else { showAlert(t('success'), 'File saved'); }
      setExportingNames(false);
    } catch { setExportingNames(false); showAlert(t('error'), 'Failed to export.'); }
  };

  const handleImportNames = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setImportingNames(true);
      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const wb = XLSX.read(fileContent, { type: 'base64' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const namesData: Array<{ ticker: string; name: string }> = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 2) continue;
        const ticker = row[0]?.toString().trim().toUpperCase();
        const name = row[1]?.toString().trim();
        if (!ticker || !name) continue;
        namesData.push({ ticker, name });
      }
      if (namesData.length === 0) { setImportingNames(false); showAlert(t('error'), 'No valid data found.'); return; }
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
      const excelData = accounts.length > 0
        ? accounts.map((a) => ({
            'email': a.email,
            'account_type': a.account_type,
            'new_affiliates': a.new_affiliates === null ? '' : a.new_affiliates ? 'TRUE' : 'FALSE',
          }))
        : [{ 'email': '', 'account_type': '', 'new_affiliates': '' }];
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
      const buf = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileUri = FileSystem.documentDirectory + `accounts_${new Date().toISOString().split('T')[0]}.xlsx`;
      await FileSystem.writeAsStringAsync(fileUri, buf, { encoding: FileSystem.EncodingType.Base64 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) { await Sharing.shareAsync(fileUri); } else { showAlert(t('success'), 'File saved'); }
      setExportingAccounts(false);
    } catch { setExportingAccounts(false); showAlert(t('error'), 'Failed to export accounts.'); }
  };

  const handleBatchImportAccounts = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      setImportingAccounts(true);
      const fileContent = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.Base64 });
      const wb = XLSX.read(fileContent, { type: 'base64' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
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
      if (accountsData.length === 0) { setImportingAccounts(false); showAlert(t('error'), 'No valid data. Columns: email | account_type | new_affiliates (optional, Dev only)'); return; }
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

  const formatPercent = (val: number | null) => {
    if (val == null) return '-';
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(2)}%`;
  };

  const getYieldColor = (y: number | null) => {
    if (y == null) return colors.textSecondary;
    return y >= 0 ? colors.bullish : colors.bearish;
  };

  const getConditionColor = (cond: string) => cond === 'Current' ? colors.bullish : colors.textSecondary;

  const getActionColor = (action: string | null) => {
    if (action === 'Buy') return colors.bullish;
    if (action === 'Sell') return colors.bearish;
    return colors.textSecondary;
  };

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
    actions: ProfileAction[] = UPDATE_PROFILE_ACTIONS
  ) => (
    <View style={styles.sliderGroup} key={label}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.sliderRow}>
        {actions.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.sliderOption,
              { backgroundColor: colors.card, borderColor: colors.border },
              value === opt && { backgroundColor: getActionColor(opt), borderColor: getActionColor(opt) },
            ]}
            onPress={() => onChange(opt)}
          >
            <Text style={[styles.sliderOptionText, { color: value === opt ? '#fff' : colors.textSecondary }]}>
              {getProfileActionLabel(opt)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  // ─── Render helpers ───────────────────────────────────────────────────────

  const renderAlertItem = ({ item }: { item: AlertType }) => {
    const yieldVal = calculateYield(item);
    const elapsedDays = calculateElapsedDays(item);
    const isClosed = item.alert_condition === 'Closed';
    const market = item.market ?? 'EEUU';

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={styles.tickerRow}>
              <Text style={[styles.ticker, { color: colors.text }]}>{item.ticker}</Text>
              <View style={[styles.marketBadge, {
                backgroundColor: market === 'ARG' ? `${colors.primary}20` : `${(colors.success ?? colors.primary)}15`,
                borderColor: market === 'ARG' ? `${colors.primary}50` : `${(colors.success ?? colors.primary)}40`,
              }]}>
                <Text style={[styles.marketBadgeText, {
                  color: market === 'ARG' ? colors.primary : (colors.success ?? colors.primary),
                }]}>
                  {market === 'ARG' ? 'AR$' : 'US$'}
                </Text>
              </View>
            </View>
            {item.ticker_name ? <Text style={[styles.tickerName, { color: colors.textSecondary }]}>{item.ticker_name}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[styles.miniChip, {
              backgroundColor: item.target_accounts === 'Subscribers' ? `${colors.primary}15` : `${colors.textSecondary}12`,
              borderColor: item.target_accounts === 'Subscribers' ? `${colors.primary}40` : colors.border,
            }]}>
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

        <View style={[styles.grid, { borderColor: colors.border }]}>
          {item.action && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('action')}</Text>
              <Text style={[styles.gridValue, { color: getActionColor(item.action) }]}>{item.action === 'Buy' ? t('actionBuy') : t('actionSell')}</Text>
            </View>
          )}
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
          <View style={styles.gridCell}>
            <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('openingDate')}</Text>
            <Text style={[styles.gridValue, { color: colors.text }]}>{formatDate(item.opening_date)}</Text>
          </View>
          {isClosed && item.closing_date && (
            <View style={styles.gridCell}>
              <Text style={[styles.gridLabel, { color: colors.textSecondary }]}>{t('closingDate')}</Text>
              <Text style={[styles.gridValue, { color: colors.text }]}>{formatDate(item.closing_date)}</Text>
            </View>
          )}
        </View>

        {/* Responsive action buttons — fill horizontal space */}
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
          <TouchableOpacity onPress={() => { setEditingName(item); setNewNameValue(item.name); setShowEditNameModal(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="edit" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDeleteName(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="delete" size={20} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
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
              <TouchableOpacity onPress={handleImportAlerts} style={styles.headerActionButton} disabled={importingAlerts}>
                {importingAlerts ? <ActivityIndicator size="small" color={colors.primary} /> : <MaterialIcons name="upload-file" size={24} color={colors.primary} />}
              </TouchableOpacity>
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
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={alertSearch}
            onChangeText={setAlertSearch}
            placeholder={language === 'es' ? 'Buscar ticker...' : 'Search ticker...'}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
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
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={namesSearch}
            onChangeText={setNamesSearch}
            placeholder={language === 'es' ? 'Buscar...' : 'Search...'}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
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
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={accountSearch}
            onChangeText={setAccountSearch}
            placeholder={language === 'es' ? 'Buscar...' : 'Search...'}
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
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
            <FlatList
              data={filtered}
              renderItem={renderNameItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            />
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
            <FlatList
              data={filtered}
              renderItem={renderAccountItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
            />
          );
        })()
      )}

      {/* ── Create Alert Modal ── */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => { setShowCreateModal(false); resetCreateForm(); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('addNewAlert')}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('ticker')} *</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={newTicker} onChangeText={setNewTicker} placeholder="e.g., AAPL" placeholderTextColor={colors.textTertiary} autoCapitalize="characters" autoCorrect={false} />
              </View>

              {/* Market selector */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('market')} *</Text>
                <View style={styles.sliderRow}>
                  {(['EEUU', 'ARG'] as AlertMarket[]).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.sliderOption, { backgroundColor: colors.card, borderColor: colors.border }, newMarket === opt && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => setNewMarket(opt)}
                    >
                      <Text style={[styles.sliderOptionText, { color: newMarket === opt ? '#fff' : colors.textSecondary }]}>
                        {opt === 'EEUU' ? 'EEUU (US$)' : 'ARG (AR$)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('targetAccounts')} *</Text>
                <View style={styles.sliderRow}>
                  {(['Subscribers', 'Free-Accounts'] as TargetAccounts[]).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.sliderOption, { backgroundColor: colors.card, borderColor: colors.border }, newTargetAccounts === opt && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                      onPress={() => setNewTargetAccounts(opt)}
                    >
                      <Text style={[styles.sliderOptionText, { color: newTargetAccounts === opt ? '#fff' : colors.textSecondary }]}>
                        {opt === 'Subscribers' ? t('targetSubscribers') : t('targetFreeAccounts')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('action')}</Text>
                <View style={styles.sliderRow}>
                  {(['Buy', 'Sell'] as AlertAction[]).map((opt) => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.sliderOption, { backgroundColor: colors.card, borderColor: colors.border }, newAction === opt && { backgroundColor: getActionColor(opt), borderColor: getActionColor(opt) }]}
                      onPress={() => setNewAction(newAction === opt ? null : opt)}
                    >
                      <Text style={[styles.sliderOptionText, { color: newAction === opt ? '#fff' : colors.textSecondary }]}>
                        {opt === 'Buy' ? t('actionBuy') : t('actionSell')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('entryPrice')}</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={newEntryPrice} onChangeText={setNewEntryPrice} placeholder="e.g., 150.00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('reEntryPrice')}</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={newReEntryPrice} onChangeText={setNewReEntryPrice} placeholder="e.g., 140.00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('threeMonthsGoal')} (%)</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={newThreeMonthsGoal} onChangeText={setNewThreeMonthsGoal} placeholder="e.g., 15" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
              {renderProfileActionSlider(t('actionConservative') + ' *', newActionConservative, setNewActionConservative, CREATE_PROFILE_ACTIONS)}
              {renderProfileActionSlider(t('actionModerate') + ' *', newActionModerate, setNewActionModerate, CREATE_PROFILE_ACTIONS)}
              {renderProfileActionSlider(t('actionRisky') + ' *', newActionAggressive, setNewActionAggressive, CREATE_PROFILE_ACTIONS)}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setShowCreateModal(false); resetCreateForm(); }} disabled={creating}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, creating && styles.buttonDisabled]} onPress={handleCreateAlert} disabled={creating}>
                {creating ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={[styles.buttonPrimaryText, { color: colors.background }]}>{t('add')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Update Alert Modal ── */}
      <Modal visible={showUpdateModal} transparent animationType="slide" onRequestClose={() => { setShowUpdateModal(false); setEditingAlert(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('updateAlert')}: {editingAlert?.ticker}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('currentPrice')}</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={editCurrentPrice} onChangeText={setEditCurrentPrice} placeholder="e.g., 160.00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('threeMonthsGoal')} (%)</Text>
                <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={editThreeMonthsGoal} onChangeText={setEditThreeMonthsGoal} placeholder="e.g., 15" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
              {renderProfileActionSlider(t('actionConservative'), editActionConservative, setEditActionConservative)}
              {renderProfileActionSlider(t('actionModerate'), editActionModerate, setEditActionModerate)}
              {renderProfileActionSlider(t('actionRisky'), editActionAggressive, setEditActionAggressive)}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setShowUpdateModal(false); setEditingAlert(null); }} disabled={updatingAlert}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, updatingAlert && styles.buttonDisabled]} onPress={handleUpdateAlert} disabled={updatingAlert}>
                {updatingAlert ? <ActivityIndicator color={colors.background} size="small" /> : <Text style={[styles.buttonPrimaryText, { color: colors.background }]}>{t('update')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Close Alert Modal ── */}
      <Modal visible={showCloseModal} transparent animationType="slide" onRequestClose={() => { setShowCloseModal(false); setClosingAlertTarget(null); setClosePrice(''); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('closeAlert')}: {closingAlertTarget?.ticker}</Text>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('closingPrice')}</Text>
              <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={closePrice} onChangeText={setClosePrice} placeholder="e.g., 175.00" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setShowCloseModal(false); setClosingAlertTarget(null); setClosePrice(''); }} disabled={closingAlert}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { backgroundColor: colors.warning ?? '#f59e0b' }, closingAlert && styles.buttonDisabled]} onPress={handleCloseAlert} disabled={closingAlert}>
                {closingAlert ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.buttonPrimaryText, { color: '#fff' }]}>{t('closeAlert')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Ticker Name Modal ── */}
      <Modal visible={showAddNameModal} transparent animationType="slide" onRequestClose={() => setShowAddNameModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('addTickerName')}</Text>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('tickerSymbol')}</Text>
              <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={newNameTicker} onChangeText={setNewNameTicker} placeholder="e.g., AAPL" placeholderTextColor={colors.textTertiary} autoCapitalize="characters" autoCorrect={false} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('companyName')}</Text>
              <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={newNameValue} onChangeText={setNewNameValue} placeholder="e.g., Apple Inc." placeholderTextColor={colors.textTertiary} autoCapitalize="words" />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setShowAddNameModal(false); setNewNameTicker(''); setNewNameValue(''); }} disabled={savingName}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, savingName && styles.buttonDisabled]} onPress={handleSaveName} disabled={savingName}>
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
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('companyName')}</Text>
              <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={newNameValue} onChangeText={setNewNameValue} placeholder="e.g., Apple Inc." placeholderTextColor={colors.textTertiary} autoCapitalize="words" />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setShowEditNameModal(false); setEditingName(null); setNewNameValue(''); }} disabled={savingName}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, savingName && styles.buttonDisabled]} onPress={handleUpdateName} disabled={savingName}>
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
              <TextInput style={[styles.input, { color: colors.text, backgroundColor: colors.card, borderColor: colors.border }]} value={newAccountEmail} onChangeText={setNewAccountEmail} placeholder="user@example.com" placeholderTextColor={colors.textTertiary} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('selectAccountType')}</Text>
              <View style={styles.sliderRow}>
                {allowedAccountTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[styles.sliderOption, { backgroundColor: colors.card, borderColor: colors.border }, newAccountType === type && { backgroundColor: getAccountTypeBadgeColor(type), borderColor: getAccountTypeBadgeColor(type) }]}
                    onPress={() => setNewAccountType(type)}
                  >
                    <Text style={[styles.sliderOptionText, { color: newAccountType === type ? '#fff' : colors.textSecondary }]}>
                        {type === 'Free' ? 'Free (F)' : type === 'Affiliate' ? 'Affiliate (A)' : type === 'Admin' ? 'Admin (M)' : 'Dev (D)'}
                      </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setShowAddAccountModal(false)} disabled={savingAccount}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, savingAccount && styles.buttonDisabled]} onPress={handleAddAccount} disabled={savingAccount}>
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
                  <TouchableOpacity
                    key={type}
                    style={[styles.sliderOption, { backgroundColor: colors.card, borderColor: colors.border }, newAccountType === type && { backgroundColor: getAccountTypeBadgeColor(type), borderColor: getAccountTypeBadgeColor(type) }]}
                    onPress={() => setNewAccountType(type)}
                  >
                    <Text style={[styles.sliderOptionText, { color: newAccountType === type ? '#fff' : colors.textSecondary }]}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.button, styles.buttonSecondary, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => { setShowEditAccountModal(false); setEditingAccount(null); }} disabled={savingAccount}>
                <Text style={[styles.buttonSecondaryText, { color: colors.text }]}>{t('cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.buttonPrimary, savingAccount && styles.buttonDisabled]} onPress={handleUpdateAccount} disabled={savingAccount}>
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
  marketBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  marketBadgeText: { fontSize: 10, fontWeight: '700' },
  tickerName: { ...typography.caption, marginTop: 2 },
  miniChip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  miniChipText: { fontSize: 10, fontWeight: '600' },
  conditionBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: 8 },
  conditionDot: { width: 7, height: 7, borderRadius: 4 },
  conditionText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  gridCell: { width: '33.33%', paddingVertical: spacing.xs, paddingRight: spacing.xs },
  gridLabel: { ...typography.caption, marginBottom: 2 },
  gridValue: { ...typography.bodySmall, fontWeight: '600' },
  // Responsive action buttons
  cardActions: { flexDirection: 'row', borderTopWidth: 1, padding: spacing.sm, gap: spacing.sm },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingVertical: 8 },
  cardActionText: { fontSize: 12, fontWeight: '600' },
  accountBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.sm, paddingVertical: 3, marginTop: spacing.xs },
  accountBadgeText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
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
  sliderRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  sliderOption: { flex: 1, minWidth: 70, padding: spacing.sm, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  sliderOptionText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  button: { flex: 1, padding: spacing.md, borderRadius: 12, alignItems: 'center' },
  buttonPrimary: { backgroundColor: '#10b981' },
  buttonPrimaryText: { ...typography.body, fontWeight: '600' },
  buttonSecondary: { borderWidth: 1 },
  buttonSecondaryText: { ...typography.body, fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
});
