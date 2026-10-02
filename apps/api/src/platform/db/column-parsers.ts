import { currencies, type CurrencyCode } from '@mestechko/domain';

/** Currency columns are free text in SQL; this narrows them to the platform's registry. */
export function currencyCode(value: string): CurrencyCode {
  if (!Object.hasOwn(currencies, value)) {
    throw new Error(`Unsupported currency "${value}" in storage`);
  }
  return value as CurrencyCode;
}
