export const themePreferences = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof themePreferences)[number];
export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function systemTheme(): ResolvedTheme {
  // Pages rendered ahead of time start light; the boot script sets the real theme.
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

export function applyTheme(
  theme: ResolvedTheme,
  root: HTMLElement = document.documentElement,
): void {
  root.dataset.theme = theme;
}

export function watchSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  const query = window.matchMedia(DARK_QUERY);
  const listener = (): void => {
    onChange(systemTheme());
  };
  query.addEventListener('change', listener);
  return () => {
    query.removeEventListener('change', listener);
  };
}

/** Browser storage may be unavailable (private mode, blocked cookies); themes still work. */
export function readStoredPreference(key: string): ThemePreference | null {
  try {
    const value = window.localStorage.getItem(key);
    return themePreferences.find((preference) => preference === value) ?? null;
  } catch {
    return null;
  }
}

export function storePreference(key: string, preference: ThemePreference): void {
  try {
    window.localStorage.setItem(key, preference);
  } catch {
    // Not persisting is acceptable: the choice still applies for this visit.
  }
}
