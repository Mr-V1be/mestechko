import type { ClientBooking } from '@mestechko/contracts/client';

/** How long a returning payer waits for the confirmation before hearing it is late. */
export const RETURN_WAIT_MS = 30_000;

/** Whether the booking holds its time until the prepayment arrives. */
export function awaitsPayment(booking: ClientBooking): boolean {
  return booking.status === 'held' && booking.hold?.reason === 'payment';
}

/**
 * What a client sees while the provider's notice travels: back from the page, or still
 * paying in the browser outside the app.
 */
export type ReturnOutcome = 'checking' | 'outside' | 'late' | 'paid' | 'declined';

export function returnOutcome(
  booking: ClientBooking,
  waitedMs: number,
  outside: boolean,
): ReturnOutcome {
  if (booking.payment?.status === 'succeeded' && booking.status === 'confirmed') {
    return 'paid';
  }
  if (booking.payment?.status === 'cancelled' || booking.status === 'cancelled') {
    return 'declined';
  }
  if (outside) {
    return 'outside';
  }
  return waitedMs < RETURN_WAIT_MS ? 'checking' : 'late';
}
