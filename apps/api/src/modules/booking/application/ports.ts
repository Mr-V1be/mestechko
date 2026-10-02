import type {
  BookingSource,
  BookingStatus,
  CurrencyCode,
  InstantInterval,
  Occupancy,
} from '@mestechko/domain';

/** Time blocked by existing bookings of the current tenant. */
export interface OccupancyReader {
  /** `excludeBookingId` leaves out a booking being moved, so it does not block itself. */
  load(
    staffIds: readonly string[],
    resourceIds: readonly string[],
    window: InstantInterval,
    excludeBookingId: string | null,
  ): Promise<{ staff: Occupancy[]; resources: Occupancy[] }>;
}

export interface NewBookingItem {
  readonly id: string;
  readonly position: number;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly durationMinutes: number;
  readonly priceMinor: number;
  readonly resourceId: string | null;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly occupied: { readonly start: Date; readonly end: Date };
}

export interface NewBooking {
  readonly id: string;
  readonly locationId: string;
  readonly clientId: string;
  readonly staffId: string;
  readonly status: BookingStatus;
  readonly source: BookingSource;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly totalPriceMinor: number;
  readonly currency: CurrencyCode;
  readonly comment: string | null;
  readonly idempotencyKey: string | null;
  readonly createdAt: Date;
  readonly items: readonly NewBookingItem[];
}

/** The staff member or a resource is already taken: the database rejected an overlap. */
export class SlotConflictError extends Error {
  constructor() {
    super('The time is already taken');
    this.name = 'SlotConflictError';
  }
}

/** Another request with the same idempotency key created the booking first. */
export class DuplicateRequestError extends Error {
  constructor() {
    super('A booking for this idempotency key already exists');
    this.name = 'DuplicateRequestError';
  }
}

export interface BookingWriter {
  /** Inserts atomically; throws `SlotConflictError` or `DuplicateRequestError`. */
  insert(booking: NewBooking): Promise<void>;
}

export interface BookedService {
  readonly id: string;
  readonly name: string;
  readonly durationMinutes: number;
  readonly priceMinor: number;
}

export interface ClientBookingView {
  readonly id: string;
  readonly status: BookingStatus;
  readonly version: number;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly attendanceConfirmedAt: Date | null;
  readonly location: {
    readonly id: string;
    readonly name: string;
    readonly address: string;
    readonly timeZone: string;
  };
  readonly staff: {
    readonly id: string;
    readonly displayName: string;
    readonly title: string | null;
    readonly avatarSeed: string;
  };
  readonly services: readonly BookedService[];
  readonly totalPriceMinor: number;
  readonly currency: CurrencyCode;
  readonly comment: string | null;
  readonly createdAt: Date;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

export type ClientBookingScope = 'upcoming' | 'past';

export interface ClientBookingQueries {
  findIdByIdempotencyKey(clientId: string, key: string): Promise<string | null>;
  get(clientId: string, bookingId: string): Promise<ClientBookingView | null>;
  list(
    clientId: string,
    scope: ClientBookingScope,
    now: Date,
    page: { readonly cursor: string | null; readonly limit: number },
  ): Promise<Page<ClientBookingView>>;
}

export interface BookingTelemetry {
  bookingCreated(source: BookingSource): void;
  slotConflict(): void;
}

/** What a committed booking change leaves for after the transaction. */
export interface CommittedBookingChange {
  readonly businessId: string;
  /** Time that became free and may suit someone on the waitlist. */
  readonly freedTime: { readonly locationId: string; readonly date: string } | null;
}

/**
 * Work that follows a committed change: delivering messages due now and offering freed
 * time to the waitlist. Best effort: periodic sweeps catch up if it fails.
 */
export interface BookingFollowUps {
  afterCommit(change: CommittedBookingChange): Promise<void>;
}

export const OCCUPANCY_READER = Symbol('OCCUPANCY_READER');
export const BOOKING_WRITER = Symbol('BOOKING_WRITER');
export const CLIENT_BOOKING_QUERIES = Symbol('CLIENT_BOOKING_QUERIES');
export const BOOKING_TELEMETRY = Symbol('BOOKING_TELEMETRY');
export const BOOKING_FOLLOW_UPS = Symbol('BOOKING_FOLLOW_UPS');
