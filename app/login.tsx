import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useAuth, useAlert, getSupabaseClient } from '@/template';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { accountService } from '@/services/accountService';
import { useLanguage } from '@/hooks/useLanguage';
import { calculateRiskProfile, saveRiskProfile } from '@/services/riskProfileService';
import { registerPushToken } from '@/services/notificationService';

type LoginStep =
  | 'credentials'
  | 'privileged_otp'   // Admin or Dev OTP 2FA
  | 'register_otp'
  | 'risk_profile'     // Investment profile questionnaire (non-privileged new users)
  | 'forgot_email'     // Password reset: enter email
  | 'forgot_otp'       // Password reset: verify OTP
  | 'forgot_new_pass'; // Password reset: set new password

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

export default function LoginScreen() {
  const { sendOTP, verifyOTPAndLogin, signInWithPassword, operationLoading } = useAuth();
  const { showAlert } = useAlert();
  const { t, keepSignedIn, setKeepSignedIn, termsAccepted } = useLanguage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ register?: string }>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [loginStep, setLoginStep] = useState<LoginStep>('credentials');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [checkingAccountStatus, setCheckingAccountStatus] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  // Whether the current email being logged in is Admin/Dev (disables Keep Signed In)
  const [isPrivilegedAccount, setIsPrivilegedAccount] = useState(false);
  // Risk Profile form state (shown after OTP for non-privileged new registrations)
  const [registeredUser, setRegisteredUser] = useState<any>(null);
  const [rpCurrentQuestion, setRpCurrentQuestion] = useState(0);
  const [rpAnswers, setRpAnswers] = useState<string[]>(Array(TOTAL_QUESTIONS).fill(''));
  const [rpSubmitting, setRpSubmitting] = useState(false);
  const [rpShowResult, setRpShowResult] = useState(false);
  const [rpResultProfile, setRpResultProfile] = useState<string>('');

  // ─── Forgot Password state ─────────────────────────────────────────────────
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpResendCooldown, setFpResendCooldown] = useState(0);
  const [fpCheckingAccount, setFpCheckingAccount] = useState(false);
  const [fpSettingPassword, setFpSettingPassword] = useState(false);
  const [fpShowNewPass, setFpShowNewPass] = useState(false);
  const [fpShowConfirmPass, setFpShowConfirmPass] = useState(false);

  // If returning from T&C acceptance with register=true, switch to register mode
  useEffect(() => {
    if (params.register === 'true') {
      setIsRegisterMode(true);
    }
  }, [params.register]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (fpResendCooldown <= 0) return;
    const timer = setTimeout(() => setFpResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [fpResendCooldown]);

  // Check account type whenever email changes (to show/hide keep-signed-in slider)
  useEffect(() => {
    if (!email) { setIsPrivilegedAccount(false); return; }
    const timeoutId = setTimeout(async () => {
      const { data } = await accountService.getAccountType(email.trim().toLowerCase());
      setIsPrivilegedAccount(data === 'Admin' || data === 'Dev');
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [email]);

  // ─── Registration Flow ──────────────────────────────────────────────────────

  const handleResendRegisterOTP = async () => {
    const { error } = await sendOTP(email);
    if (error) { showAlert('Error', error); return; }
    setResendCooldown(60);
    showAlert('Success', 'A new verification code has been sent to your email');
  };

  const handleSendOTP = async () => {
    if (!email) { showAlert('Error', t('enterEmail')); return; }
    if (!password || password.length < 6) { showAlert('Error', t('passwordMinLength')); return; }
    if (password !== confirmPassword) { showAlert('Error', t('passwordsDoNotMatch')); return; }

    const { error } = await sendOTP(email);
    if (error) { showAlert('Error', error); return; }

    setLoginStep('register_otp');
    setResendCooldown(60);
    showAlert('Success', t('verificationCodeSent'));
  };

  const handleVerifyOTP = async () => {
    if (!otp) { showAlert('Error', t('enterVerificationCode')); return; }

    const { error, user: newUser } = await verifyOTPAndLogin(email, otp, { password });
    if (error) { showAlert('Error', error); return; }

    if (newUser) {
      // Check if email belongs to Admin/Dev — if so, skip risk profile
      const { data: accountType } = await accountService.getAccountType(email.trim().toLowerCase());
      const isPrivileged = accountType === 'Admin' || accountType === 'Dev';

      // Register Free accounts in allowed_emails with new_affiliates = true on first registration
      if (!isPrivileged && accountType !== 'Affiliate') {
        // Insert as Free account with new_affiliates = true
        accountService.recordFreeRegistration(email.trim().toLowerCase()).catch(() => {});
      }

      if (isPrivileged) {
        registerPushToken(newUser.id).catch(() => {});
        router.replace('/(tabs)');
      } else {
        // Show Risk Profile questionnaire for non-privileged accounts
        setRegisteredUser(newUser);
        setRpAnswers(Array(TOTAL_QUESTIONS).fill(''));
        setRpCurrentQuestion(0);
        setLoginStep('risk_profile');
      }
    }
  };

  const handleRpSelectAnswer = (answerKey: string) => {
    const updated = [...rpAnswers];
    updated[rpCurrentQuestion] = answerKey;
    setRpAnswers(updated);
  };

  const handleRpNext = () => {
    if (rpCurrentQuestion < TOTAL_QUESTIONS - 1) setRpCurrentQuestion((q) => q + 1);
  };

  const handleRpPrev = () => {
    if (rpCurrentQuestion > 0) setRpCurrentQuestion((q) => q - 1);
  };

  const handleRpSubmit = async () => {
    if (!registeredUser?.id) return;
    setRpSubmitting(true);
    const { profile } = calculateRiskProfile(rpAnswers);
    await saveRiskProfile(registeredUser.id, profile);
    setRpSubmitting(false);
    if (registeredUser?.id) registerPushToken(registeredUser.id).catch(() => {});
    setRpResultProfile(profile);
    setRpShowResult(true);
  };

  const handleRpResultClose = () => {
    setRpShowResult(false);
    router.replace('/(tabs)');
  };

  const getRpProfileColor = (profile: string) => {
    if (profile === 'Conservative') return colors.primary;
    if (profile === 'Moderate') return '#f59e0b';
    return '#ef4444';
  };

  const getRpProfileName = (profile: string) => {
    if (profile === 'Conservative') return t('riskProfileConservativeName');
    if (profile === 'Moderate') return t('riskProfileModerateName');
    return t('riskProfileAggressiveName');
  };

  const getRpProfileDesc = (profile: string) => {
    if (profile === 'Conservative') return t('riskProfileConservativeDesc');
    if (profile === 'Moderate') return t('riskProfileModerateDesc');
    return t('riskProfileAggressiveDesc');
  };

  // ─── Login Flow ─────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!email || !password) { showAlert('Error', t('enterPassword')); return; }

    // Check if account requires OTP 2FA (Admin or Dev)
    setCheckingAccountStatus(true);
    const requiresOtp = await accountService.requiresOtpLogin(email.trim().toLowerCase());
    setCheckingAccountStatus(false);

    if (requiresOtp) {
      // First validate password
      const { error: loginError } = await signInWithPassword(email.trim().toLowerCase(), password);
      if (loginError) { showAlert('Error', loginError); return; }

      // Password correct → send OTP for 2FA
      const { error: otpError } = await sendOTP(email.trim().toLowerCase());
      if (otpError) { showAlert('Error', otpError); return; }

      setLoginStep('privileged_otp');
      setResendCooldown(60);
      showAlert('Success', 'Verification code sent to your email');
      return;
    }

    // Standard password login (Affiliate / Free)
    const { error, user } = await signInWithPassword(email.trim().toLowerCase(), password);
    if (error) { showAlert('Error', error); return; }

    // Navigate on success — user object may be null if auth state resolves asynchronously
    const uid = user?.id;
    if (uid) registerPushToken(uid).catch(() => {});
    router.replace('/(tabs)');
  };

  const handleResendPrivilegedOTP = async () => {
    const { error } = await sendOTP(email);
    if (error) { showAlert('Error', error); return; }
    setResendCooldown(60);
    showAlert('Success', 'A new verification code has been sent to your email');
  };

  const handleVerifyPrivilegedOTP = async () => {
    if (!otp) { showAlert('Error', t('enterVerificationCode')); return; }

    const { error, user } = await verifyOTPAndLogin(email, otp);
    if (error) { showAlert('Error', error); return; }

    if (user) {
      registerPushToken(user.id).catch(() => {});
      router.replace('/(tabs)');
    }
  };

  // ─── Forgot Password handlers ──────────────────────────────────────────────

  const handleForgotPasswordOpen = () => {
    setFpEmail(email); // pre-fill with whatever is already typed
    setFpOtp('');
    setFpNewPassword('');
    setFpConfirmPassword('');
    setFpResendCooldown(0);
    setLoginStep('forgot_email');
  };

  const handleForgotPasswordSendCode = async () => {
    if (!fpEmail.trim()) { showAlert('Error', t('enterEmail')); return; }
    setFpCheckingAccount(true);
    const { data: accountType } = await accountService.getAccountType(fpEmail.trim().toLowerCase());
    setFpCheckingAccount(false);
    if (accountType === 'Admin' || accountType === 'Dev') {
      showAlert('Error', t('passwordResetNotAvailable'));
      return;
    }
    const { error } = await sendOTP(fpEmail.trim().toLowerCase());
    if (error) { showAlert('Error', error); return; }
    setFpResendCooldown(60);
    setLoginStep('forgot_otp');
    showAlert(t('success'), t('verificationCodeSent'));
  };

  const handleForgotPasswordResendCode = async () => {
    const { error } = await sendOTP(fpEmail.trim().toLowerCase());
    if (error) { showAlert('Error', error); return; }
    setFpResendCooldown(60);
    showAlert(t('success'), t('verificationCodeSent'));
  };

  const handleForgotPasswordVerifyOtp = async () => {
    if (!fpOtp) { showAlert('Error', t('enterVerificationCode')); return; }
    // verifyOTPAndLogin logs the user in; we then immediately move to set new password
    const { error } = await verifyOTPAndLogin(fpEmail.trim().toLowerCase(), fpOtp);
    if (error) { showAlert('Error', error); return; }
    setLoginStep('forgot_new_pass');
  };

  const handleForgotPasswordSetNew = async () => {
    if (!fpNewPassword || fpNewPassword.length < 6) {
      showAlert('Error', t('passwordMinLength'));
      return;
    }
    if (fpNewPassword !== fpConfirmPassword) {
      showAlert('Error', t('passwordsDoNotMatch'));
      return;
    }
    setFpSettingPassword(true);
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: fpNewPassword });
    setFpSettingPassword(false);
    if (error) { showAlert('Error', error.message); return; }
    // Sign out so user logs in fresh with new password
    await supabase.auth.signOut();
    showAlert(t('success'), t('resetPasswordSuccess'));
    setLoginStep('credentials');
    setFpEmail('');
    setFpOtp('');
    setFpNewPassword('');
    setFpConfirmPassword('');
  };

  const handleForgotPasswordBack = () => {
    if (loginStep === 'forgot_email') {
      setLoginStep('credentials');
    } else if (loginStep === 'forgot_otp') {
      setLoginStep('forgot_email');
    } else if (loginStep === 'forgot_new_pass') {
      // Stay on new pass — user is already verified
    }
  };

  const toggleMode = () => {
    if (!isRegisterMode) {
      // Always show T&C before allowing registration
      router.push('/terms-and-conditions?mode=accept');
      return;
    }
    setIsRegisterMode(false);
    setLoginStep('credentials');
    setOtp('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleBack = () => {
    setLoginStep('credentials');
    setOtp('');
  };

  const isLoading = operationLoading || checkingAccountStatus;

  const renderOtpStep = (
    title: string,
    subtitle: string,
    onVerify: () => void,
    onResend?: () => void,
    cooldown?: number
  ) => (
    <View style={styles.form}>
      <View style={styles.otpHeader}>
        <TouchableOpacity
          onPress={handleBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={isLoading}
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={styles.otpHeaderText}>
          <Text style={[styles.otpTitle, { color: colors.text }]}>{title}</Text>
          {subtitle.split('\n').map((line, i) => (
            <Text key={i} style={[styles.otpSubtitle, { color: colors.textSecondary }]}>{line}</Text>
          ))}
        </View>
      </View>

      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{t('verificationCode')}</Text>
        <TextInput
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          value={otp}
          onChangeText={setOtp}
          placeholder={t('enterCode')}
          placeholderTextColor={colors.textTertiary}
          keyboardType="number-pad"
          maxLength={6}
          editable={!isLoading}
        />
      </View>

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={onVerify}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.background }]}>Verify</Text>
        )}
      </TouchableOpacity>

      {onResend && (
        <TouchableOpacity
          style={[styles.resendButton, (isLoading || (cooldown ?? 0) > 0) && styles.resendButtonDisabled]}
          onPress={onResend}
          disabled={isLoading || (cooldown ?? 0) > 0}
        >
          <Text style={[
            styles.resendButtonText,
            { color: (cooldown ?? 0) > 0 ? colors.textSecondary : colors.primary },
          ]}>
            {(cooldown ?? 0) > 0 ? `${t('resendCode')} (${cooldown}s)` : t('resendCode')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <MaterialIcons name="trending-up" size={48} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>RDS Inversiones</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Stock Market Intelligence</Text>
        </View>

        {/* ── Forgot Password: Enter Email ── */}
        {loginStep === 'forgot_email' && (
          <View style={styles.form}>
            <View style={styles.otpHeader}>
              <TouchableOpacity
                onPress={handleForgotPasswordBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={isLoading || fpCheckingAccount}
              >
                <MaterialIcons name="arrow-back" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.otpHeaderText}>
                <Text style={[styles.otpTitle, { color: colors.text }]}>{t('forgotPasswordTitle')}</Text>
                <Text style={[styles.otpSubtitle, { color: colors.textSecondary }]}>{t('forgotPasswordSubtitle')}</Text>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('email')}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                value={fpEmail}
                onChangeText={setFpEmail}
                placeholder="your.email@example.com"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading && !fpCheckingAccount}
              />
            </View>
            <TouchableOpacity
              style={[styles.button, (isLoading || fpCheckingAccount) && styles.buttonDisabled]}
              onPress={handleForgotPasswordSendCode}
              disabled={isLoading || fpCheckingAccount}
            >
              {(isLoading || fpCheckingAccount) ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.background }]}>{t('sendCode')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Forgot Password: Verify OTP ── */}
        {loginStep === 'forgot_otp' && (
          <View style={styles.form}>
            <View style={styles.otpHeader}>
              <TouchableOpacity
                onPress={handleForgotPasswordBack}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                disabled={isLoading}
              >
                <MaterialIcons name="arrow-back" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
              <View style={styles.otpHeaderText}>
                <Text style={[styles.otpTitle, { color: colors.text }]}>{t('forgotPasswordTitle')}</Text>
                <Text style={[styles.otpSubtitle, { color: colors.textSecondary }]}>
                  {t('forgotPasswordOtpSubtitle')}{`\n${fpEmail}`}
                </Text>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('verificationCode')}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                value={fpOtp}
                onChangeText={setFpOtp}
                placeholder={t('enterCode')}
                placeholderTextColor={colors.textTertiary}
                keyboardType="number-pad"
                maxLength={6}
                editable={!isLoading}
              />
            </View>
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleForgotPasswordVerifyOtp}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.background }]}>Verify</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.resendButton, (isLoading || fpResendCooldown > 0) && styles.resendButtonDisabled]}
              onPress={handleForgotPasswordResendCode}
              disabled={isLoading || fpResendCooldown > 0}
            >
              <Text style={[styles.resendButtonText, { color: fpResendCooldown > 0 ? colors.textSecondary : colors.primary }]}>
                {fpResendCooldown > 0 ? `${t('resendCode')} (${fpResendCooldown}s)` : t('resendCode')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Forgot Password: Set New Password ── */}
        {loginStep === 'forgot_new_pass' && (
          <View style={styles.form}>
            <View style={styles.otpHeaderText}>
              <Text style={[styles.otpTitle, { color: colors.text }]}>{t('forgotPasswordNewTitle')}</Text>
              <Text style={[styles.otpSubtitle, { color: colors.textSecondary }]}>{t('forgotPasswordNewSubtitle')}</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('newPassword')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  value={fpNewPassword}
                  onChangeText={setFpNewPassword}
                  placeholder={t('newPassword')}
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!fpShowNewPass}
                  editable={!fpSettingPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setFpShowNewPass(!fpShowNewPass)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name={fpShowNewPass ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('confirmNewPassword')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  value={fpConfirmPassword}
                  onChangeText={setFpConfirmPassword}
                  placeholder={t('confirmNewPassword')}
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!fpShowConfirmPass}
                  editable={!fpSettingPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setFpShowConfirmPass(!fpShowConfirmPass)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name={fpShowConfirmPass ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.button, fpSettingPassword && styles.buttonDisabled]}
              onPress={handleForgotPasswordSetNew}
              disabled={fpSettingPassword}
            >
              {fpSettingPassword ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.background }]}>{t('setNewPassword')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Privileged OTP (Admin / Dev) */}
        {loginStep === 'privileged_otp' && renderOtpStep(
          'Verification Required',
          `Enter the code sent to\n${email}`,
          handleVerifyPrivilegedOTP,
          handleResendPrivilegedOTP,
          resendCooldown
        )}

        {/* Registration OTP */}
        {loginStep === 'register_otp' && renderOtpStep(
          'Verify Your Email',
          `Enter the code sent to\n${email}`,
          handleVerifyOTP,
          handleResendRegisterOTP,
          resendCooldown
        )}

        {/* Risk Profile Questionnaire */}
        {loginStep === 'risk_profile' && !rpShowResult && (
          <View style={styles.form}>
            <View style={styles.otpHeader}>
              <Text style={[styles.otpTitle, { color: colors.text }]}>{t('riskProfileTitle')}</Text>
              <Text style={[styles.otpSubtitle, { color: colors.textSecondary }]}>{t('riskProfileSubtitle')}</Text>
            </View>

            {/* Progress */}
            <Text style={[styles.label, { color: colors.textSecondary, textAlign: 'center' }]}>
              {t('riskProfileProgress').replace('{current}', String(rpCurrentQuestion + 1)).replace('{total}', String(TOTAL_QUESTIONS))}
            </Text>
            <View style={[styles.progressBarBg, { backgroundColor: colors.border ?? '#e5e7eb' }]}>
              <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${((rpCurrentQuestion + 1) / TOTAL_QUESTIONS) * 100}%` }]} />
            </View>

            <Text style={[styles.rpQuestion, { color: colors.text }]}>
              {`${rpCurrentQuestion + 1}. ${t(('riskProfileQuestion' + (rpCurrentQuestion + 1)) as any)}`}
            </Text>

            <View style={styles.rpOptions}>
              {OPTIONS[rpCurrentQuestion].map((optKey, idx) => {
                const answerKey = ANSWER_KEYS[idx];
                const isSelected = rpAnswers[rpCurrentQuestion] === answerKey;
                return (
                  <TouchableOpacity
                    key={optKey}
                    style={[
                      styles.rpOption,
                      { backgroundColor: colors.surface ?? '#f9fafb', borderColor: colors.border ?? '#e5e7eb' },
                      isSelected && { backgroundColor: `${colors.primary}15`, borderColor: colors.primary },
                    ]}
                    onPress={() => handleRpSelectAnswer(answerKey)}
                  >
                    <View style={[
                      styles.rpCheckbox,
                      { borderColor: isSelected ? colors.primary : (colors.border ?? '#e5e7eb') },
                      isSelected && { backgroundColor: colors.primary },
                    ]}>
                      {isSelected && <MaterialIcons name="check" size={14} color="#fff" />}
                    </View>
                    <Text style={[styles.rpOptionText, { color: isSelected ? colors.text : colors.textSecondary }]}>
                      {t(optKey as any)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.rpNavRow}>
              <TouchableOpacity
                style={[styles.rpNavBtn, { backgroundColor: colors.surface ?? '#f9fafb', borderColor: colors.border ?? '#e5e7eb' }, rpCurrentQuestion === 0 && styles.buttonDisabled]}
                onPress={handleRpPrev}
                disabled={rpCurrentQuestion === 0}
              >
                <Text style={[styles.buttonText, { color: colors.text }]}>{t('riskProfilePrev')}</Text>
              </TouchableOpacity>
              {rpCurrentQuestion < TOTAL_QUESTIONS - 1 ? (
                <TouchableOpacity
                  style={[styles.rpNavBtn, { backgroundColor: colors.primary }, !rpAnswers[rpCurrentQuestion] && styles.buttonDisabled]}
                  onPress={handleRpNext}
                  disabled={!rpAnswers[rpCurrentQuestion]}
                >
                  <Text style={[styles.buttonText, { color: colors.background }]}>{t('riskProfileNext')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.rpNavBtn, { backgroundColor: colors.primary }, (!rpAnswers[rpCurrentQuestion] || rpSubmitting) && styles.buttonDisabled]}
                  onPress={handleRpSubmit}
                  disabled={!rpAnswers[rpCurrentQuestion] || rpSubmitting}
                >
                  {rpSubmitting
                    ? <ActivityIndicator color={colors.background} size="small" />
                    : <Text style={[styles.buttonText, { color: colors.background }]}>{t('riskProfileSubmit')}</Text>}
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Risk Profile Result Modal (inline overlay) */}
        {loginStep === 'risk_profile' && rpShowResult && (
          <View style={styles.form}>
            <View style={[styles.rpResultIcon, { backgroundColor: `${getRpProfileColor(rpResultProfile)}15` }]}>
              <MaterialIcons name="psychology" size={48} color={getRpProfileColor(rpResultProfile)} />
            </View>
            <Text style={[styles.otpTitle, { color: colors.text, textAlign: 'center', marginTop: 16 }]}>{t('riskProfileResult')}</Text>
            <View style={[styles.rpResultBadge, { backgroundColor: `${getRpProfileColor(rpResultProfile)}15`, borderColor: `${getRpProfileColor(rpResultProfile)}40` }]}>
              <Text style={[styles.rpResultBadgeText, { color: getRpProfileColor(rpResultProfile) }]}>
                {getRpProfileName(rpResultProfile)}
              </Text>
            </View>
            <Text style={[styles.otpSubtitle, { color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }]}>
              {getRpProfileDesc(rpResultProfile)}
            </Text>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.primary, marginTop: 8 }]}
              onPress={handleRpResultClose}
            >
              <Text style={[styles.buttonText, { color: colors.background }]}>{t('riskProfileUnderstood')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Credentials */}
        {loginStep === 'credentials' && (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('email')}</Text>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                value={email}
                onChangeText={setEmail}
                placeholder="your.email@example.com"
                placeholderTextColor={colors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>{t('password')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('password')}
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {isRegisterMode && (
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.textSecondary }]}>{t('confirmPassword')}</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[styles.passwordInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder={t('confirmPassword')}
                    placeholderTextColor={colors.textTertiary}
                    secureTextEntry={!showConfirmPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeButton}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialIcons
                      name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Keep Signed In toggle */}
            {!isRegisterMode && (
              <View style={[
                styles.keepSignedInRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isPrivilegedAccount && styles.keepSignedInRowDisabled,
              ]}>
                <View style={styles.keepSignedInLeft}>
                  <MaterialIcons
                    name={isPrivilegedAccount ? 'lock' : 'stay-current-portrait'}
                    size={20}
                    color={isPrivilegedAccount ? colors.textTertiary : colors.textSecondary}
                  />
                  <View style={styles.keepSignedInText}>
                    <Text style={[
                      styles.keepSignedInLabel,
                      { color: colors.text },
                      isPrivilegedAccount && { color: colors.textTertiary },
                    ]}>
                      {t('keepSignedIn')}
                    </Text>
                    {isPrivilegedAccount && (
                      <Text style={[styles.keepSignedInNote, { color: colors.textTertiary }]}>
                        {t('keepSignedInNote')}
                      </Text>
                    )}
                  </View>
                </View>
                <Switch
                  value={isPrivilegedAccount ? false : keepSignedIn}
                  onValueChange={(val) => {
                    if (!isPrivilegedAccount) setKeepSignedIn(val);
                  }}
                  disabled={isPrivilegedAccount || isLoading}
                  trackColor={{ false: colors.border, true: `${colors.primary}60` }}
                  thumbColor={(!isPrivilegedAccount && keepSignedIn) ? colors.primary : colors.textTertiary}
                  ios_backgroundColor={colors.border}
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={isRegisterMode ? handleSendOTP : handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.background }]}>
                  {isRegisterMode ? t('sendCode') : t('signIn')}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toggleButton}
              onPress={toggleMode}
              disabled={isLoading}
            >
              <Text style={[styles.toggleText, { color: colors.primary }]}>
                {isRegisterMode
                  ? t('alreadyHaveAccount')
                  : t('newUser')}
              </Text>
            </TouchableOpacity>

            {!isRegisterMode && (
              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={handleForgotPasswordOpen}
                disabled={isLoading}
              >
                <Text style={[styles.forgotPasswordText, { color: colors.textSecondary }]}>
                  {t('forgotPassword')}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  form: {
    gap: spacing.lg,
  },
  otpHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  otpHeaderText: {
    flex: 1,
  },
  otpTitle: {
    ...typography.h3,
  },
  otpSubtitle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  inputGroup: {
    gap: spacing.sm,
  },
  label: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  input: {
    ...typography.body,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    ...typography.body,
    padding: spacing.md,
    paddingRight: 48,
    borderRadius: 12,
    borderWidth: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  keepSignedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  keepSignedInRowDisabled: {
    opacity: 0.6,
  },
  keepSignedInLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    flex: 1,
    marginRight: spacing.sm,
  },
  keepSignedInText: {
    flex: 1,
  },
  keepSignedInLabel: {
    ...typography.body,
    fontWeight: '500',
  },
  keepSignedInNote: {
    ...typography.caption,
    marginTop: 2,
    lineHeight: 16,
  },
  button: {
    backgroundColor: '#10b981',
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  progressBarBg: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.lg,
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  rpQuestion: {
    ...typography.body,
    fontWeight: '600',
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  rpOptions: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  rpOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  rpCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  rpOptionText: {
    ...typography.body,
    flex: 1,
    lineHeight: 22,
  },
  rpNavRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rpNavBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  rpResultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  rpResultBadge: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignSelf: 'center',
    marginVertical: spacing.md,
  },
  rpResultBadgeText: {
    ...typography.h3,
    fontWeight: '700',
  },
  buttonText: {
    ...typography.body,
    fontWeight: '600',
  },
  toggleButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  toggleText: {
    ...typography.bodySmall,
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    ...typography.bodySmall,
    fontWeight: '500',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginTop: -spacing.sm,
  },
  forgotPasswordText: {
    ...typography.caption,
    fontWeight: '500',
  },
});
