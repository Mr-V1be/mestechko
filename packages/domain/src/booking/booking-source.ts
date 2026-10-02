import type { MessengerChannel } from '../channels/messenger-channels.js';

/** How the person booked: inside a messenger's web app, in its chat, or elsewhere. */
export type BookingSurface = 'web_app' | 'chat' | 'cabinet' | 'website';

interface BookingSourceDefinition {
  /** Messenger the client used, if any; drives where notifications go. */
  readonly channel: MessengerChannel | null;
  readonly surface: BookingSurface;
}

/** Where a booking was made. */
export const bookingSources = {
  telegram_mini_app: { channel: 'telegram', surface: 'web_app' },
  max_mini_app: { channel: 'max', surface: 'web_app' },
  telegram_bot: { channel: 'telegram', surface: 'chat' },
  max_bot: { channel: 'max', surface: 'chat' },
  cabinet: { channel: null, surface: 'cabinet' },
  widget: { channel: null, surface: 'website' },
} as const satisfies Record<string, BookingSourceDefinition>;

export type BookingSource = keyof typeof bookingSources;

export const bookingSourceIds = Object.keys(bookingSources) as BookingSource[];

/** The source of a booking made through a messenger on one of its surfaces. */
export function messengerBookingSource(
  channel: MessengerChannel,
  surface: Extract<BookingSurface, 'web_app' | 'chat'>,
): BookingSource {
  const source = bookingSourceIds.find(
    (candidate) =>
      bookingSources[candidate].channel === channel &&
      bookingSources[candidate].surface === surface,
  );
  if (!source) {
    throw new Error(`No booking source for ${channel} ${surface}`);
  }
  return source;
}
