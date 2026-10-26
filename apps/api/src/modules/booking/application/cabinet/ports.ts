import type {
  BookingActor,
  BookingEventKind,
  BookingSource,
  BookingStatus,
  CurrencyCode,
  InstantInterval,
  MessengerChannel,
} from '@slotwise/domain';
import type { BookingHold, Page } from '../ports.js';

/** One booked service as the cabinet schedule draws it. */
export interface ScheduleItemView {
  readonly bookingId: string;
  readonly version: number;
  readonly status: BookingStatus;
  readonly hold: BookingHold | null;
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
  readonly version: number;
  readonly status: BookingStatus;
  readonly hold: BookingHold | null;
  readonly depositMinor: number;
  readonly source: BookingSource;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly timeZone: string;
  readonly client: {
    readonly id: string;
    readonly displayName: string;
    readonly phone: string | null;
    readonly customerId: string | null;
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

export interface BookingHistoryView {
  readonly kind: BookingEventKind;
  readonly actor: BookingActor;
  readonly channel: MessengerChannel | null;
  readonly actorName: string | null;
  readonly occurredAt: Date;
  readonly previousStartsAt: Date | null;
  readonly previousStaffName: string | null;
}

export interface CabinetBookingDetailsView extends CabinetBookingView {
  readonly comment: string | null;
  readonly createdAt: Date;
  readonly attendanceConfirmedAt: Date | null;
  readonly history: readonly BookingHistoryView[];
  readonly items: readonly {
    readonly staffId: string;
    readonly serviceId: string;
    readonly serviceName: string;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly priceMinor: number;
    readonly resourceName: string | null;
  }[];
}

/** What a client's visits add up to. */
export interface ClientVisitStats {
  readonly visits: number;
  readonly noShows: number;
  readonly cancellations: number;
  readonly spentMinor: number;
  readonly lastVisitAt: Date | null;
  readonly nextVisitAt: Date | null;
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
  /** A client's bookings ahead (soonest first) or behind (latest first). */
  forClient(
    clientId: string,
    scope: 'upcoming' | 'past',
    now: Date,
    limit: number,
  ): Promise<CabinetBookingView[]>;
  clientStats(clientIds: readonly string[], now: Date): Promise<Map<string, ClientVisitStats>>;
}

export const CABINET_BOOKING_QUERIES = Symbol('CABINET_BOOKING_QUERIES');
