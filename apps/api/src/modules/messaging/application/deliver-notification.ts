import { isNotificationStale, type Clock } from '@mestechko/domain';
import type { JobHandler } from '../../../shared/application/job-queue.js';
import type { ClientBookings } from '../../booking/application/client/client-bookings.js';
import type { MessengerContacts } from '../../clients/application/ports.js';
import type {
  NotificationRecord,
  NotificationStore,
  SkipReason,
} from '../../notifications/application/ports.js';
import type { BusinessContextResolver } from '../../tenancy/application/business-context.js';
import type { WaitlistOffers } from '../../waitlist/application/waitlist-offers.js';
import { MessengerDeliveryError, type MessengerChannels, type OutboundMessage } from './channel.js';
import type { BotMessages } from './composer/bot-messages.js';
import { businessCardOf } from './conversation/conversation-context.js';

type Composed = { readonly message: OutboundMessage } | { readonly skip: SkipReason };

/**
 * Delivers one claimed message. What it says is composed now, from the current state:
 * a booking that changed since the message was planned makes it obsolete.
 */
export class DeliverNotification implements JobHandler<{ notificationId: string }> {
  constructor(
    private readonly store: NotificationStore,
    private readonly contacts: MessengerContacts,
    private readonly channels: MessengerChannels,
    private readonly businesses: BusinessContextResolver,
    private readonly bookings: ClientBookings,
    private readonly offers: WaitlistOffers,
    private readonly messages: BotMessages,
    private readonly clock: Clock,
  ) {}

  async handle(payload: { notificationId: string }): Promise<void> {
    const notification = await this.store.findClaimed(payload.notificationId);
    if (!notification) {
      return;
    }
    const now = new Date(this.clock.now().epochMilliseconds);
    if (isNotificationStale(notification.kind, notification.dueAt.getTime(), now.getTime())) {
      await this.store.markSkipped(notification.id, 'stale', now);
      return;
    }
    const channel = this.channels.get(notification.channel);
    if (!channel) {
      await this.store.markSkipped(notification.id, 'channel_unavailable', now);
      return;
    }
    const address = await this.contacts.addressOf(notification.customerId, notification.channel);
    if (!address) {
      await this.store.markSkipped(notification.id, 'no_permission', now);
      return;
    }
    const composed = await this.compose(notification);
    if ('skip' in composed) {
      await this.store.markSkipped(notification.id, composed.skip, now);
      return;
    }
    try {
      const sent = await channel.send(address.chatId, composed.message);
      await this.store.markSent(notification.id, sent.messageId, now);
    } catch (error) {
      if (error instanceof MessengerDeliveryError && error.reason !== 'temporarily_unavailable') {
        if (error.reason === 'recipient_blocked') {
          await this.contacts.revoke(notification.channel, address.externalId);
        }
        await this.store.markSkipped(notification.id, 'recipient_blocked', now);
        return;
      }
      throw error;
    }
  }

  private async compose(notification: NotificationRecord): Promise<Composed> {
    const context = await this.businesses.byId(notification.businessId);
    const business = businessCardOf(context);
    if (
      notification.waitlistEntryId &&
      notification.offerStartsAt &&
      notification.offerTotalMinor !== null
    ) {
      const offer = await this.offers.describe(
        notification.businessId,
        notification.waitlistEntryId,
        notification.offerStartsAt,
        notification.offerTotalMinor,
      );
      if (!offer) {
        return { skip: 'offer_closed' };
      }
      return {
        message: this.messages.offer(business, {
          entryId: offer.entry.id,
          startsAt: offer.startsAt,
          total: { amountMinor: offer.totalMinor, currency: context.business.currency },
          timeZone: offer.entry.location.timeZone,
          address: offer.entry.location.address,
          services: offer.entry.services.map((service) => service.name),
          staffName: offer.entry.staff?.displayName ?? null,
          holdsUntil: offer.holdsUntil,
        }),
      };
    }
    const booking = notification.bookingId
      ? await this.bookings.getForCustomer(
          notification.businessId,
          notification.customerId,
          notification.bookingId,
        )
      : null;
    if (booking?.version !== notification.bookingVersion) {
      return { skip: 'booking_changed' };
    }
    return { message: this.messages.notification(notification.kind, business, booking) };
  }
}
