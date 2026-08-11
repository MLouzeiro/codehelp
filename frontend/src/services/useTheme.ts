import { useThemeSettings } from './ThemeContext';

export type Theme = 'light' | 'dark';

export function useTheme() {
  const { theme, toggleTheme, setTheme } = useThemeSettings() as {
    theme: Theme;
    toggleTheme: () => void;
    setTheme?: (t: Theme) => void;
  };
  return {
    theme,
    toggle: toggleTheme,
    setTheme: (t: Theme) => {
      if (setTheme) setTheme(t);
    },
  };
}
