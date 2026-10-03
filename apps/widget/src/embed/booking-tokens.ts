/**
 * What proves a visitor made a booking in this browser tab: the token the API issued
 * and, while a prepayment is due, the payment page. Kept for the session only.
 */
export interface StoredBooking {
  readonly token: string;
  readonly checkoutUrl: string | null;
}

const KEY_PREFIX = 'mst-widget-booking:';

export function rememberBooking(bookingId: string, booking: StoredBooking): void {
  try {
    window.sessionStorage.setItem(`${KEY_PREFIX}${bookingId}`, JSON.stringify(booking));
  } catch {
    // Without storage the visitor still sees the result now; only a reload loses it.
  }
}

export function storedBooking(bookingId: string): StoredBooking | null {
  try {
    const raw = window.sessionStorage.getItem(`${KEY_PREFIX}${bookingId}`);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (
      typeof value === 'object' &&
      value !== null &&
      'token' in value &&
      typeof value.token === 'string'
    ) {
      const checkoutUrl = 'checkoutUrl' in value ? value.checkoutUrl : null;
      return { token: value.token, checkoutUrl: typeof checkoutUrl === 'string' ? checkoutUrl : null };
    }
    return null;
  } catch {
    return null;
  }
}
