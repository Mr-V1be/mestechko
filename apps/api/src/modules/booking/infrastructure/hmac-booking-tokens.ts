import { createHmac, timingSafeEqual } from 'node:crypto';
import { ApplicationError } from '../../../shared/application/application-error.js';
import type { BookingTokens } from '../application/ports.js';

/** Tokens are an HMAC of the booking id: nothing to store, nothing to guess. */
export class HmacBookingTokens implements BookingTokens {
  constructor(private readonly key: string | null) {}

  issue(bookingId: string): string {
    return this.sign(bookingId);
  }

  verify(bookingId: string, token: string): boolean {
    const expected = Buffer.from(this.sign(bookingId));
    const received = Buffer.from(token);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }

  private sign(bookingId: string): string {
    if (!this.key) {
      throw new ApplicationError('dependency_unavailable', 'Website bookings are not configured');
    }
    return createHmac('sha256', this.key).update(`booking:${bookingId}`).digest('base64url');
  }
}
