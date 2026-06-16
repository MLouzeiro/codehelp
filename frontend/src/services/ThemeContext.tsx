import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

export type Theme = 'light' | 'dark';
export type FontScale = 'sm' | 'md' | 'lg';
export type ColorScheme = 'blue' | 'green' | 'purple' | 'orange' | 'gray';
export type SidebarLayout = 'vertical' | 'horizontal' | 'collapsed';
export type BgMode = 'white' | 'ice' | 'gray' | 'blue';

interface ThemeSettings {
  theme: Theme;
  fontScale: FontScale;
  colorScheme: ColorScheme;
  sidebarLayout: SidebarLayout;
  bgMode: BgMode;
}

interface ThemeContextValue extends ThemeSettings {
  toggleTheme: () => void;
  setFontScale: (s: FontScale) => void;
  setColorScheme: (c: ColorScheme) => void;
  setSidebarLayout: (l: SidebarLayout) => void;
  setBgMode: (b: BgMode) => void;
  toggleSidebar: () => void;
}

const STORAGE_KEY = 'codemed-theme-settings';

const FONT_SCALE_MAP: Record<FontScale, number> = {
  sm: 0.875,
  md: 1,
  lg: 1.125,
};

const COLOR_SCHEMES: Record<ColorScheme, { primary: string; light: string; dark: string }> = {
  blue:   { primary: '#3B82F6', light: '#60A5FA', dark: '#2563EB' },
  green:  { primary: '#10B981', light: '#34D399', dark: '#059669' },
  purple: { primary: '#8B5CF6', light: '#A78BFA', dark: '#7C3AED' },
  orange: { primary: '#F97316', light: '#FB923C', dark: '#EA580C' },
  gray:   { primary: '#6B7280', light: '#9CA3AF', dark: '#4B5563' },
};

export const BG_MODES: Record<BgMode, { label: string; bgApp: string; bgCard: string; bgCardHover: string; bgInput: string }> = {
  white: { label: 'Branco', bgApp: '#FFFFFF', bgCard: '#FFFFFF', bgCardHover: '#F8FAFC', bgInput: '#FFFFFF' },
  ice:   { label: 'Gelo', bgApp: '#F0F9FF', bgCard: '#FFFFFF', bgCardHover: '#F0F9FF', bgInput: '#FFFFFF' },
  gray:  { label: 'Cinza', bgApp: '#F1F5F9', bgCard: '#FFFFFF', bgCardHover: '#F8FAFC', bgInput: '#FFFFFF' },
  blue:  { label: 'Azul Claro', bgApp: '#EFF6FF', bgCard: '#FFFFFF', bgCardHover: '#F0F4FF', bgInput: '#FFFFFF' },
};

function getInitial(): ThemeSettings {
  if (typeof window === 'undefined') {
    return { theme: 'light', fontScale: 'md', colorScheme: 'blue', sidebarLayout: 'vertical', bgMode: 'white' };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        theme: parsed.theme || 'light',
        fontScale: parsed.fontScale || 'md',
        colorScheme: parsed.colorScheme || 'blue',
        sidebarLayout: parsed.sidebarLayout || 'vertical',
        bgMode: parsed.bgMode || 'white',
      };
    }
  } catch { /* ignore */ }

  const theme: Theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  return { theme, fontScale: 'md', colorScheme: 'blue', sidebarLayout: 'vertical', bgMode: 'white' };
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(getInitial);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const applySettings = useCallback((s: ThemeSettings) => {
    const root = document.documentElement;

    if (s.theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');

    root.style.setProperty('--font-scale', String(FONT_SCALE_MAP[s.fontScale]));

    const scheme = COLOR_SCHEMES[s.colorScheme];
    root.style.setProperty('--accent', scheme.primary);
    root.style.setProperty('--accent-light', scheme.light);
    root.style.setProperty('--accent-dark', scheme.dark);

    const bg = BG_MODES[s.bgMode];
    root.style.setProperty('--bg-app', bg.bgApp);
    root.style.setProperty('--bg-card', bg.bgCard);
    root.style.setProperty('--bg-card-hover', bg.bgCardHover);
    root.style.setProperty('--bg-input', bg.bgInput);

    root.classList.remove('sidebar-vertical', 'sidebar-horizontal', 'sidebar-collapsed');
    root.classList.add(`sidebar-${s.sidebarLayout}`);

    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, []);

  useEffect(() => { applySettings(settings); }, [settings, applySettings]);

  const toggleTheme = useCallback(() => {
    setSettings((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }));
  }, []);

  const setFontScale = useCallback((fontScale: FontScale) => {
    setSettings((prev) => ({ ...prev, fontScale }));
  }, []);

  const setColorScheme = useCallback((colorScheme: ColorScheme) => {
    setSettings((prev) => ({ ...prev, colorScheme }));
  }, []);

  const setSidebarLayout = useCallback((sidebarLayout: SidebarLayout) => {
    setSettings((prev) => ({ ...prev, sidebarLayout }));
  }, []);

  const setBgMode = useCallback((bgMode: BgMode) => {
    setSettings((prev) => ({ ...prev, bgMode }));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  return (
    <ThemeContext.Provider value={{
      ...settings,
      toggleTheme,
      setFontScale,
      setColorScheme,
      setSidebarLayout,
      setBgMode,
      toggleSidebar,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeSettings(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useThemeSettings must be used within ThemeProvider');
  return ctx;
}

export { COLOR_SCHEMES, FONT_SCALE_MAP };
