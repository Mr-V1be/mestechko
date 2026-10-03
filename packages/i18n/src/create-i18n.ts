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
  assertOwnNamespaces(options.resources);
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

/**
 * An application namespace named like a shared one would replace it whole and silently
 * break every text of the shared one, so such a name is refused at start.
 */
function assertOwnNamespaces(resources: CreateI18nOptions['resources']): void {
  const shared = new Set<string>(sharedNamespaces);
  const taken = Object.values(resources ?? {})
    .flatMap((namespaces) => Object.keys(namespaces))
    .filter((namespace) => shared.has(namespace));
  if (taken.length > 0) {
    throw new Error(
      `Namespaces ${[...new Set(taken)].join(', ')} are shared ones; give the application's texts another name`,
    );
  }
}
