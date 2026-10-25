import { invariant } from '../shared/domain-error.js';

/**
 * ISO 4217 currencies businesses on the platform sell in, with their minor unit
 * exponent. Each business keeps its prices, payments and ledger in its own currency.
 */
export const currencies = {
  RUB: { minorUnitDigits: 2 },
  BYN: { minorUnitDigits: 2 },
  KZT: { minorUnitDigits: 2 },
  UZS: { minorUnitDigits: 2 },
  USD: { minorUnitDigits: 2 },
} as const satisfies Record<string, { minorUnitDigits: number }>;

export type CurrencyCode = keyof typeof currencies;

/** Amount in integer minor units (kopecks for RUB, cents for USD). */
export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export function money(amountMinor: number, currency: CurrencyCode): Money {
  invariant(
    Number.isSafeInteger(amountMinor) && amountMinor >= 0,
    'invalid_money',
    'Money amounts are non-negative whole minor units',
  );
  return { amountMinor, currency };
}

export function sumMoney(amounts: readonly Money[], currency: CurrencyCode): Money {
  let total = 0;
  for (const amount of amounts) {
    invariant(amount.currency === currency, 'invalid_money', 'Cannot add different currencies');
    total += amount.amountMinor;
  }
  return money(total, currency);
}

/** Builds money from major units, e.g. 2500 roubles or 85 dollars. */
export function moneyFromMajor(amountMajor: number, currency: CurrencyCode): Money {
  return money(Math.round(amountMajor * 10 ** currencies[currency].minorUnitDigits), currency);
}
