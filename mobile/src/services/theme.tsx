import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import { settingsStorage } from '../services/secureStore';

type ThemeMode = 'light' | 'dark' | 'system';
type BgMode = 'white' | 'ice' | 'gray' | 'lightblue';

interface ThemeContextType {
  themeMode: ThemeMode;
  bgMode: BgMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setBgMode: (mode: BgMode) => void;
  colors: {
    bg: string;
    bgCard: string;
    bgInput: string;
    text: string;
    textSecondary: string;
    border: string;
    primary: string;
    primaryText: string;
  };
}

const BG_COLORS = {
  white: { light: '#ffffff', dark: '#0f172a' },
  ice: { light: '#f0f9ff', dark: '#0c1929' },
  gray: { light: '#f8fafc', dark: '#1e293b' },
  lightblue: { light: '#e0f2fe', dark: '#0c1d36' },
};

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  bgMode: 'white',
  isDark: false,
  setThemeMode: () => { },
  setBgMode: () => { },
  colors: {
    bg: '#ffffff', bgCard: '#f8fafc', bgInput: '#f1f5f9',
    text: '#0f172a', textSecondary: '#64748b', border: '#e2e8f0',
    primary: '#22c55e', primaryText: '#ffffff',
  },
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [bgMode, setBgModeState] = useState<BgMode>('white');

  useEffect(() => {
    settingsStorage.getTheme().then(setThemeModeState);
    settingsStorage.getBgMode().then((m) => setBgModeState(m as BgMode));
  }, []);

  const isDark = themeMode === 'system'
    ? systemScheme === 'dark'
    : themeMode === 'dark';

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await settingsStorage.setTheme(mode);
  };

  const setBgMode = async (mode: BgMode) => {
    setBgModeState(mode);
    await settingsStorage.setBgMode(mode);
  };

  const bgColor = BG_COLORS[bgMode][isDark ? 'dark' : 'light'];

  const colors = isDark ? {
    bg: bgColor,
    bgCard: '#1e293b',
    bgInput: '#334155',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    border: '#334155',
    primary: '#22c55e',
    primaryText: '#ffffff',
  } : {
    bg: bgColor,
    bgCard: '#ffffff',
    bgInput: '#f1f5f9',
    text: '#0f172a',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    primary: '#22c55e',
    primaryText: '#ffffff',
  };

  return (
    <ThemeContext.Provider value={{ themeMode, bgMode, isDark, setThemeMode, setBgMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
