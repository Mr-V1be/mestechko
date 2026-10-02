import type { MessengerChannel } from '../channels/messenger-channels.js';

interface BookingSourceDefinition {
  /** Messenger the client used, if any; drives where notifications go. */
  readonly channel: MessengerChannel | null;
}

/** Where a booking was made. */
export const bookingSources = {
  telegram_mini_app: { channel: 'telegram' },
  max_mini_app: { channel: 'max' },
  cabinet: { channel: null },
  widget: { channel: null },
} as const satisfies Record<string, BookingSourceDefinition>;

export type BookingSource = keyof typeof bookingSources;

export const bookingSourceIds = Object.keys(bookingSources) as BookingSource[];
