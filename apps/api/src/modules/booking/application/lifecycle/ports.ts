import type {
  BookingActor,
  BookingEventKind,
  BookingSource,
  BookingStatus,
  CurrencyCode,
  MessengerChannel,
} from '@slotwise/domain';
import type { BookingHold, NewBookingItem } from '../ports.js';

/** A booking as its lifecycle rules see it, locked for the current transaction. */
export interface LockedBooking {
  readonly id: string;
  readonly clientId: string;
  readonly customerId: string | null;
  readonly locationId: string;
  readonly timeZone: string;
  readonly staffId: string;
  readonly status: BookingStatus;
  readonly hold: BookingHold | null;
  readonly source: BookingSource;
  readonly version: number;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly attendanceConfirmedAt: Date | null;
  /** Services in booking order, with the prices agreed for them. */
  readonly serviceIds: readonly string[];
  readonly itemPrices: readonly number[];
  readonly totalPriceMinor: number;
  readonly depositMinor: number;
  readonly currency: CurrencyCode;
}

export interface NewBookingEvent {
  readonly id: string;
  readonly bookingId: string;
  readonly kind: BookingEventKind;
  readonly actor: BookingActor;
  readonly channel: MessengerChannel | null;
  readonly previousStartsAt: Date | null;
  /** Staff member before a move to someone else. */
  readonly previousStaffId: string | null;
  /** Cabinet user behind a business change. */
  readonly actorUserId: string | null;
  readonly occurredAt: Date;
}

export interface BookingMove {
  readonly staffId: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly totalPriceMinor: number;
  readonly items: readonly NewBookingItem[];
}

/**
 * Writes of a booking's life after it was made. Changes bump the version, which keys
 * the booking's planned messages; attendance does not, so reminders stay planned.
 */
export interface BookingLifecycleStore {
  /** The booking with a row lock until the transaction ends; `null` if not in this tenant. */
  lock(bookingId: string): Promise<LockedBooking | null>;
  /** Moves the booking to a final or firm status; a hold, if any, ends with it. */
  setStatus(booking: LockedBooking, status: BookingStatus, at: Date): Promise<void>;
  /** Keeps a held booking held for another reason, e.g. an accepted offer awaiting payment. */
  rehold(booking: LockedBooking, hold: BookingHold, at: Date): Promise<void>;
  /** Replaces the booking's time, staff and items; throws `SlotConflictError` if taken. */
  move(booking: LockedBooking, move: BookingMove, at: Date): Promise<void>;
  confirmAttendance(booking: LockedBooking, at: Date): Promise<void>;
  recordEvent(event: NewBookingEvent): Promise<void>;
}

export const BOOKING_LIFECYCLE_STORE = Symbol('BOOKING_LIFECYCLE_STORE');
