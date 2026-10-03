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
  /** The booking attempt to show instead of the form, e.g. after paying. */
  readonly attemptId: string | null;
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
  const attemptId = params.get('attempt');
  return {
    business: business && SLUG.test(business) ? business : null,
    theme: oneOf(embedThemes, params.get('theme'), 'auto'),
    mode: oneOf(embedModes, params.get('mode'), 'inline'),
    attemptId: attemptId && UUID.test(attemptId) ? attemptId : null,
    paymentReturn: params.get('payment') === 'return',
  };
}

/**
 * The frame's own address for a booking attempt. The booking's id is not known before
 * it exists, so the attempt names it; the tab remembers which booking it became.
 */
export function attemptPath(
  params: EmbedParams,
  attemptId: string,
  options: { readonly paymentReturn: boolean },
): string {
  const query = new URLSearchParams({
    business: params.business ?? '',
    theme: params.theme,
    mode: params.mode,
    attempt: attemptId,
    ...(options.paymentReturn ? { payment: 'return' } : {}),
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
