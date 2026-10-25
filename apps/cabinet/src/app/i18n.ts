import { createAppI18n, localeLoader } from '@mestechko/booking-ui';
import type { Locale } from '@mestechko/domain';
import type { i18n } from 'i18next';

/** Every file in `locales/<locale>` is a namespace named after it: `en/team.json` → `team:`. */
const files = import.meta.glob('../locales/*/*.json', { import: 'default' });

export function setUpI18n(locale: Locale): Promise<i18n> {
  return createAppI18n({ locale, defaultNamespace: 'cabinet', load: localeLoader(files) });
}
