import type {
  BookingSource,
  BookingStatus,
  CurrencyCode,
  HoldReason,
  InstantInterval,
  Locale,
  Occupancy,
} from '@slotwise/domain';

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

/** Why and until when a held booking keeps its time. */
export interface BookingHold {
  readonly reason: HoldReason;
  readonly expiresAt: Date;
}

export interface NewBooking {
  readonly id: string;
  readonly locationId: string;
  readonly clientId: string;
  readonly staffId: string;
  readonly status: BookingStatus;
  /** Set exactly for held bookings. */
  readonly hold: BookingHold | null;
  /** Prepayment the booking asks for, in minor units; `0` when none. */
  readonly depositMinor: number;
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
  readonly hold: BookingHold | null;
  readonly depositMinor: number;
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
  /** Client card a booking belongs to. */
  clientOf(bookingId: string): Promise<string | null>;
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
  /** Payments whose refund the provider should now be asked for. */
  readonly refunds?: readonly string[];
}

/**
 * Work that follows a committed change: delivering messages due now, offering freed
 * time to the waitlist and asking for refunds. Best effort: periodic sweeps catch up.
 */
export interface BookingFollowUps {
  afterCommit(change: CommittedBookingChange): Promise<void>;
}

export const OCCUPANCY_READER = Symbol('OCCUPANCY_READER');
export const BOOKING_WRITER = Symbol('BOOKING_WRITER');
export const CLIENT_BOOKING_QUERIES = Symbol('CLIENT_BOOKING_QUERIES');
export const BOOKING_TELEMETRY = Symbol('BOOKING_TELEMETRY');
export const BOOKING_FOLLOW_UPS = Symbol('BOOKING_FOLLOW_UPS');

/** Held bookings whose hold ran out, across businesses; ids only. */
export interface ExpiredHolds {
  list(
    now: Date,
    limit: number,
  ): Promise<{ readonly businessId: string; readonly bookingId: string }[]>;
}

export const EXPIRED_HOLDS = Symbol('EXPIRED_HOLDS');

/** How a prepayment is described on the payment page, in the client's language. */
/** What a payment is for, as the payer reads it on the provider's page and receipts. */
export interface PaymentDescriptions {
  describe(input: {
    readonly businessName: string;
    readonly serviceNames: readonly string[];
    readonly startsAt: Date;
    readonly timeZone: string;
    readonly locale: Locale;
  }): string;
}

export const PAYMENT_DESCRIPTIONS = Symbol('PAYMENT_DESCRIPTIONS');

/** Proof a website visitor made a booking, without any stored state. */
export interface BookingTokens {
  issue(bookingId: string): string;
  verify(bookingId: string, token: string): boolean;
}

export const BOOKING_TOKENS = Symbol('BOOKING_TOKENS');

/** A visit ahead of a staff member, as a schedule change sees it. */
export interface StaffVisitView {
  readonly bookingId: string;
  readonly status: BookingStatus;
  readonly locationId: string;
  readonly timeZone: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  /** Time the visit occupies, buffers included. */
  readonly occupied: InstantInterval;
  readonly clientName: string;
  readonly serviceNames: readonly string[];
}

/** Visits of staff members that are still ahead and not final. */
export interface StaffVisits {
  upcoming(staffId: string, from: Date): Promise<StaffVisitView[]>;
  /** How many visits each staff member has ahead. */
  countUpcoming(from: Date): Promise<Map<string, number>>;
}

export const STAFF_VISITS = Symbol('STAFF_VISITS');
