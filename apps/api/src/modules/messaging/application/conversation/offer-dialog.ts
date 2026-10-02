import type { MessengerChannel } from '@mestechko/domain';
import type { WaitlistOffers } from '../../../waitlist/application/waitlist-offers.js';
import type { BusinessContextResolver } from '../../../tenancy/application/business-context.js';
import type { BotAction } from '../action-data.js';
import type { ActionReply, InboundPerson } from '../channel.js';
import type { BotMessages } from '../composer/bot-messages.js';
import { businessCardOf, identityIn } from './conversation-context.js';

type OfferTarget = Extract<BotAction, { entryId: string }>;

/** The client's answer to an offer of freed time. */
export class OfferDialog {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly offers: WaitlistOffers,
    private readonly messages: BotMessages,
  ) {}

  async accept(
    channel: MessengerChannel,
    person: InboundPerson,
    target: OfferTarget,
  ): Promise<ActionReply> {
    const context = await this.businesses.byId(target.businessId);
    const booking = await this.offers.accept(
      identityIn(target.businessId, channel, person),
      target.entryId,
      new Date(target.start),
    );
    return {
      replace: this.messages.notification('booking_created', businessCardOf(context), booking),
      notice: this.messages.notice('booked'),
    };
  }

  decline(): Promise<ActionReply> {
    return Promise.resolve({
      replace: {
        title: this.messages.text('notice.waitlist_offer'),
        lines: [this.messages.text('offer.declined')],
        buttons: [],
      },
      notice: null,
    });
  }

  /** The offer can no longer be taken: someone was faster or the wish was withdrawn. */
  gone(reason: 'taken' | 'closed'): ActionReply {
    return {
      replace: {
        title: this.messages.text('notice.waitlist_offer'),
        lines: [this.messages.text(`offer.${reason}`)],
        buttons: [],
      },
      notice: null,
    };
  }
}
