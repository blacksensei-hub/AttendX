import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useColorScheme }                                          from 'react-native';
import AsyncStorage                                                from '@react-native-async-storage/async-storage';

import { buildTheme }                                              from './tokens';

/**
 * ═════════════════════════════════════════════════════════════════
 * ThemeProvider — light/dark theming for the mobile app.
 *
 * Three modes:
 *   • 'system' — follow the OS appearance setting (default)
 *   • 'light'  — force light regardless of OS
 *   • 'dark'   — force dark regardless of OS
 *
 * Persists the user's preference via AsyncStorage so it survives
 * app restarts.
 *
 * Usage:
 *   const t = useTheme();
 *   <View style={{ backgroundColor: t.colors.bg }} />
 *
 *   const { mode, setMode } = useThemeMode();
 *   <Pressable onPress={() => setMode('dark')} />
 * ═════════════════════════════════════════════════════════════════
 */

const STORAGE_KEY = '@attendx:theme-mode';

const ThemeContext = createContext({
  theme:        buildTheme('light'),
  mode:         'system',
  resolvedMode: 'light',
  setMode:      () => {},
});

export function ThemeProvider({ children }) {
  // What the user has explicitly chosen
  const [mode, setModeState] = useState('system');

  // What the OS reports — re-renders when user changes phone setting
  const systemScheme = useColorScheme();

  // Load persisted preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then(saved => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
      })
      .catch(() => {
        // Fail silently — fall back to system default
      });
  }, []);

  const setMode = (next) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  // Resolve: 'system' → look at OS; otherwise use the chosen mode
  const resolvedMode = mode === 'system'
    ? (systemScheme === 'dark' ? 'dark' : 'light')
    : mode;

  // Memoise so consumers don't re-render unless mode actually changes
  const theme = useMemo(() => buildTheme(resolvedMode), [resolvedMode]);

  const value = useMemo(() => ({
    theme,
    mode,
    resolvedMode,
    setMode,
  }), [theme, mode, resolvedMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// Most components only care about the resolved theme
export function useTheme() {
  return useContext(ThemeContext).theme;
}

// Components that LET users change the theme (settings, theme toggle)
// need the mode setter
export function useThemeMode() {
  const { mode, resolvedMode, setMode } = useContext(ThemeContext);
  return { mode, resolvedMode, setMode };
}