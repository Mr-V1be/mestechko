import type { ClientChangesRule } from './booking-rules.js';
import {
  canConfirmAttendance,
  clientChangeVerdict,
  type ClientBookingState,
} from './client-changes.js';

interface BookingActionDefinition {
  readonly isAvailable: (
    booking: ClientBookingState,
    now: number,
    rule: ClientChangesRule,
  ) => boolean;
}

/**
 * Things a client can do with a booking from a message or the client app. Each action
 * says when it is available, so surfaces show only what will actually work.
 */
export const bookingActions = {
  confirm_attendance: { isAvailable: (booking, now) => canConfirmAttendance(booking, now) },
  reschedule: {
    isAvailable: (booking, now, rule) => clientChangeVerdict(booking, now, rule) === 'allowed',
  },
  cancel: {
    isAvailable: (booking, now, rule) => clientChangeVerdict(booking, now, rule) === 'allowed',
  },
} as const satisfies Record<string, BookingActionDefinition>;

export type BookingAction = keyof typeof bookingActions;

export const bookingActionIds = Object.keys(bookingActions) as BookingAction[];

export function availableBookingActions(
  candidates: readonly BookingAction[],
  booking: ClientBookingState,
  now: number,
  rule: ClientChangesRule,
): BookingAction[] {
  return candidates.filter((action) => bookingActions[action].isAvailable(booking, now, rule));
}
