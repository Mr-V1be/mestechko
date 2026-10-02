import type { CatalogService, Money, StaffOption } from '@mestechko/contracts/client';
import { useServices, useStaffOptions } from '../../platform/api/queries';
import { ANY_STAFF, type BookingSelection } from './selection';

export interface BookingDraft {
  readonly services: readonly CatalogService[];
  readonly durationMinutes: number;
  /** Exact total once a staff member is chosen, otherwise the lowest possible. */
  readonly total: Money | null;
  readonly totalIsMinimum: boolean;
  readonly staff: StaffOption | null;
  readonly anyStaff: boolean;
}

/** Everything known about the booking so far, from the catalog caches. */
export function useBookingDraft(selection: BookingSelection): BookingDraft {
  const services = useServices(selection.slug, selection.locationId);
  const staffOptions = useStaffOptions(selection.slug, selection.locationId, selection.serviceIds);
  const catalog = services.data?.categories.flatMap((category) => category.services) ?? [];
  const chosen = catalog.filter((service) => selection.serviceIds.includes(service.id));
  const staff = staffOptions.data?.staff.find((option) => option.id === selection.staff) ?? null;
  const currency = chosen[0]?.price.currency;
  const minimum = currency
    ? { amountMinor: chosen.reduce((sum, service) => sum + service.price.amountMinor, 0), currency }
    : null;
  return {
    services: chosen,
    durationMinutes: chosen.reduce((sum, service) => sum + service.durationMinutes, 0),
    total: staff?.total ?? minimum,
    totalIsMinimum: staff === null && chosen.some((service) => service.priceVaries),
    staff,
    anyStaff: selection.staff === ANY_STAFF,
  };
}
