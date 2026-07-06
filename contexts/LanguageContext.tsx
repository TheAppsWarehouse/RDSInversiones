import React, { createContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '@/constants/translations';
import {
  APP_VERSION,
  ensureActiveVersionExists,
  getUserAcceptanceForActiveVersion,
} from '@/services/termsService';

type Language = 'en' | 'es';
export type MarketFilter = 'ALL' | 'EEUU' | 'ARG';

// ─── T&C Versioning ───────────────────────────────────────────────────────────
// CURRENT_TERMS_VERSION is now sourced from termsService (= APP_VERSION)
export const CURRENT_TERMS_VERSION = APP_VERSION;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: string) => string;
  isFirstLaunch: boolean;
  setIsFirstLaunch: (value: boolean) => Promise<void>;
  termsAccepted: boolean;
  /** Mark terms as accepted locally (call after recordTermsAcceptance succeeds) */
  setTermsAccepted: (value: boolean) => Promise<void>;
  acceptedTermsVersion: string | null;
  termsUpToDate: boolean;
  /** Re-check DB acceptance status (call after login to sync from server) */
  refreshTermsStatus: (userId: string) => Promise<void>;
  keepSignedIn: boolean;
  setKeepSignedIn: (value: boolean) => Promise<void>;
  marketFilter: MarketFilter;
  setMarketFilter: (value: MarketFilter) => Promise<void>;
  notificationsEnabled: boolean;
  setNotificationsEnabled: (value: boolean) => Promise<void>;
  /** True while AsyncStorage preferences are being loaded on first mount */
  prefsLoading: boolean;
}

export const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const LANGUAGE_KEY = '@app_language';
const FIRST_LAUNCH_KEY = '@first_launch';
const TERMS_ACCEPTED_KEY = '@terms_accepted';
const TERMS_VERSION_KEY = '@terms_accepted_version';
const KEEP_SIGNED_IN_KEY = '@keep_signed_in';
const MARKET_FILTER_KEY = '@market_filter';
const NOTIFICATIONS_ENABLED_KEY = '@notifications_enabled';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isFirstLaunch, setIsFirstLaunchState] = useState(true);
  const [termsAccepted, setTermsAcceptedState] = useState(false);
  const [acceptedTermsVersion, setAcceptedTermsVersionState] = useState<string | null>(null);
  const [keepSignedIn, setKeepSignedInState] = useState(false);
  const [marketFilter, setMarketFilterState] = useState<MarketFilter>('ALL');
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [loading, setLoading] = useState(true);

  const termsUpToDate = termsAccepted && acceptedTermsVersion === CURRENT_TERMS_VERSION;

  useEffect(() => {
    loadPreferences();
    // Ensure the current app version is registered in the DB
    ensureActiveVersionExists().catch(() => {});
  }, []);

  const loadPreferences = async () => {
    try {
      const [
        savedLanguage,
        firstLaunch,
        savedTerms,
        savedTermsVersion,
        savedKeepSignedIn,
        savedMarketFilter,
        savedNotifications,
      ] = await Promise.all([
        AsyncStorage.getItem(LANGUAGE_KEY),
        AsyncStorage.getItem(FIRST_LAUNCH_KEY),
        AsyncStorage.getItem(TERMS_ACCEPTED_KEY),
        AsyncStorage.getItem(TERMS_VERSION_KEY),
        AsyncStorage.getItem(KEEP_SIGNED_IN_KEY),
        AsyncStorage.getItem(MARKET_FILTER_KEY),
        AsyncStorage.getItem(NOTIFICATIONS_ENABLED_KEY),
      ]);

      if (savedLanguage) setLanguageState(savedLanguage as Language);
      setIsFirstLaunchState(firstLaunch === null);
      setTermsAcceptedState(savedTerms === 'true');
      setAcceptedTermsVersionState(savedTermsVersion);
      setKeepSignedInState(savedKeepSignedIn === 'true');
      if (savedMarketFilter) setMarketFilterState(savedMarketFilter as MarketFilter);
      setNotificationsEnabledState(savedNotifications === null ? true : savedNotifications === 'true');
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const setLanguage = async (lang: Language) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    setLanguageState(lang);
  };

  const setIsFirstLaunch = async (value: boolean) => {
    await AsyncStorage.setItem(FIRST_LAUNCH_KEY, value ? 'true' : 'false');
    setIsFirstLaunchState(value);
  };

  const setTermsAccepted = async (value: boolean) => {
    await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, value ? 'true' : 'false');
    setTermsAcceptedState(value);
    if (value) {
      await AsyncStorage.setItem(TERMS_VERSION_KEY, CURRENT_TERMS_VERSION);
      setAcceptedTermsVersionState(CURRENT_TERMS_VERSION);
    } else {
      await AsyncStorage.removeItem(TERMS_VERSION_KEY);
      setAcceptedTermsVersionState(null);
    }
  };

  /**
   * Called after login to reconcile local AsyncStorage cache with the DB.
   * If the DB has an accepted record for the active version, update local state.
   * This ensures users who accepted on another device don't see the T&C screen again.
   */
  const refreshTermsStatus = async (userId: string) => {
    try {
      const acceptance = await getUserAcceptanceForActiveVersion(userId);
      if (acceptance) {
        // User has accepted the current version in the DB — sync local cache
        await AsyncStorage.setItem(TERMS_ACCEPTED_KEY, 'true');
        await AsyncStorage.setItem(TERMS_VERSION_KEY, CURRENT_TERMS_VERSION);
        setTermsAcceptedState(true);
        setAcceptedTermsVersionState(CURRENT_TERMS_VERSION);
      }
    } catch (err) {
      console.error('LanguageContext.refreshTermsStatus error:', err);
    }
  };

  const setKeepSignedIn = async (value: boolean) => {
    await AsyncStorage.setItem(KEEP_SIGNED_IN_KEY, value ? 'true' : 'false');
    setKeepSignedInState(value);
  };

  const setMarketFilter = async (value: MarketFilter) => {
    await AsyncStorage.setItem(MARKET_FILTER_KEY, value);
    setMarketFilterState(value);
  };

  const setNotificationsEnabled = async (value: boolean) => {
    await AsyncStorage.setItem(NOTIFICATIONS_ENABLED_KEY, value ? 'true' : 'false');
    setNotificationsEnabledState(value);
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  // Don't block render while loading preferences — use defaults.
  // Returning null here causes a blank screen crash on Android.
  // The root navigator (app/index.tsx) already handles loading state via useAuth().

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isFirstLaunch,
        setIsFirstLaunch,
        termsAccepted,
        setTermsAccepted,
        acceptedTermsVersion,
        termsUpToDate,
        refreshTermsStatus,
        keepSignedIn,
        setKeepSignedIn,
        marketFilter,
        setMarketFilter,
        notificationsEnabled,
        setNotificationsEnabled,
        prefsLoading: loading,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}
