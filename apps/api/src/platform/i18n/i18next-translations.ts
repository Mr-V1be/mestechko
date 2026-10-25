import { fallbackLocale, localeIds, type Locale } from '@mestechko/domain';
import { createI18n, type LocaleResources } from '@mestechko/i18n';
import type { Translations, Translator } from '../../shared/application/translations.js';

type I18n = Awaited<ReturnType<typeof createI18n>>;

const serverResources: Readonly<Record<Locale, () => Promise<LocaleResources>>> = {
  en: async () => (await import('../../locales/en/index.js')).default,
  ru: async () => (await import('../../locales/ru/index.js')).default,
};

class I18nextTranslator implements Translator {
  constructor(
    private readonly instance: I18n,
    readonly locale: Locale,
    private readonly namespace: string,
  ) {}

  text(key: string, values?: Readonly<Record<string, string | number>>): string {
    // The values take part in the lookup: a count picks the plural form.
    const options = { ...values, lng: this.locale, ns: this.namespace };
    if (!this.instance.exists(key, options)) {
      throw new Error(`Missing text ${this.namespace}:${key} (${this.locale})`);
    }
    return this.instance.t(key, options);
  }

  lines(key: string): readonly string[] {
    const value: unknown = this.instance.t(key, {
      lng: this.locale,
      ns: this.namespace,
      returnObjects: true,
    });
    if (!Array.isArray(value) || !value.every((line) => typeof line === 'string')) {
      throw new Error(`Text ${this.namespace}:${key} (${this.locale}) is not a list`);
    }
    return value;
  }
}

/** Server texts of every language, loaded once at start: the server answers in each. */
export async function loadTranslations(): Promise<Translations> {
  const instance = await createI18n({
    locale: fallbackLocale,
    preload: localeIds,
    defaultNamespace: 'bot',
    load: (locale) => serverResources[locale](),
  });
  return { in: (locale, namespace) => new I18nextTranslator(instance, locale, namespace) };
}
