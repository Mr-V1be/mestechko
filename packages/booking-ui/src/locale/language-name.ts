import type { Locale } from '@mestechko/domain';

/**
 * A language in its own name, the way people look for it in a list: «English»,
 * «Русский». The name comes from the platform's language data, not from translations.
 */
export function languageName(locale: Locale): string {
  const name = new Intl.DisplayNames([locale], { type: 'language' }).of(locale) ?? locale;
  return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
}

/** The short form shown on a compact switch: `EN`, `RU`. */
export function languageCode(locale: Locale): string {
  return locale.toLocaleUpperCase(locale);
}
