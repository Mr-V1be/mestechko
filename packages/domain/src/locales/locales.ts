import type { MessengerChannel } from '../channels/messenger-channels.js';
import type { CurrencyCode } from '../money/money.js';

interface LocaleDefinition {
  /**
   * Messengers the product offers to people who read this language. MAX serves the
   * Russian-speaking market only, so it is neither shown nor promoted in other languages.
   */
  readonly messengers: readonly MessengerChannel[];
  /** Currency of the product's own prices and samples for this audience. */
  readonly marketCurrency: CurrencyCode;
}

/** Languages the platform speaks. A new language is an entry here plus its translations. */
export const locales = {
  en: { messengers: ['telegram'], marketCurrency: 'USD' },
  ru: { messengers: ['telegram', 'max'], marketCurrency: 'RUB' },
} as const satisfies Record<string, LocaleDefinition>;

export type Locale = keyof typeof locales;

export const localeIds = Object.keys(locales) as Locale[];

/** Spoken when nothing a person prefers is supported or known. */
export const fallbackLocale: Locale = 'en';

/** A currency the product's own prices are set in, e.g. its subscription plans. */
export type MarketCurrency = (typeof locales)[Locale]['marketCurrency'];

const SUBTAG_SEPARATOR = /[-_]/;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.hasOwn(locales, value);
}

/** The supported locale a BCP 47 language tag asks for: `en-US` → `en`, `de-AT` → `null`. */
export function localeOfTag(tag: string): Locale | null {
  const language = tag.trim().toLowerCase().split(SUBTAG_SEPARATOR)[0];
  return isLocale(language) ? language : null;
}

/**
 * The language to speak to someone. Candidates come in order of precedence: the
 * person's stored choice first, then what their messenger or browser reports (a
 * browser lists its languages by preference). The first supported one wins; when
 * none is, the person reads the fallback.
 */
export function resolveLocale(candidates: Iterable<string | null | undefined>): Locale {
  for (const candidate of candidates) {
    const locale = candidate ? localeOfTag(candidate) : null;
    if (locale) {
      return locale;
    }
  }
  return fallbackLocale;
}

/** Whether people reading this language are offered the messenger at all. */
export function offersMessenger(locale: Locale, channel: MessengerChannel): boolean {
  return (locales[locale].messengers as readonly MessengerChannel[]).includes(channel);
}
