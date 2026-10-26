import { Controller, Inject } from '@nestjs/common';
import {
  acceptMiniAppOffer,
  declineMiniAppOffer,
  joinMiniAppWaitlist,
  leaveMiniAppWaitlist,
  listMiniAppWaitlist,
  type RouteInput,
  type RouteResult,
  type WaitlistEntry,
} from '@slotwise/contracts';
import { TelegramClient } from '../../../platform/http/auth.guard.js';
import { clientContactOf } from '../../clients/application/client-contact-policy.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { TelegramUser } from '../../../platform/http/principal.js';
import type { ClientIdentity } from '../../booking/application/client/client-bookings.js';
import { WaitlistEntries } from '../application/waitlist-entries.js';
import { WaitlistOffers } from '../application/waitlist-offers.js';

const identityOf = (slug: string, user: TelegramUser): ClientIdentity => ({
  business: { slug },
  channel: 'telegram',
  externalUserId: user.id,
});

/** The client's waitlist in the Telegram Mini App. */
@Controller()
export class MiniAppWaitlistController {
  constructor(
    @Inject(WaitlistEntries) private readonly entries: WaitlistEntries,
    @Inject(WaitlistOffers) private readonly offers: WaitlistOffers,
  ) {}

  @ContractRoute(joinMiniAppWaitlist)
  join(
    @ContractInput() input: RouteInput<typeof joinMiniAppWaitlist>,
    @TelegramClient() user: TelegramUser,
  ): Promise<WaitlistEntry> {
    return this.entries.join(identityOf(input.params.slug, user), {
      locationId: input.body.locationId,
      serviceIds: input.body.serviceIds,
      staffId: input.body.staffId,
      date: input.body.date,
      dayPart: input.body.dayPart,
      contact: clientContactOf(input.body.contact, { demoNumbersAllowed: user.demoLaunch }),
    });
  }

  @ContractRoute(listMiniAppWaitlist)
  async list(
    @ContractInput() input: RouteInput<typeof listMiniAppWaitlist>,
    @TelegramClient() user: TelegramUser,
  ): Promise<RouteResult<typeof listMiniAppWaitlist>> {
    return { items: await this.entries.list(identityOf(input.params.slug, user)) };
  }

  @ContractRoute(leaveMiniAppWaitlist)
  leave(
    @ContractInput() input: RouteInput<typeof leaveMiniAppWaitlist>,
    @TelegramClient() user: TelegramUser,
  ): Promise<void> {
    return this.entries.leave(identityOf(input.params.slug, user), input.params.entryId);
  }

  @ContractRoute(acceptMiniAppOffer)
  acceptOffer(
    @ContractInput() input: RouteInput<typeof acceptMiniAppOffer>,
    @TelegramClient() user: TelegramUser,
  ): Promise<RouteResult<typeof acceptMiniAppOffer>> {
    return this.offers.acceptForBooking(
      identityOf(input.params.slug, user),
      input.params.bookingId,
    );
  }

  @ContractRoute(declineMiniAppOffer)
  declineOffer(
    @ContractInput() input: RouteInput<typeof declineMiniAppOffer>,
    @TelegramClient() user: TelegramUser,
  ): Promise<void> {
    return this.offers.declineForBooking(
      identityOf(input.params.slug, user),
      input.params.bookingId,
    );
  }
}
