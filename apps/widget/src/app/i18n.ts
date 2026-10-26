import { createAppI18n, localeLoader } from '@slotwise/booking-ui';
import type { Locale } from '@slotwise/domain';
import type { i18n } from 'i18next';

/** One namespace per language: `locales/<locale>.json`. */
const files = import.meta.glob('../locales/*.json', { import: 'default' });

export function setUpI18n(locale: Locale): Promise<i18n> {
  return createAppI18n({ locale, defaultNamespace: 'widget', load: localeLoader(files, 'widget') });
}
