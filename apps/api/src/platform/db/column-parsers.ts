import { currencies, isLocale, type CurrencyCode, type Locale } from '@mestechko/domain';

/** Currency columns are free text in SQL; this narrows them to the platform's registry. */
export function currencyCode(value: string): CurrencyCode {
  if (!Object.hasOwn(currencies, value)) {
    throw new Error(`Unsupported currency "${value}" in storage`);
  }
  return value as CurrencyCode;
}

/** Language columns are free text in SQL; this narrows them to the languages the platform speaks. */
export function localeCode(value: string): Locale {
  if (!isLocale(value)) {
    throw new Error(`Unsupported language "${value}" in storage`);
  }
  return value;
}
