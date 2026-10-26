import { currencies, type CurrencyCode } from '@slotwise/domain';

/** Prices are typed in roubles and stored in kopecks: whole minor units, never floats. */
export function toMinor(major: number, currency: CurrencyCode): number {
  return Math.round(major * 10 ** currencies[currency].minorUnitDigits);
}

export function toMajor(minor: number, currency: CurrencyCode): number {
  return minor / 10 ** currencies[currency].minorUnitDigits;
}

export function minorDigits(currency: CurrencyCode): number {
  return currencies[currency].minorUnitDigits;
}
