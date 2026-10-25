import { isLocale, resolveLocale, type Locale } from '@mestechko/domain';
import { LOCALE_STORAGE_KEY } from '@mestechko/ui/locale-boot';

export { LOCALE_STORAGE_KEY };

/** Browser storage may be unavailable (private mode, blocked cookies); languages still work. */
export function storedLocale(): Locale | null {
  try {
    const value = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeLocale(locale: Locale): void {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Not persisting is acceptable: the choice still applies for this visit.
  }
}

/** The browser's languages in order of preference; none where there is no browser. */
export function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') {
    return [];
  }
  return navigator.languages.length > 0 ? navigator.languages : [navigator.language];
}

/** A web app's language: the stored choice, then the browser's languages, then the fallback. */
export function resolveBrowserLocale(): Locale {
  return resolveLocale([storedLocale(), ...browserLanguages()]);
}
