import {
  bookingSources,
  planBookingNotifications,
  type BookingLifecycleEvent,
  type BookingSource,
} from '@mestechko/domain';
import type { NotificationOutbox } from '../../../notifications/application/ports.js';

export interface NotifiedBooking {
  readonly id: string;
  /** Version after the event. */
  readonly version: number;
  readonly startsAt: Date;
  readonly source: BookingSource;
  /** Customer behind the client card; `null` for clients without a messenger. */
  readonly customerId: string | null;
}

/**
 * Turns a booking event into outbox messages: the notice and the reminders of the
 * booking's current version replace whatever was pending for it.
 */
export class BookingNotifier {
  constructor(private readonly outbox: NotificationOutbox) {}

  async plan(input: {
    readonly businessId: string;
    readonly booking: NotifiedBooking;
    readonly event: BookingLifecycleEvent;
    /** The client sees the outcome where they acted, e.g. in the chat they pressed. */
    readonly seenByClient: boolean;
    readonly now: Date;
  }): Promise<void> {
    const channel = bookingSources[input.booking.source].channel;
    await this.outbox.replaceForBooking({
      businessId: input.businessId,
      bookingId: input.booking.id,
      bookingVersion: input.booking.version,
      recipient:
        channel && input.booking.customerId
          ? { customerId: input.booking.customerId, channel }
          : null,
      planned: planBookingNotifications({
        event: input.event,
        startsAt: input.booking.startsAt.getTime(),
        now: input.now.getTime(),
        seenByClient: input.seenByClient,
      }),
      now: input.now,
    });
  }
}
