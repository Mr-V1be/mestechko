import { isLocale, localeIds, type Locale } from '@mestechko/domain';
import i18next, { type BackendModule, type i18n } from 'i18next';
import { sharedNamespaces, sharedResourceLoaders } from './resources.js';

/** Texts of one language: namespaces by name. */
export type LocaleResources = Readonly<Record<string, object>>;

export interface CreateI18nOptions {
  /** The language to start in; `resolveLocale` decides which one a person reads. */
  readonly locale: Locale;
  readonly defaultNamespace: string;
  /** The application's own namespaces of a language, loaded when the language is needed. */
  readonly load?: (locale: Locale) => Promise<LocaleResources>;
  /** Languages loaded before start, e.g. all of them on a server answering in each. */
  readonly preload?: readonly Locale[];
}

/**
 * An i18next instance with the shared namespaces and the application's own. The start
 * language is loaded before it resolves; another one loads when the app switches to it,
 * and the switch completes once its texts are there.
 */
export async function createI18n(options: CreateI18nOptions): Promise<i18n> {
  const loading = new Map<Locale, Promise<LocaleResources>>();
  const resourcesOf = (locale: Locale): Promise<LocaleResources> => {
    const known = loading.get(locale);
    if (known) {
      return known;
    }
    const loaded = Promise.all([sharedResourceLoaders[locale](), options.load?.(locale)]).then(
      ([shared, own = {}]) => {
        assertOwnNamespaces(Object.keys(own));
        return { ...shared, ...own };
      },
    );
    loading.set(locale, loaded);
    return loaded;
  };
  const languages = [...new Set([options.locale, ...(options.preload ?? [])])];
  const bundled: Partial<Record<Locale, LocaleResources>> = Object.fromEntries(
    await Promise.all(
      languages.map(async (locale) => [locale, await resourcesOf(locale)] as const),
    ),
  );
  const backend: BackendModule = {
    type: 'backend',
    init: () => undefined,
    read: (language, namespace, callback) => {
      if (!isLocale(language)) {
        callback(new Error(`Unsupported language ${language}`), false);
        return;
      }
      resourcesOf(language).then(
        (resources) => {
          callback(null, resources[namespace] ?? {});
        },
        (error: unknown) => {
          callback(error instanceof Error ? error : new Error(String(error)), false);
        },
      );
    },
  };
  const instance = i18next.createInstance().use(backend);
  await instance.init({
    lng: options.locale,
    // Every language carries every text (the translation gate checks it), so a missing
    // key is a defect to see, not something to paper over with another language.
    fallbackLng: false,
    supportedLngs: [...localeIds],
    resources: bundled,
    partialBundledLanguages: true,
    ns: Object.keys(bundled[options.locale] ?? {}),
    defaultNS: options.defaultNamespace,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}

/**
 * An application namespace named like a shared one would replace it whole and silently
 * break every text of the shared one, so such a name is refused.
 */
function assertOwnNamespaces(names: readonly string[]): void {
  const shared = new Set<string>(sharedNamespaces);
  const taken = names.filter((name) => shared.has(name));
  if (taken.length > 0) {
    throw new Error(
      `Namespaces ${taken.join(', ')} are shared ones; give the application's texts another name`,
    );
  }
}
