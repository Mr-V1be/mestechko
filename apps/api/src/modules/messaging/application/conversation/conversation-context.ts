import type { MessengerChannel } from '@mestechko/domain';
import type { ClientIdentity } from '../../../booking/application/client/client-bookings.js';
import type { ChangeOrigin } from '../../../booking/application/lifecycle/client-booking-changes.js';
import type { BusinessContext } from '../../../tenancy/application/business-context.js';
import type { InboundPerson } from '../channel.js';
import type { BusinessCard } from '../composer/bot-messages.js';

/** The person who pressed, as a client of the business the button belongs to. */
export function identityIn(
  businessId: string,
  channel: MessengerChannel,
  person: InboundPerson,
): ClientIdentity {
  return { business: { id: businessId }, channel, externalUserId: person.externalId };
}

/** Changes made from a chat: the edited message shows the result, no separate notice. */
export function chatOrigin(channel: MessengerChannel): ChangeOrigin {
  return { channel, surface: 'chat' };
}

export function businessCardOf(context: BusinessContext): BusinessCard {
  return {
    id: context.business.id,
    slug: context.business.slug,
    name: context.business.name,
    vertical: context.vertical,
  };
}
