import type { Locale } from '@slotwise/domain';

/** Namespaces shared by every application. */
export const sharedNamespaces = ['common', 'terms', 'booking', 'catalog'] as const;
export type SharedNamespace = (typeof sharedNamespaces)[number];

export type SharedResources = Readonly<Record<SharedNamespace, object>>;

/**
 * The shared texts of each language, one module per language: a bundle carries only the
 * languages a visitor actually reads, and a new language does not grow the others.
 */
export const sharedResourceLoaders: Readonly<Record<Locale, () => Promise<SharedResources>>> = {
  en: async () => (await import('./locales/en/index.js')).default,
  ru: async () => (await import('./locales/ru/index.js')).default,
};
