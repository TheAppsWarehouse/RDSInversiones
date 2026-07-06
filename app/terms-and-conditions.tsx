import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLanguage } from '@/hooks/useLanguage';
import { CURRENT_TERMS_VERSION } from '@/contexts/LanguageContext';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/template';
import { recordTermsAcceptance } from '@/services/termsService';

export default function TermsAndConditionsScreen() {
  const { t, setTermsAccepted, termsUpToDate, acceptedTermsVersion } = useLanguage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ mode?: string }>();
  const { user } = useAuth();

  // mode=view → read-only with back arrow; mode=accept (default) → acceptance flow
  const isViewMode = params.mode === 'view';
  // Show "updated" banner when user has accepted a previous version but not the current one
  const isUpdatedTerms = !isViewMode && !termsUpToDate && acceptedTermsVersion !== null;

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    const isAtBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;

    if (isAtBottom && !scrolledToBottom) {
      setScrolledToBottom(true);
    }
  };

  const handleAccept = async () => {
    setAccepting(true);
    try {
      // 1. Record acceptance in DB (full audit trail) if user is authenticated
      if (user?.id) {
        await recordTermsAcceptance(user.id);
      }
      // 2. Persist acceptance locally so the app knows T&C are up to date
      await setTermsAccepted(true);
    } finally {
      setAccepting(false);
    }
    // Navigate forward
    router.replace('/login?register=true');
  };

  const handleBack = () => {
    router.back();
  };

  const renderVersionBadge = () => (
    <View style={[styles.versionBadge, { backgroundColor: `${colors.primary}12`, borderColor: `${colors.primary}30` }]}>
      <MaterialIcons name="verified" size={14} color={colors.primary} />
      <Text style={[styles.versionBadgeText, { color: colors.primary }]}>
        {t('termsVersion')}: {CURRENT_TERMS_VERSION}
      </Text>
    </View>
  );

  const renderTermsContent = () => {
    const content = t('termsContent');
    const lines = content.split('\n');

    return lines.map((line, index) => {
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <Text key={index} style={[styles.paragraph, { color: colors.text }]}>
            {parts.map((part, i) => {
              if (i % 2 === 1) {
                return <Text key={i} style={[styles.bold, { color: colors.text }]}>{part}</Text>;
              }
              return <Text key={i}>{part}</Text>;
            })}
          </Text>
        );
      }

      if (line.trim().startsWith('•')) {
        return (
          <Text key={index} style={[styles.bulletPoint, { color: colors.text }]}>
            {line}
          </Text>
        );
      }

      if (line.trim() === '') {
        return <View key={index} style={styles.spacing} />;
      }

      return (
        <Text key={index} style={[styles.paragraph, { color: colors.text }]}>
          {line}
        </Text>
      );
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {isViewMode ? (
          <TouchableOpacity onPress={handleBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <MaterialIcons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <MaterialIcons name="gavel" size={32} color={colors.primary} />
        )}
        <Text style={[styles.headerTitle, { color: colors.text }]}>{t('termsAndConditions')}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
          {isViewMode ? '' : t('pleaseReadCarefully')}
        </Text>
        {renderVersionBadge()}
      </View>

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
          {isUpdatedTerms && (
          <View style={[styles.updatedBanner, { backgroundColor: `${colors.warning}15`, borderColor: `${colors.warning}40` }]}>
            <MaterialIcons name="info" size={18} color={colors.warning} />
            <Text style={[styles.updatedBannerText, { color: colors.warning }]}>{t('termsUpdatedMessage')}</Text>
          </View>
        )}
        {renderTermsContent()}
      </ScrollView>

      {/* Action Buttons — only shown in accept mode */}
      {!isViewMode && (
        <View style={[styles.actions, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
          {!scrolledToBottom && (
            <View style={[styles.scrollPrompt, { backgroundColor: `${colors.primary}10` }]}>
              <MaterialIcons name="arrow-downward" size={20} color={colors.primary} />
              <Text style={[styles.scrollPromptText, { color: colors.primary }]}>
                {t('scrollToAccept')}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.button,
              styles.buttonAccept,
              (!scrolledToBottom || accepting) && styles.buttonDisabled,
            ]}
            onPress={handleAccept}
            disabled={!scrolledToBottom || accepting}
          >
            {accepting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={[styles.buttonAcceptText, { color: colors.background }]}>{t('acceptTerms')}</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  paragraph: {
    ...typography.body,
    lineHeight: 24,
    marginBottom: spacing.sm,
  },
  bold: {
    fontWeight: '700',
  },
  bulletPoint: {
    ...typography.body,
    lineHeight: 24,
    marginBottom: spacing.xs,
    paddingLeft: spacing.md,
  },
  spacing: {
    height: spacing.sm,
  },
  actions: {
    borderTopWidth: 1,
    padding: spacing.lg,
  },
  versionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  versionBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  updatedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  updatedBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  scrollPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.sm,
    borderRadius: 8,
  },
  scrollPromptText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  button: {
    padding: spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonAccept: {
    backgroundColor: '#10b981',
  },
  buttonAcceptText: {
    ...typography.body,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
