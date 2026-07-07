import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

const THEME_KEY = '@app_theme';

export const lightColors = {
  primary: '#10b981',
  primaryDark: '#059669',
  secondary: '#3b82f6',
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceLight: '#f0f0f0',
  card: '#fafafa',
  text: '#111111',
  textSecondary: '#555555',
  textTertiary: '#999999',
  border: '#e0e0e0',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  bullish: '#10b981',
  neutral: '#f59e0b',
  bearish: '#ef4444',
};

export const darkColors = {
  primary: '#10b981',
  primaryDark: '#059669',
  secondary: '#3b82f6',
  background: '#0a0a0a',
  surface: '#1a1a1a',
  surfaceLight: '#2a2a2a',
  card: '#161616',
  text: '#ffffff',
  textSecondary: '#a0a0a0',
  textTertiary: '#666666',
  border: '#2a2a2a',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  bullish: '#10b981',
  neutral: '#f59e0b',
  bearish: '#ef4444',
};

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => Promise<void>;
  colors: typeof darkColors;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('dark');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
      }
      setLoaded(true);
    });
  }, []);

  const setTheme = async (mode: ThemeMode) => {
    await AsyncStorage.setItem(THEME_KEY, mode);
    setThemeState(mode);
  };

  // Don't block render on theme load — use default dark until loaded
  // (prevents blank screen crash on Android slow start)

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        colors: theme === 'light' ? lightColors : darkColors,
        isDark: theme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
