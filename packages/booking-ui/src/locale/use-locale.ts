import { fallbackLocale, isLocale, type Locale } from '@mestechko/domain';
import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { storeLocale } from './browser-locale';

export interface LocaleControl {
  readonly locale: Locale;
  /** Switches the app's language and remembers the choice on this device. */
  readonly changeLocale: (locale: Locale) => void;
}

export function useLocale(): LocaleControl {
  const { i18n } = useTranslation();
  const current = i18n.resolvedLanguage ?? i18n.language;
  const locale = isLocale(current) ? current : fallbackLocale;
  const changeLocale = useCallback(
    (next: Locale) => {
      storeLocale(next);
      void i18n.changeLanguage(next);
    },
    [i18n],
  );
  return { locale, changeLocale };
}

/**
 * Keeps the document in the app's language: `<html lang>` for assistive technology and
 * hyphenation, and the title of the tab. Renders nothing.
 */
export function DocumentLocale({ titleKey }: { readonly titleKey: string }): null {
  const { t, i18n } = useTranslation();
  const title = t(titleKey);
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.title = title;
  }, [i18n.language, title]);
  return null;
}
