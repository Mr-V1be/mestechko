import {
  bookingSources,
  DESK_CHANGE_SETTLE_MS,
  eventNoticeKinds,
  isUnchangedForClient,
  planBookingNotifications,
  type BookingLifecycleEvent,
  type BookingSource,
  type MessengerChannel,
  type VisitState,
} from '@slotwise/domain';
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
    /** Where the visit was and is now, for a move. */
    readonly change?: { readonly from: VisitState; readonly to: VisitState };
    /** A front-desk change that may be taken back at once: its notice waits a moment. */
    readonly settle?: boolean;
    readonly now: Date;
  }): Promise<void> {
    // A notice still waiting means the client never heard of that change: they still
    // know the visit as it was before it. Moved back there, they hear nothing at all.
    const unsent = input.change
      ? await this.outbox.unsentNotice(input.booking.id, eventNoticeKinds)
      : null;
    const clientKnows = unsent ? unsent.clientKnows : (input.change?.from ?? null);
    const unchanged =
      input.change !== undefined && isUnchangedForClient(clientKnows, input.change.to);
    // Nothing told yet (the booking's own notice still waits): the client hears about
    // the booking once, as it is now, not about a move of something they never knew.
    const unannounced = input.change !== undefined && unsent !== null && clientKnows === null;
    const event: BookingLifecycleEvent = unannounced ? 'created' : input.event;
    await this.outbox.replaceForBooking({
      businessId: input.businessId,
      bookingId: input.booking.id,
      bookingVersion: input.booking.version,
      recipient: await this.recipientOf(input.booking),
      planned: planBookingNotifications({
        event,
        startsAt: input.booking.startsAt.getTime(),
        now: input.now.getTime(),
        seenByClient: input.seenByClient || unchanged,
        settleMs: input.settle ? DESK_CHANGE_SETTLE_MS : 0,
      }),
      clientKnows,
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
