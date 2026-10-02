import {
  bookingSources,
  planBookingNotifications,
  type BookingLifecycleEvent,
  type BookingSource,
  type MessengerChannel,
} from '@mestechko/domain';
import type { MessengerContacts } from '../../../clients/application/ports.js';
import type {
  NotificationOutbox,
  NotificationRecipient,
} from '../../../notifications/application/ports.js';

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
 * booking's current version replace whatever was pending for it. Messages go to the
 * messenger the client booked through, or, for bookings made by the business or on a
 * website, to the messenger the client allowed to write to them.
 */
export class BookingNotifier {
  constructor(
    private readonly outbox: NotificationOutbox,
    private readonly contacts: MessengerContacts,
  ) {}

  async plan(input: {
    readonly businessId: string;
    readonly booking: NotifiedBooking;
    readonly event: BookingLifecycleEvent;
    /** The client sees the outcome where they acted, e.g. in the chat they pressed. */
    readonly seenByClient: boolean;
    readonly now: Date;
  }): Promise<void> {
    await this.outbox.replaceForBooking({
      businessId: input.businessId,
      bookingId: input.booking.id,
      bookingVersion: input.booking.version,
      recipient: await this.recipientOf(input.booking),
      planned: planBookingNotifications({
        event: input.event,
        startsAt: input.booking.startsAt.getTime(),
        now: input.now.getTime(),
        seenByClient: input.seenByClient,
      }),
      now: input.now,
    });
  }

  private async recipientOf(booking: NotifiedBooking): Promise<NotificationRecipient | null> {
    const customerId = booking.customerId;
    if (!customerId) {
      return null;
    }
    const channel: MessengerChannel | null =
      bookingSources[booking.source].channel ?? (await this.contacts.preferredChannel(customerId));
    return channel ? { customerId, channel } : null;
  }
}
