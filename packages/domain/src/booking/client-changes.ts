import { MS_PER_MINUTE } from '../time/instant-interval.js';
import type { ClientChangesRule } from './booking-rules.js';
import { bookingStatuses, type BookingStatus } from './booking-status.js';

/** What the client-side rules need to know about a booking. */
export interface ClientBookingState {
  readonly status: BookingStatus;
  /** Epoch milliseconds of the visit start. */
  readonly startsAt: number;
  readonly attendanceConfirmedAt: number | null;
}

/**
 * Why a client change is or is not possible: `closed` when the booking no longer takes
 * changes (cancelled, visited), `too_late` past the business's cutoff before the visit.
 */
export type ClientChangeVerdict = 'allowed' | 'closed' | 'too_late';

/** Last moment the client may reschedule or cancel online. */
export function clientChangeDeadline(startsAt: number, rule: ClientChangesRule): number {
  return startsAt - rule.cutoffMinutes * MS_PER_MINUTE;
}

export function clientChangeVerdict(
  booking: ClientBookingState,
  now: number,
  rule: ClientChangesRule,
): ClientChangeVerdict {
  if (!bookingStatuses[booking.status].acceptsClientChanges || now >= booking.startsAt) {
    return 'closed';
  }
  return now <= clientChangeDeadline(booking.startsAt, rule) ? 'allowed' : 'too_late';
}

/** The client can confirm a visit that is still ahead and not yet confirmed. */
export function canConfirmAttendance(booking: ClientBookingState, now: number): boolean {
  return (
    bookingStatuses[booking.status].acceptsClientChanges &&
    booking.attendanceConfirmedAt === null &&
    now < booking.startsAt
  );
}
