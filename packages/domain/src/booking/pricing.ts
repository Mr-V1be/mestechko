import { money, sumMoney, type CurrencyCode, type Money } from '../money/money.js';

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
