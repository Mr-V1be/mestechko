import type { ClientBooking } from '@mestechko/contracts/client';

/** How long a returning payer waits for the confirmation before hearing it is late. */
export const RETURN_WAIT_MS = 30_000;

/** Whether the booking holds its time until the prepayment arrives. */
export function awaitsPayment(booking: ClientBooking): boolean {
  return booking.status === 'held' && booking.hold?.reason === 'payment';
}

/** What a client back from the payment page sees, while the provider's notice travels. */
export type ReturnOutcome = 'checking' | 'late' | 'paid' | 'declined';

export function returnOutcome(booking: ClientBooking, waitedMs: number): ReturnOutcome {
  if (booking.payment?.status === 'succeeded' && booking.status === 'confirmed') {
    return 'paid';
  }
  if (booking.payment?.status === 'cancelled' || booking.status === 'cancelled') {
    return 'declined';
  }
  return waitedMs < RETURN_WAIT_MS ? 'checking' : 'late';
}
