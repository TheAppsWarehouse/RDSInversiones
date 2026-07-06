import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useLanguage } from '@/hooks/useLanguage';

export default function LanguageSelectionScreen() {
  const { setLanguage, setIsFirstLaunch, t } = useLanguage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const handleLanguageSelect = async (lang: 'en' | 'es') => {
    await setLanguage(lang);
    await setIsFirstLaunch(false);
    router.replace('/login');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <MaterialIcons name="language" size={64} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>{t('selectLanguage')}</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('selectLanguageSubtitle')}</Text>

        <View style={styles.languageOptions}>
          <TouchableOpacity
            style={[styles.languageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleLanguageSelect('en')}
          >
            <View style={[styles.languageIcon, { backgroundColor: colors.card }]}>
              <Text style={styles.flagEmoji}>🇺🇸</Text>
            </View>
            <Text style={[styles.languageText, { color: colors.text }]}>English</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.languageButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => handleLanguageSelect('es')}
          >
            <View style={[styles.languageIcon, { backgroundColor: colors.card }]}>
              <Text style={styles.flagEmoji}>🇦🇷</Text>
            </View>
            <Text style={[styles.languageText, { color: colors.text }]}>Español</Text>
            <MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  title: {
    ...typography.h1,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  languageOptions: {
    width: '100%',
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: 16,
    borderWidth: 1,
  },
  languageIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  flagEmoji: {
    fontSize: 24,
  },
  languageText: {
    ...typography.h3,
    flex: 1,
  },
});
