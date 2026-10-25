import type { Locale, MessengerChannel } from '@mestechko/domain';
import type { WaitlistOffers } from '../../../waitlist/application/waitlist-offers.js';
import type { BusinessContextResolver } from '../../../tenancy/application/business-context.js';
import type { BotAction } from '../action-data.js';
import type { ActionReply } from '../channel.js';
import type { BotMessageBook } from '../composer/bot-messages.js';
import { businessCardOf, identityIn, type Speaker } from './conversation-context.js';

type OfferTarget = Extract<BotAction, { entryId: string }>;

/** The client's answer to an offer of freed time. */
export class OfferDialog {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly offers: WaitlistOffers,
    private readonly book: BotMessageBook,
  ) {}

  async accept(
    channel: MessengerChannel,
    person: Speaker,
    target: OfferTarget,
  ): Promise<ActionReply> {
    const messages = this.book.in(person.locale);
    const context = await this.businesses.byId(target.businessId);
    const booking = await this.offers.accept(
      identityIn(target.businessId, channel, person),
      target.entryId,
      new Date(target.start),
    );
    const card = businessCardOf(context);
    return booking.hold
      ? {
          replace: messages.booking(card, booking, messages.text('offer.kept'), []),
          notice: null,
        }
      : {
          replace: messages.notification('booking_created', card, booking),
          notice: messages.notice('booked'),
        };
  }

  async decline(
    channel: MessengerChannel,
    person: Speaker,
    target: OfferTarget,
  ): Promise<ActionReply> {
    await this.offers.decline(
      identityIn(target.businessId, channel, person),
      target.entryId,
      new Date(target.start),
    );
    const messages = this.book.in(person.locale);
    return {
      replace: {
        title: messages.text('notice.waitlist_offer'),
        lines: [messages.text('offer.declined')],
        buttons: [],
      },
      notice: null,
    };
  }

  /** The offer can no longer be taken: someone was faster or the wish was withdrawn. */
  gone(reason: 'taken' | 'closed', locale: Locale): ActionReply {
    const messages = this.book.in(locale);
    return {
      replace: {
        title: messages.text('notice.waitlist_offer'),
        lines: [messages.text(`offer.${reason}`)],
        buttons: [],
      },
      notice: null,
    };
  }
}
