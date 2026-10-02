import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';
import { applyPalette, type ExternalPalette } from './palette';
import {
  applyTheme,
  readStoredPreference,
  resolveTheme,
  storePreference,
  watchSystemTheme,
  type ResolvedTheme,
  type ThemePreference,
} from './theme';

interface ThemeContextValue {
  readonly preference: ThemePreference;
  readonly theme: ResolvedTheme;
  readonly setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly storageKey: string;
  /** A host (such as Telegram) that dictates the theme; the user preference is then ignored. */
  readonly host?: { readonly theme: ResolvedTheme; readonly palette: ExternalPalette } | null;
  readonly children: ReactNode;
}

export function ThemeProvider({ storageKey, host = null, children }: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => readStoredPreference(storageKey) ?? 'system',
  );
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(() => resolveTheme('system'));
  const theme: ResolvedTheme =
    host?.theme ?? (preference === 'system' ? systemResolved : preference);

  useEffect(() => watchSystemTheme(setSystemResolved), []);

  useEffect(() => {
    applyTheme(theme);
    applyPalette(host?.palette ?? {});
  }, [theme, host]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      theme,
      setPreference: (next) => {
        storePreference(storageKey, next);
        setPreferenceState(next);
      },
    }),
    [preference, theme, storageKey],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error('useTheme() must be used inside <ThemeProvider>');
  }
  return context;
}
