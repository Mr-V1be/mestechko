import { bookingStatuses, canMoveToStatus, type BookingStatus } from './booking-status.js';

export interface BusinessBookingState {
  readonly status: BookingStatus;
  readonly startsAt: number;
}

interface BusinessActionDefinition {
  readonly isAvailable: (booking: BusinessBookingState, now: number) => boolean;
}

/**
 * What the business can do with a booking from the cabinet. Unlike the client, the
 * business is not bound by the online change cutoff; visits are marked once they began.
 */
export const businessBookingActions = {
  move: { isAvailable: (booking) => bookingStatuses[booking.status].movable },
  cancel: { isAvailable: (booking) => canMoveToStatus(booking.status, 'cancelled') },
  complete: {
    isAvailable: (booking, now) =>
      canMoveToStatus(booking.status, 'completed') && now >= booking.startsAt,
  },
  no_show: {
    isAvailable: (booking, now) =>
      canMoveToStatus(booking.status, 'no_show') && now >= booking.startsAt,
  },
} as const satisfies Record<string, BusinessActionDefinition>;

export type BusinessBookingAction = keyof typeof businessBookingActions;

export const businessBookingActionIds = Object.keys(
  businessBookingActions,
) as BusinessBookingAction[];
