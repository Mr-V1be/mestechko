/**
 * What the embedding page asked for, from the frame's address: which business, the
 * theme and how the widget is shown. A return from the payment page adds the booking.
 */
export const embedThemes = ['auto', 'light', 'dark'] as const;
export type EmbedTheme = (typeof embedThemes)[number];

export const embedModes = ['inline', 'popup'] as const;
export type EmbedMode = (typeof embedModes)[number];

export interface EmbedParams {
  readonly business: string | null;
  readonly theme: EmbedTheme;
  readonly mode: EmbedMode;
  /** A booking to show instead of the form, e.g. after paying. */
  readonly bookingId: string | null;
  readonly paymentReturn: boolean;
}

const EMBED_PAGE = '/embed.html';
const SLUG = /^[a-z0-9][a-z0-9-]{1,62}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function oneOf<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
  return values.find((candidate) => candidate === value) ?? fallback;
}

export function readEmbedParams(search: string = window.location.search): EmbedParams {
  const params = new URLSearchParams(search);
  const business = params.get('business');
  const bookingId = params.get('booking');
  return {
    business: business && SLUG.test(business) ? business : null,
    theme: oneOf(embedThemes, params.get('theme'), 'auto'),
    mode: oneOf(embedModes, params.get('mode'), 'inline'),
    bookingId: bookingId && UUID.test(bookingId) ? bookingId : null,
    paymentReturn: params.get('payment') === 'return',
  };
}

/** The frame's own address for a booking: where the payment page sends the visitor back. */
export function bookingReturnPath(params: EmbedParams, bookingId: string): string {
  const query = new URLSearchParams({
    business: params.business ?? '',
    theme: params.theme,
    mode: params.mode,
    booking: bookingId,
    payment: 'return',
  });
  return `${EMBED_PAGE}?${query.toString()}`;
}

/** The frame's address for a fresh form, e.g. after a finished booking. */
export function freshFormPath(params: EmbedParams): string {
  const query = new URLSearchParams({
    business: params.business ?? '',
    theme: params.theme,
    mode: params.mode,
  });
  return `${EMBED_PAGE}?${query.toString()}`;
}
