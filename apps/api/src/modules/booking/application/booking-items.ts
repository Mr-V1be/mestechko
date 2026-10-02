import type { IdGenerator } from '../../../shared/application/ports.js';
import type { ServiceView } from '../../catalog/application/catalog-reader.js';
import { serviceOf, type PricedPlan } from './availability/plan-pricing.js';
import type { NewBookingItem } from './ports.js';

const MS_PER_MINUTE = 60_000;

/** Rows of a planned booking: each service with its time, resource and price. */
export function bookingItemsOf(
  option: PricedPlan,
  services: readonly ServiceView[],
  ids: IdGenerator,
): NewBookingItem[] {
  const { plan, quote } = option;
  return plan.items.map((item, position) => ({
    id: ids.next(),
    position,
    serviceId: item.serviceId,
    serviceName: serviceOf(services, item.serviceId).name,
    durationMinutes: (item.end - item.start) / MS_PER_MINUTE,
    priceMinor:
      quote.items[position]?.price.amountMinor ?? serviceOf(services, item.serviceId).priceMinor,
    resourceId: item.resourceId,
    startsAt: new Date(item.start),
    endsAt: new Date(item.end),
    occupied: { start: new Date(item.occupied.start), end: new Date(item.occupied.end) },
  }));
}
