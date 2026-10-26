import {
  depositFor,
  quoteBooking,
  type BookingPlan,
  type BookingRules,
  type BookingQuote,
  type CurrencyCode,
  type Money,
} from '@slotwise/domain';
import type {
  ServiceView,
  StaffServiceTerms,
} from '../../../catalog/application/catalog-reader.js';

export interface PricedPlan {
  readonly plan: BookingPlan;
  readonly quote: BookingQuote;
  readonly total: Money;
}

/** Plans only contain services the assembler loaded; anything else is a bug. */
export function serviceOf(services: readonly ServiceView[], serviceId: string): ServiceView {
  const service = services.find((candidate) => candidate.id === serviceId);
  if (!service) {
    throw new Error(`Planned service ${serviceId} was not loaded`);
  }
  return service;
}

/** What each plan costs the client: the staff member's own prices apply. */
export function pricePlans(
  plans: readonly BookingPlan[],
  catalog: {
    readonly services: readonly ServiceView[];
    readonly terms: readonly StaffServiceTerms[];
  },
  currency: CurrencyCode,
): PricedPlan[] {
  return plans.map((plan) => {
    const quote = quoteBooking(
      plan.items.map((item) => ({
        serviceId: item.serviceId,
        basePriceMinor: serviceOf(catalog.services, item.serviceId).priceMinor,
        staffPriceMinor:
          catalog.terms.find(
            (term) => term.staffId === plan.staffId && term.serviceId === item.serviceId,
          )?.priceMinor ?? null,
      })),
      currency,
    );
    return { plan, quote, total: quote.total };
  });
}

/** Prepayment of a priced plan: each service's share of its price, or the business rule. */
export function depositOf(
  option: PricedPlan,
  services: readonly ServiceView[],
  rules: BookingRules,
): Money {
  return depositFor(
    option.quote.items.map((item) => ({
      priceMinor: item.price.amountMinor,
      depositPercent: serviceOf(services, item.serviceId).depositPercent,
    })),
    rules.prepayment.depositPercent,
    option.total.currency,
  );
}
