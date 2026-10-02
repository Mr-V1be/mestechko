import type {
  BookingSource,
  BookingStatus,
  CurrencyCode,
  InstantInterval,
} from '@mestechko/domain';
import type { Page } from '../ports.js';

/** One booked service as the cabinet schedule draws it. */
export interface ScheduleItemView {
  readonly bookingId: string;
  readonly status: BookingStatus;
  readonly staffId: string;
  readonly staffName: string;
  readonly resourceId: string | null;
  readonly serviceName: string;
  readonly clientName: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly occupied: InstantInterval;
}

export interface CabinetBookingFilter {
  readonly from: Date;
  readonly to: Date;
  readonly status: BookingStatus | null;
  readonly staffId: string | null;
  readonly locationId: string | null;
  readonly search: string | null;
}

export interface CabinetBookingView {
  readonly id: string;
  readonly status: BookingStatus;
  readonly source: BookingSource;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timeZone: string;
  readonly client: {
    readonly id: string;
    readonly displayName: string;
    readonly phone: string | null;
  };
  readonly staff: {
    readonly id: string;
    readonly displayName: string;
    readonly title: string | null;
    readonly avatarSeed: string;
  };
  readonly location: { readonly id: string; readonly name: string };
  readonly services: readonly { readonly id: string; readonly name: string }[];
  readonly totalPriceMinor: number;
  readonly currency: CurrencyCode;
}

export interface CabinetBookingDetailsView extends CabinetBookingView {
  readonly comment: string | null;
  readonly createdAt: Date;
  readonly items: readonly {
    readonly serviceId: string;
    readonly serviceName: string;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly priceMinor: number;
    readonly resourceName: string | null;
  }[];
}

export interface CabinetBookingQueries {
  /** Booked services occupying time at the location within the window. */
  scheduleItems(
    locationId: string,
    window: InstantInterval,
    staffId: string | null,
  ): Promise<ScheduleItemView[]>;
  list(
    filter: CabinetBookingFilter,
    page: { readonly cursor: string | null; readonly limit: number },
  ): Promise<Page<CabinetBookingView>>;
  details(bookingId: string, staffId: string | null): Promise<CabinetBookingDetailsView | null>;
}

export const CABINET_BOOKING_QUERIES = Symbol('CABINET_BOOKING_QUERIES');
