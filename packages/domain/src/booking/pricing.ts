import { money, sumMoney, type CurrencyCode, type Money } from '../money/money.js';
import { invariant } from '../shared/domain-error.js';

export interface ServicePriceTerms {
  readonly serviceId: string;
  readonly basePriceMinor: number;
  /** Personal price of the chosen staff member, if they charge differently. */
  readonly staffPriceMinor: number | null;
}

export interface BookingQuote {
  readonly items: readonly { readonly serviceId: string; readonly price: Money }[];
  readonly total: Money;
}

/** What the client pays: the staff member's own price wins over the service price. */
export function quoteBooking(
  terms: readonly ServicePriceTerms[],
  currency: CurrencyCode,
): BookingQuote {
  const items = terms.map((term) => ({
    serviceId: term.serviceId,
    price: money(term.staffPriceMinor ?? term.basePriceMinor, currency),
  }));
  return {
    items,
    total: sumMoney(
      items.map((item) => item.price),
      currency,
    ),
  };
}

export interface PriceRange {
  readonly min: Money;
  readonly max: Money;
}

/** Lowest and highest of the prices, or `null` when there are none. */
export function priceRange(prices: readonly Money[]): PriceRange | null {
  const [first] = prices;
  if (!first) {
    return null;
  }
  return prices.reduce<PriceRange>(
    (range, price) => {
      invariant(
        price.currency === range.min.currency,
        'invalid_money',
        'Prices in different currencies',
      );
      return {
        min: price.amountMinor < range.min.amountMinor ? price : range.min,
        max: price.amountMinor > range.max.amountMinor ? price : range.max,
      };
    },
    { min: first, max: first },
  );
}

/**
 * Options the client already agreed to pay for, in their original order. A booking is
 * never made at a price above the one the client confirmed; a higher price needs a
 * new, explicit confirmation.
 */
export function withinAgreedPrice<T extends { readonly total: Money }>(
  options: readonly T[],
  agreed: Money,
): T[] {
  return options.filter((option) => {
    invariant(
      option.total.currency === agreed.currency,
      'invalid_money',
      'Prices in different currencies',
    );
    return option.total.amountMinor <= agreed.amountMinor;
  });
}
