import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Switch,
  Linking,
} from 'react-native';
import { useAuth, getSupabaseClient } from '@/template';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLanguage } from '@/hooks/useLanguage';
import { useAccountType } from '@/hooks/useAccountType';
import { CURRENT_TERMS_VERSION } from '@/contexts/LanguageContext';
import { getRiskProfile, saveRiskProfile, calculateRiskProfile, RiskProfile } from '@/services/riskProfileService';
import { requestNotificationPermissions, unregisterPushToken } from '@/services/notificationService';

// ─── Risk Profile Form data ────────────────────────────────────────────────────
const TOTAL_QUESTIONS = 8;
const OPTIONS: Record<number, string[]> = {
  0: ['riskProfileQ1A', 'riskProfileQ1B', 'riskProfileQ1C'],
  1: ['riskProfileQ2A', 'riskProfileQ2B', 'riskProfileQ2C'],
  2: ['riskProfileQ3A', 'riskProfileQ3B', 'riskProfileQ3C'],
  3: ['riskProfileQ4A', 'riskProfileQ4B', 'riskProfileQ4C'],
  4: ['riskProfileQ5A', 'riskProfileQ5B', 'riskProfileQ5C'],
  5: ['riskProfileQ6A', 'riskProfileQ6B', 'riskProfileQ6C'],
  6: ['riskProfileQ7A', 'riskProfileQ7B', 'riskProfileQ7C'],
  7: ['riskProfileQ8A', 'riskProfileQ8B', 'riskProfileQ8C'],
};
const ANSWER_KEYS = ['a', 'b', 'c'];

export default function ProfileScreen() {
  const { user, logout, sendOTP, verifyOTPAndLogin } = useAuth();
  const {
    t,
    language,
    setLanguage,
    setTermsAccepted,
    acceptedTermsVersion,
    termsUpToDate,
    marketFilter,
    setMarketFilter,
    notificationsEnabled,
    setNotificationsEnabled,
  } = useLanguage();
  const { accountType } = useAccountType();
  const { theme, setTheme, isDark, colors: tc } = useTheme();
  const insets = useSafeAreaInsets();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'otp'>('confirm');
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [deleteResendCooldown, setDeleteResendCooldown] = useState(0);

  // Risk Profile states
  const [riskProfile, setRiskProfile] = useState<RiskProfile | null>(null);
  const [loadingRiskProfile, setLoadingRiskProfile] = useState(true);
  const [showRiskProfileForm, setShowRiskProfileForm] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<string[]>(Array(TOTAL_QUESTIONS).fill(''));
  const [submittingRiskProfile, setSubmittingRiskProfile] = useState(false);
  const [showRiskProfileResult, setShowRiskProfileResult] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<RiskProfile | null>(null);

  useEffect(() => {
    if (deleteResendCooldown <= 0) return;
    const timer = setTimeout(() => setDeleteResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [deleteResendCooldown]);

  useEffect(() => {
    if (user?.id) loadUserRiskProfile();
  }, [user]);

  const loadUserRiskProfile = async () => {
    setLoadingRiskProfile(true);
    const { data } = await getRiskProfile(user!.id);
    setRiskProfile(data);
    setLoadingRiskProfile(false);
  };

  const getRiskProfileColor = (profile: RiskProfile | null) => {
    if (profile === 'Conservative') return tc.bullish ?? '#10b981';
    if (profile === 'Moderate') return tc.warning ?? '#f59e0b';
    if (profile === 'Aggressive') return tc.bearish ?? '#ef4444';
    return tc.textSecondary;
  };

  const getRiskProfileName = (profile: RiskProfile | null) => {
    if (!profile) return t('riskProfileNotSet');
    if (profile === 'Conservative') return t('riskProfileConservativeName');
    if (profile === 'Moderate') return t('riskProfileModerateName');
    return t('riskProfileAggressiveName');
  };

  const getRiskProfileDesc = (profile: RiskProfile | null) => {
    if (profile === 'Conservative') return t('riskProfileConservativeDesc');
    if (profile === 'Moderate') return t('riskProfileModerateDesc');
    if (profile === 'Aggressive') return t('riskProfileAggressiveDesc');
    return '';
  };

  const handleOpenRiskProfileForm = () => {
    setAnswers(Array(TOTAL_QUESTIONS).fill(''));
    setCurrentQuestion(0);
    setShowRiskProfileForm(true);
  };

  const handleSelectAnswer = (answerKey: string) => {
    const updated = [...answers];
    updated[currentQuestion] = answerKey;
    setAnswers(updated);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < TOTAL_QUESTIONS - 1) setCurrentQuestion((q) => q + 1);
  };

  const handlePrevQuestion = () => {
    if (currentQuestion > 0) setCurrentQuestion((q) => q - 1);
  };

  const handleSubmitRiskProfile = async () => {
    if (!user?.id) return;
    setSubmittingRiskProfile(true);
    const { profile } = calculateRiskProfile(answers);
    const { error } = await saveRiskProfile(user.id, profile);
    setSubmittingRiskProfile(false);
    if (error) { Alert.alert(t('error'), error); return; }
    setPendingProfile(profile);
    setRiskProfile(profile);
    setShowRiskProfileForm(false);
    setShowRiskProfileResult(true);
  };

  const handleNotificationsToggle = async (value: boolean) => {
    if (value) {
      await requestNotificationPermissions();
    }
    await setNotificationsEnabled(value);
  };

  const getAccountTypeBadgeStyle = () => {
    switch (accountType) {
      case 'Admin':
        return { bg: `${tc.primary}18`, text: tc.primary, border: `${tc.primary}40` };
      case 'Affiliate':
        return { bg: `${tc.success}18`, text: tc.success, border: `${tc.success}40` };
      default:
        return { bg: `${tc.textSecondary}15`, text: tc.textSecondary, border: `${tc.border}` };
    }
  };

  const badgeStyle = getAccountTypeBadgeStyle();

  const handleSendDeleteOTP = async () => {
    if (!user?.email) return;
    setSendingOtp(true);
    const { error } = await sendOTP(user.email);
    setSendingOtp(false);
    if (error) { Alert.alert(t('error'), error); return; }
    setDeleteStep('otp');
    setDeleteResendCooldown(60);
  };

  const handleResendDeleteOTP = async () => {
    if (!user?.email) return;
    setSendingOtp(true);
    const { error } = await sendOTP(user.email);
    setSendingOtp(false);
    if (error) { Alert.alert(t('error'), error); return; }
    setDeleteResendCooldown(60);
    Alert.alert(t('success'), t('deleteAccountOtpResent'));
  };

  const handleConfirmDelete = async () => {
    if (!user?.email || !deleteOtp) {
      Alert.alert(t('error'), t('enterVerificationCode'));
      return;
    }
    setDeletingAccount(true);
    const { error: otpError } = await verifyOTPAndLogin(user.email, deleteOtp);
    if (otpError) { setDeletingAccount(false); Alert.alert(t('error'), otpError); return; }

    const supabase = getSupabaseClient();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) { setDeletingAccount(false); Alert.alert(t('error'), 'Session expired. Please log in again.'); return; }

    const { error: deleteError } = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (deleteError) {
      setDeletingAccount(false);
      let message = deleteError.message;
      if (deleteError instanceof FunctionsHttpError) {
        try { const text = await deleteError.context?.text(); message = text || message; } catch {}
      }
      Alert.alert(t('error'), message);
      return;
    }

    setDeletingAccount(false);
    setShowDeleteModal(false);
    await supabase.auth.signOut();
    await setTermsAccepted(false);
    router.replace('/terms-and-conditions');
  };

  const handleCloseDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteStep('confirm');
    setDeleteOtp('');
    setDeleteResendCooldown(0);
  };

  const handleLogout = async () => {
    if (user?.id) {
      await unregisterPushToken(user.id);
    }
    const { error } = await logout();
    if (error) { Alert.alert(t('error'), error); return; }
    // Small delay to ensure auth state clears before navigation
    setTimeout(() => {
      router.replace('/language-selection');
    }, 100);
  };

  const handleLanguageSelect = async (lang: 'en' | 'es') => {
    await setLanguage(lang);
    setShowLanguageModal(false);
  };

  const handleViewTerms = () => {
    router.push('/terms-and-conditions?mode=view');
  };

  // ─── Account Section: Email → Risk Profile (with Update btn) → Account Type ──

  const renderAccountSection = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: tc.textSecondary }]}>{t('account')}</Text>

      {/* Email */}
      <View style={[styles.infoCard, { backgroundColor: tc.surface, borderColor: tc.border }]}>
        <MaterialIcons name="email" size={24} color={tc.primary} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, { color: tc.textSecondary }]}>{t('email')}</Text>
          <Text style={[styles.infoValue, { color: tc.text }]}>{user?.email}</Text>
        </View>
      </View>

      {/* Risk Profile with inline Update button */}
      <View style={[styles.infoCard, { backgroundColor: tc.surface, borderColor: tc.border, marginTop: spacing.sm, flexDirection: 'column', alignItems: 'stretch' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <MaterialIcons name="psychology" size={24} color={tc.primary} />
            <Text style={[styles.infoLabel, { color: tc.textSecondary }]}>{t('riskProfile')}</Text>
          </View>
          <TouchableOpacity
            style={[styles.updateRiskBtn, { backgroundColor: `${tc.primary}12`, borderColor: `${tc.primary}30` }]}
            onPress={handleOpenRiskProfileForm}
          >
            <MaterialIcons name="sync" size={14} color={tc.primary} />
            <Text style={[styles.updateRiskBtnText, { color: tc.primary }]}>{t('riskProfileRetake')}</Text>
          </TouchableOpacity>
        </View>
        {loadingRiskProfile ? (
          <ActivityIndicator size="small" color={tc.primary} />
        ) : (
          <View style={[styles.riskProfileBadge, { backgroundColor: `${getRiskProfileColor(riskProfile)}15`, borderColor: `${getRiskProfileColor(riskProfile)}40` }]}>
            <View style={[styles.riskProfileDot, { backgroundColor: getRiskProfileColor(riskProfile) }]} />
            <Text style={[styles.riskProfileBadgeText, { color: getRiskProfileColor(riskProfile) }]}>
              {getRiskProfileName(riskProfile)}
            </Text>
          </View>
        )}
      </View>

      {/* Account Type — below Risk Profile */}
      <View style={[styles.infoCard, { backgroundColor: tc.surface, borderColor: tc.border, marginTop: spacing.sm }]}>
        <MaterialIcons name="verified-user" size={24} color={badgeStyle.text} />
        <View style={styles.infoContent}>
          <Text style={[styles.infoLabel, { color: tc.textSecondary }]}>{t('accountType')}</Text>
          <View style={[styles.accountTypeBadge, { backgroundColor: badgeStyle.bg, borderColor: badgeStyle.border }]}>
            <Text style={[styles.accountTypeBadgeText, { color: badgeStyle.text }]}>
              {accountType || 'Free'}
            </Text>
          </View>
        </View>
      </View>

      {/* Subscribe / Unsubscribe button */}
      {(accountType === 'Free' || accountType === 'Affiliate') && (
        <TouchableOpacity
          style={[
            styles.subscribeButton,
            {
              backgroundColor: accountType === 'Affiliate' ? `${tc.error}12` : `${tc.primary}12`,
              borderColor: accountType === 'Affiliate' ? `${tc.error}40` : `${tc.primary}40`,
            },
          ]}
          onPress={async () => {
            if (accountType === 'Free') {
              await Linking.openURL('https://www.rdsinversiones.com');
            } else {
              const msg = encodeURIComponent('Hi! I would like to unsubscribe from the Alerts service.');
              await Linking.openURL(`whatsapp://send?phone=5492216763481&text=${msg}`);
            }
          }}
        >
          <MaterialIcons
            name={accountType === 'Affiliate' ? 'remove-circle-outline' : 'star-outline'}
            size={20}
            color={accountType === 'Affiliate' ? tc.error : tc.primary}
          />
          <Text style={[
            styles.subscribeButtonText,
            { color: accountType === 'Affiliate' ? tc.error : tc.primary },
          ]}>
            {accountType === 'Affiliate'
              ? (language === 'es' ? 'Desuscribirse' : 'Unsubscribe')
              : (language === 'es' ? 'Suscribirse' : 'Subscribe')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
      <View style={[styles.header, { borderBottomColor: tc.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: tc.text }]}>{t('profile')}</Text>
          <Text style={[styles.headerSubtitle, { color: tc.textSecondary }]}>{t('accountSettings')}</Text>
        </View>
        <MaterialIcons name="person" size={28} color={tc.primary} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Account Section — Email → Risk Profile (with Update btn) → Account Type */}
        {renderAccountSection()}

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: tc.textSecondary }]}>{t('preferences')}</Text>

          {/* Theme Selector */}
          <View style={[styles.settingCard, { backgroundColor: tc.surface, borderColor: tc.border, marginBottom: spacing.sm }]}>
            <View style={styles.settingLeft}>
              <MaterialIcons
                name={isDark ? 'dark-mode' : 'light-mode'}
                size={24}
                color={tc.primary}
              />
              <View style={[styles.settingContent, { marginLeft: spacing.md }]}>
                <Text style={[styles.settingLabel, { color: tc.text }]}>
                  {language === 'es' ? 'Tema de la App' : 'App Theme'}
                </Text>
                <View style={styles.themeToggleRow}>
                  <Text style={[
                    styles.themeLabel,
                    { color: !isDark ? tc.primary : tc.textTertiary, fontWeight: !isDark ? '700' : '400' },
                  ]}>
                    {language === 'es' ? 'Claro' : 'Light'}
                  </Text>
                  <Switch
                    value={isDark}
                    onValueChange={(val) => setTheme(val ? 'dark' : 'light')}
                    trackColor={{ false: `${tc.primary}50`, true: `${tc.primary}50` }}
                    thumbColor={tc.primary}
                    ios_backgroundColor={`${tc.primary}50`}
                  />
                  <Text style={[
                    styles.themeLabel,
                    { color: isDark ? tc.primary : tc.textTertiary, fontWeight: isDark ? '700' : '400' },
                  ]}>
                    {language === 'es' ? 'Oscuro' : 'Dark'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Market Filter */}
          <View style={[styles.settingCard, { backgroundColor: tc.surface, borderColor: tc.border, marginBottom: spacing.sm, flexDirection: 'column', alignItems: 'stretch' }]}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="public" size={24} color={tc.primary} />
              <View style={[styles.settingContent, { marginLeft: spacing.md }]}>
                <Text style={[styles.settingLabel, { color: tc.text }]}>
                  {t('marketFilter')}
                </Text>
                <Text style={[styles.settingValue, { color: tc.textSecondary }]}>
                  {t('marketFilterSubtitle')}
                </Text>
              </View>
            </View>
            <View style={styles.marketFilterRow}>
              {(['ALL', 'EEUU', 'ARG'] as const).map((opt) => {
                const isSelected = marketFilter === opt;
                const label = opt === 'ALL' ? t('marketAll') : opt === 'EEUU' ? t('marketEEUU') : t('marketARG');
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.marketFilterOption,
                      { backgroundColor: isSelected ? tc.primary : tc.card, borderColor: isSelected ? tc.primary : tc.border },
                    ]}
                    onPress={() => setMarketFilter(opt)}
                  >
                    <Text style={[styles.marketFilterText, { color: isSelected ? '#fff' : tc.textSecondary }]}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Push Notifications */}
          <View style={[styles.settingCard, { backgroundColor: tc.surface, borderColor: tc.border, marginBottom: spacing.sm }]}>
            <View style={styles.settingLeft}>
              <MaterialIcons name="notifications" size={24} color={tc.primary} />
              <View style={[styles.settingContent, { marginLeft: spacing.md }]}>
                <Text style={[styles.settingLabel, { color: tc.text }]}>{t('notificationsEnabled')}</Text>
                <Text style={[styles.settingValue, { color: tc.textSecondary }]}>{t('notificationsEnabledDesc')}</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: tc.border, true: `${tc.primary}60` }}
              thumbColor={notificationsEnabled ? tc.primary : tc.textTertiary}
              ios_backgroundColor={tc.border}
            />
          </View>

          {/* Language Selector */}
          <TouchableOpacity
            style={[styles.settingCard, { backgroundColor: tc.surface, borderColor: tc.border }]}
            onPress={() => setShowLanguageModal(true)}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="language" size={24} color={tc.primary} />
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: tc.text }]}>{t('appLanguage')}</Text>
                <Text style={[styles.settingValue, { color: tc.textSecondary }]}>
                  {language === 'en' ? t('english') : t('spanish')}
                </Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={tc.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Legal Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: tc.textSecondary }]}>{t('legal') || 'Legal'}</Text>

          <TouchableOpacity
            style={[styles.settingCard, { backgroundColor: tc.surface, borderColor: tc.border }]}
            onPress={handleViewTerms}
          >
            <View style={styles.settingLeft}>
              <MaterialIcons name="gavel" size={24} color={tc.primary} />
              <View style={styles.settingContent}>
                <Text style={[styles.settingLabel, { color: tc.text }]}>{t('viewTermsAndConditions')}</Text>
                <View style={styles.termsVersionRow}>
                  <Text style={[styles.settingValue, { color: tc.textSecondary }]}>
                    {t('termsVersion')}: {CURRENT_TERMS_VERSION}
                  </Text>
                  {termsUpToDate ? (
                    <View style={[styles.termsStatusBadge, { backgroundColor: `${tc.success}15`, borderColor: `${tc.success}40` }]}>
                      <MaterialIcons name="check-circle" size={12} color={tc.success} />
                      <Text style={[styles.termsStatusText, { color: tc.success }]}>
                        {language === 'es' ? 'Al día' : 'Up to date'}
                      </Text>
                    </View>
                  ) : (
                    <View style={[styles.termsStatusBadge, { backgroundColor: `${tc.warning}15`, borderColor: `${tc.warning}40` }]}>
                      <MaterialIcons name="warning" size={12} color={tc.warning} />
                      <Text style={[styles.termsStatusText, { color: tc.warning }]}>
                        {language === 'es' ? 'Revisar' : 'Review needed'}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={24} color={tc.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: tc.surface, borderColor: tc.error }]}
          onPress={handleLogout}
        >
          <MaterialIcons name="logout" size={24} color={tc.error} />
          <Text style={[styles.logoutText, { color: tc.error }]}>{t('logout')}</Text>
        </TouchableOpacity>

        {/* Delete Account Button */}
        <TouchableOpacity style={styles.deleteAccountButton} onPress={() => setShowDeleteModal(true)}>
          <MaterialIcons name="delete-forever" size={22} color={tc.textTertiary} />
          <Text style={[styles.deleteAccountText, { color: tc.textTertiary }]}>{t('deleteAccount')}</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Delete Account Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={handleCloseDeleteModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: tc.surface }]}>
            {deleteStep === 'confirm' ? (
              <>
                <View style={[styles.deleteIconContainer, { backgroundColor: `${tc.error}12` }]}>
                  <MaterialIcons name="delete-forever" size={40} color={tc.error} />
                </View>
                <Text style={[styles.deleteModalTitle, { color: tc.text }]}>{t('deleteAccount')}</Text>
                <Text style={[styles.deleteModalMessage, { color: tc.textSecondary }]}>{t('deleteAccountWarning')}</Text>
                <TouchableOpacity
                  style={[styles.deleteConfirmButton, { backgroundColor: tc.error }, sendingOtp && styles.buttonDisabledStyle]}
                  onPress={handleSendDeleteOTP}
                  disabled={sendingOtp}
                >
                  {sendingOtp ? (
                    <ActivityIndicator color={tc.background} size="small" />
                  ) : (
                    <Text style={[styles.deleteConfirmButtonText, { color: tc.background }]}>{t('sendVerificationCode')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalCloseButton, { backgroundColor: tc.card, borderColor: tc.border }]}
                  onPress={handleCloseDeleteModal}
                  disabled={sendingOtp}
                >
                  <Text style={[styles.modalCloseText, { color: tc.text }]}>{t('cancel')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.deleteIconContainer, { backgroundColor: `${tc.error}12` }]}>
                  <MaterialIcons name="mark-email-unread" size={40} color={tc.error} />
                </View>
                <Text style={[styles.deleteModalTitle, { color: tc.text }]}>{t('verifyToDelete')}</Text>
                <Text style={[styles.deleteModalMessage, { color: tc.textSecondary }]}>
                  {t('deleteAccountOtpSent')} {user?.email}
                </Text>
                <View style={styles.otpInputGroup}>
                  <Text style={[styles.otpInputLabel, { color: tc.textSecondary }]}>{t('verificationCode')}</Text>
                  <TextInput
                    style={[styles.otpInput, { color: tc.text, backgroundColor: tc.card, borderColor: tc.border }]}
                    value={deleteOtp}
                    onChangeText={setDeleteOtp}
                    placeholder={t('enterCode')}
                    placeholderTextColor={tc.textTertiary}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!deletingAccount}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.deleteConfirmButton, { backgroundColor: tc.error }, deletingAccount && styles.buttonDisabledStyle]}
                  onPress={handleConfirmDelete}
                  disabled={deletingAccount}
                >
                  {deletingAccount ? (
                    <ActivityIndicator color={tc.background} size="small" />
                  ) : (
                    <Text style={[styles.deleteConfirmButtonText, { color: tc.background }]}>{t('deleteAccountConfirm')}</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[(sendingOtp || deleteResendCooldown > 0) && styles.buttonDisabledStyle, styles.resendOtpButton]}
                  onPress={handleResendDeleteOTP}
                  disabled={sendingOtp || deleteResendCooldown > 0}
                >
                  <Text style={[styles.resendOtpText, { color: deleteResendCooldown > 0 ? tc.textSecondary : tc.primary }]}>
                    {deleteResendCooldown > 0 ? `${t('resendCode')} (${deleteResendCooldown}s)` : t('resendCode')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalCloseButton, { backgroundColor: tc.card, borderColor: tc.border }]}
                  onPress={handleCloseDeleteModal}
                  disabled={deletingAccount}
                >
                  <Text style={[styles.modalCloseText, { color: tc.text }]}>{t('cancel')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Risk Profile Form Modal ── */}
      <Modal visible={showRiskProfileForm} transparent animationType="slide" onRequestClose={() => setShowRiskProfileForm(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: tc.surface, maxHeight: '90%' }]}>
            <Text style={[styles.modalTitle, { color: tc.text }]}>{t('riskProfileTitle')}</Text>
            <Text style={[styles.riskFormProgress, { color: tc.textSecondary }]}>
              {t('riskProfileProgress').replace('{current}', String(currentQuestion + 1)).replace('{total}', String(TOTAL_QUESTIONS))}
            </Text>

            {/* Progress bar */}
            <View style={[styles.progressBarBg, { backgroundColor: tc.border }]}>
              <View style={[styles.progressBarFill, { backgroundColor: tc.primary, width: `${((currentQuestion + 1) / TOTAL_QUESTIONS) * 100}%` }]} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: spacing.md }}>
              <Text style={[styles.riskFormQuestion, { color: tc.text }]}>
                {`${currentQuestion + 1}. ${t(('riskProfileQuestion' + (currentQuestion + 1)) as any)}`}
              </Text>
              <View style={styles.riskFormOptions}>
                {OPTIONS[currentQuestion].map((optKey, idx) => {
                  const answerKey = ANSWER_KEYS[idx];
                  const isSelected = answers[currentQuestion] === answerKey;
                  return (
                    <TouchableOpacity
                      key={optKey}
                      style={[
                        styles.riskFormOption,
                        { backgroundColor: tc.card, borderColor: tc.border },
                        isSelected && { backgroundColor: `${tc.primary}15`, borderColor: tc.primary },
                      ]}
                      onPress={() => handleSelectAnswer(answerKey)}
                    >
                      <View style={[
                        styles.riskFormCheckbox,
                        { borderColor: isSelected ? tc.primary : tc.border },
                        isSelected && { backgroundColor: tc.primary },
                      ]}>
                        {isSelected && <MaterialIcons name="check" size={14} color="#fff" />}
                      </View>
                      <Text style={[styles.riskFormOptionText, { color: isSelected ? tc.text : tc.textSecondary }]}>
                        {t(optKey as any)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={styles.riskFormNavRow}>
              <TouchableOpacity
                style={[styles.riskFormNavBtn, { backgroundColor: tc.card, borderColor: tc.border }, currentQuestion === 0 && styles.buttonDisabledStyle]}
                onPress={handlePrevQuestion}
                disabled={currentQuestion === 0}
              >
                <Text style={[styles.riskFormNavBtnText, { color: tc.text }]}>{t('riskProfilePrev')}</Text>
              </TouchableOpacity>

              {currentQuestion < TOTAL_QUESTIONS - 1 ? (
                <TouchableOpacity
                  style={[
                    styles.riskFormNavBtn,
                    { backgroundColor: tc.primary },
                    !answers[currentQuestion] && styles.buttonDisabledStyle,
                  ]}
                  onPress={handleNextQuestion}
                  disabled={!answers[currentQuestion]}
                >
                  <Text style={[styles.riskFormNavBtnText, { color: '#fff' }]}>{t('riskProfileNext')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.riskFormNavBtn,
                    { backgroundColor: tc.primary },
                    (!answers[currentQuestion] || submittingRiskProfile) && styles.buttonDisabledStyle,
                  ]}
                  onPress={handleSubmitRiskProfile}
                  disabled={!answers[currentQuestion] || submittingRiskProfile}
                >
                  {submittingRiskProfile
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={[styles.riskFormNavBtnText, { color: '#fff' }]}>{t('riskProfileSubmit')}</Text>}
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: tc.card, borderColor: tc.border, marginTop: spacing.sm }]}
              onPress={() => setShowRiskProfileForm(false)}
            >
              <Text style={[styles.modalCloseText, { color: tc.text }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Risk Profile Result Modal ── */}
      <Modal visible={showRiskProfileResult} transparent animationType="fade" onRequestClose={() => setShowRiskProfileResult(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: tc.surface }]}>
            <View style={[styles.deleteIconContainer, { backgroundColor: `${getRiskProfileColor(pendingProfile)}12` }]}>
              <MaterialIcons name="psychology" size={40} color={getRiskProfileColor(pendingProfile)} />
            </View>
            <Text style={[styles.deleteModalTitle, { color: tc.text }]}>{t('riskProfileResult')}</Text>
            <View style={[styles.riskProfileBadge, { backgroundColor: `${getRiskProfileColor(pendingProfile)}15`, borderColor: `${getRiskProfileColor(pendingProfile)}40`, alignSelf: 'center', marginBottom: spacing.md }]}>
              <View style={[styles.riskProfileDot, { backgroundColor: getRiskProfileColor(pendingProfile) }]} />
              <Text style={[styles.riskProfileBadgeText, { color: getRiskProfileColor(pendingProfile), fontSize: 16, fontWeight: '700' }]}>
                {getRiskProfileName(pendingProfile)}
              </Text>
            </View>
            <Text style={[styles.deleteModalMessage, { color: tc.textSecondary }]}>
              {getRiskProfileDesc(pendingProfile)}
            </Text>
            <TouchableOpacity
              style={[styles.deleteConfirmButton, { backgroundColor: tc.primary }]}
              onPress={() => setShowRiskProfileResult(false)}
            >
              <Text style={[styles.deleteConfirmButtonText, { color: '#fff' }]}>{t('riskProfileUnderstood')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Language Selection Modal */}
      <Modal visible={showLanguageModal} transparent animationType="fade" onRequestClose={() => setShowLanguageModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { backgroundColor: tc.surface }]}>
            <View style={styles.modalHeader}>
              <MaterialIcons name="language" size={32} color={tc.primary} />
              <Text style={[styles.modalTitle, { color: tc.text }]}>{t('changeLanguage')}</Text>
              <Text style={[styles.modalSubtitle, { color: tc.textSecondary }]}>{t('selectLanguageSubtitle')}</Text>
            </View>
            <View style={styles.languageOptions}>
              <TouchableOpacity
                style={[styles.languageButton, { backgroundColor: tc.card, borderColor: tc.border },
                  language === 'en' && { borderColor: tc.primary, backgroundColor: `${tc.primary}10` }]}
                onPress={() => handleLanguageSelect('en')}
              >
                <View style={styles.languageLeft}>
                  <View style={[styles.languageIcon, { backgroundColor: tc.background }]}>
                    <Text style={styles.flagEmoji}>🇺🇸</Text>
                  </View>
                  <Text style={[styles.languageText, { color: language === 'en' ? tc.primary : tc.text }]}>
                    {t('english')}
                  </Text>
                </View>
                {language === 'en' && <MaterialIcons name="check-circle" size={24} color={tc.primary} />}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.languageButton, { backgroundColor: tc.card, borderColor: tc.border },
                  language === 'es' && { borderColor: tc.primary, backgroundColor: `${tc.primary}10` }]}
                onPress={() => handleLanguageSelect('es')}
              >
                <View style={styles.languageLeft}>
                  <View style={[styles.languageIcon, { backgroundColor: tc.background }]}>
                    <Text style={styles.flagEmoji}>🇦🇷</Text>
                  </View>
                  <Text style={[styles.languageText, { color: language === 'es' ? tc.primary : tc.text }]}>
                    {t('spanish')}
                  </Text>
                </View>
                {language === 'es' && <MaterialIcons name="check-circle" size={24} color={tc.primary} />}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: tc.card, borderColor: tc.border }]}
              onPress={() => setShowLanguageModal(false)}
            >
              <Text style={[styles.modalCloseText, { color: tc.text }]}>{t('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  headerTitle: { ...typography.h2 },
  headerSubtitle: { ...typography.bodySmall, marginTop: spacing.xs },
  scrollContent: { padding: spacing.lg },
  section: { marginBottom: spacing.xl },
  sectionTitle: {
    ...typography.bodySmall,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoContent: { marginLeft: spacing.md, flex: 1 },
  infoLabel: { ...typography.bodySmall },
  infoValue: { ...typography.body, fontWeight: '500', marginTop: spacing.xs },
  settingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingContent: { marginLeft: spacing.md, flex: 1 },
  settingLabel: { ...typography.body, fontWeight: '500' },
  settingValue: { ...typography.bodySmall, marginTop: spacing.xs },
  themeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  themeLabel: { ...typography.bodySmall },
  marketFilterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
  },
  marketFilterOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  marketFilterText: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: spacing.xl,
  },
  logoutText: { ...typography.body, fontWeight: '600', marginLeft: spacing.sm },
  deleteAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  deleteAccountText: { ...typography.bodySmall, fontWeight: '500' },
  termsVersionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  termsStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  termsStatusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  deleteIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  deleteModalTitle: { ...typography.h2, textAlign: 'center', marginBottom: spacing.sm },
  deleteModalMessage: { ...typography.body, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  deleteConfirmButton: {
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  deleteConfirmButtonText: { ...typography.body, fontWeight: '600' },
  buttonDisabledStyle: { opacity: 0.5 },
  otpInputGroup: { marginBottom: spacing.lg, gap: spacing.sm },
  otpInputLabel: { ...typography.bodySmall, fontWeight: '500' },
  otpInput: { ...typography.body, padding: spacing.md, borderRadius: 12, borderWidth: 1 },
  resendOtpButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  resendOtpText: { ...typography.bodySmall, fontWeight: '500' },
  accountTypeBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.xs,
  },
  accountTypeBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  subscribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
  },
  subscribeButtonText: { ...typography.body, fontWeight: '600' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modal: {
    borderRadius: 24,
    padding: spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  modalHeader: { alignItems: 'center', marginBottom: spacing.xl },
  modalTitle: { ...typography.h2, marginTop: spacing.md, textAlign: 'center' },
  modalSubtitle: { ...typography.body, marginTop: spacing.xs, textAlign: 'center' },
  languageOptions: { gap: spacing.md, marginBottom: spacing.lg },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 16,
    borderWidth: 2,
  },
  languageLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  languageIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  flagEmoji: { fontSize: 28 },
  languageText: { ...typography.h3 },
  modalCloseButton: {
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCloseText: { ...typography.body, fontWeight: '600' },
  // Risk Profile
  riskProfileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    alignSelf: 'flex-start',
  },
  riskProfileDot: { width: 10, height: 10, borderRadius: 5 },
  riskProfileBadgeText: { ...typography.body, fontWeight: '700' },
  updateRiskBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  updateRiskBtnText: { fontSize: 12, fontWeight: '600' },
  riskFormProgress: { ...typography.bodySmall, marginTop: spacing.xs, marginBottom: spacing.sm },
  progressBarBg: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: 4, borderRadius: 2 },
  riskFormQuestion: { ...typography.body, fontWeight: '600', lineHeight: 22, marginBottom: spacing.lg },
  riskFormOptions: { gap: spacing.sm, marginBottom: spacing.lg },
  riskFormOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  riskFormCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  riskFormOptionText: { ...typography.body, flex: 1, lineHeight: 22 },
  riskFormNavRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  riskFormNavBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  riskFormNavBtnText: { ...typography.body, fontWeight: '600' },
});
