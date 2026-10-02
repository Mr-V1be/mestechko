import i18next, { type i18n } from 'i18next';
import {
  defaultLocale,
  sharedNamespaces,
  sharedResources,
  supportedLocales,
  type Locale,
} from './resources.js';

export interface CreateI18nOptions {
  readonly locale?: Locale;
  /** Application namespaces per locale, merged with the shared ones. */
  readonly resources?: Readonly<Record<Locale, Readonly<Record<string, object>>>>;
  readonly defaultNamespace: string;
}

export async function createI18n(options: CreateI18nOptions): Promise<i18n> {
  const instance = i18next.createInstance();
  const resources = Object.fromEntries(
    supportedLocales.map((locale) => [
      locale,
      { ...sharedResources[locale], ...options.resources?.[locale] },
    ]),
  );
  await instance.init({
    lng: options.locale ?? defaultLocale,
    fallbackLng: defaultLocale,
    supportedLngs: [...supportedLocales],
    resources,
    ns: [...sharedNamespaces, ...Object.keys(options.resources?.[defaultLocale] ?? {})],
    defaultNS: options.defaultNamespace,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}
