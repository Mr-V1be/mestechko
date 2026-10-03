/**
 * What a booking attempt in this browser tab became: the booking, the token that proves
 * the visitor made it and, while a prepayment is due, the payment page. Session only.
 */
export interface StoredBooking {
  readonly bookingId: string;
  readonly token: string;
  readonly checkoutUrl: string | null;
}

const KEY_PREFIX = 'mst-widget-attempt:';

export function rememberBooking(attemptId: string, booking: StoredBooking): void {
  try {
    window.sessionStorage.setItem(`${KEY_PREFIX}${attemptId}`, JSON.stringify(booking));
  } catch {
    // Without storage the visitor still sees the result now; only a reload loses it.
  }
}

function text(value: object, key: string): string | null {
  const field: unknown = (value as Record<string, unknown>)[key];
  return typeof field === 'string' ? field : null;
}

export function storedBooking(attemptId: string): StoredBooking | null {
  try {
    const raw = window.sessionStorage.getItem(`${KEY_PREFIX}${attemptId}`);
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (typeof value !== 'object' || value === null) {
      return null;
    }
    const bookingId = text(value, 'bookingId');
    const token = text(value, 'token');
    return bookingId && token
      ? { bookingId, token, checkoutUrl: text(value, 'checkoutUrl') }
      : null;
  } catch {
    return null;
  }
}
