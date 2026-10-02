import booking from './locales/ru/booking.json' with { type: 'json' };
import catalog from './locales/ru/catalog.json' with { type: 'json' };
import common from './locales/ru/common.json' with { type: 'json' };
import terms from './locales/ru/terms.json' with { type: 'json' };

export const supportedLocales = ['ru'] as const;
export type Locale = (typeof supportedLocales)[number];
export const defaultLocale: Locale = 'ru';

/** Namespaces shared by every application. */
export const sharedResources = {
  ru: { common, terms, booking, catalog },
} as const satisfies Record<Locale, Record<string, object>>;

export type SharedNamespace = keyof (typeof sharedResources)[Locale];
export const sharedNamespaces = Object.keys(sharedResources[defaultLocale]) as SharedNamespace[];
