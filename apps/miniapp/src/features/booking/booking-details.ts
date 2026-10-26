import type {
  BookingQuoteView,
  CatalogService,
  Money,
  StaffOption,
} from '@slotwise/contracts/client';
import { useQuote, useServices, useStaffOptions } from '../../platform/api/queries';
import { ANY_STAFF, type BookingSelection } from './selection';

/** What the booking will cost as far as it is known at the current step. */
export type DraftPrice =
  | { readonly kind: 'exact'; readonly total: Money }
  | { readonly kind: 'range'; readonly min: Money; readonly max: Money }
  | { readonly kind: 'from'; readonly min: Money };

export interface BookingDraft {
  readonly services: readonly CatalogService[];
  readonly durationMinutes: number;
  readonly price: DraftPrice | null;
  readonly staff: StaffOption | null;
  readonly anyStaff: boolean;
  /** Terms for the chosen start: who is assigned and the exact total. */
  readonly quote: BookingQuoteView | null;
  readonly quoteLoading: boolean;
}

function sum(prices: readonly Money[]): Money | null {
  const [first] = prices;
  return first
    ? {
        amountMinor: prices.reduce((total, price) => total + price.amountMinor, 0),
        currency: first.currency,
      }
    : null;
}

/** Everything known about the booking so far, from the catalog caches and the quote. */
export function useBookingDraft(selection: BookingSelection): BookingDraft {
  const services = useServices(selection.slug, selection.locationId);
  const staffOptions = useStaffOptions(selection.slug, selection.locationId, selection.serviceIds);
  const anyStaff = selection.staff === ANY_STAFF;
  const quote = useQuote(
    selection.slug,
    selection.start && selection.staff
      ? {
          locationId: selection.locationId,
          serviceIds: selection.serviceIds,
          staffId: anyStaff ? null : selection.staff,
          start: selection.start,
        }
      : null,
  );
  const catalog = services.data?.categories.flatMap((category) => category.services) ?? [];
  const chosen = catalog.filter((service) => selection.serviceIds.includes(service.id));
  const staff = staffOptions.data?.staff.find((option) => option.id === selection.staff) ?? null;
  const totals = staffOptions.data?.staff.map((option) => option.total) ?? [];
  const minimum = sum(chosen.map((service) => service.price));
  const lowest = totals.reduce<Money | null>(
    (min, total) => (min === null || total.amountMinor < min.amountMinor ? total : min),
    null,
  );
  const highest = totals.reduce<Money | null>(
    (max, total) => (max === null || total.amountMinor > max.amountMinor ? total : max),
    null,
  );

  const price = ((): DraftPrice | null => {
    if (quote.data?.assigned) {
      return { kind: 'exact', total: quote.data.assigned.total };
    }
    if (staff) {
      return { kind: 'exact', total: staff.total };
    }
    if (lowest && highest) {
      return lowest.amountMinor === highest.amountMinor
        ? { kind: 'exact', total: lowest }
        : { kind: 'range', min: lowest, max: highest };
    }
    if (minimum) {
      return chosen.some((service) => service.priceVaries)
        ? { kind: 'from', min: minimum }
        : { kind: 'exact', total: minimum };
    }
    return null;
  })();

  return {
    services: chosen,
    durationMinutes: chosen.reduce((total, service) => total + service.durationMinutes, 0),
    price,
    staff,
    anyStaff,
    quote: quote.data ?? null,
    quoteLoading: quote.isFetching,
  };
}
