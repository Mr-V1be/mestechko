import { Controller, Inject } from '@nestjs/common';
import {
  createMiniAppBooking,
  getMiniAppBooking,
  getMiniAppProfile,
  listMiniAppBookings,
  type ClientBooking,
  type RouteInput,
  type RouteResult,
} from '@mestechko/contracts';
import { TelegramClient } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { TelegramUser } from '../../../platform/http/principal.js';
import { ClientBookings, type ClientIdentity } from '../application/client/client-bookings.js';
import { CreateClientBooking } from '../application/client/create-client-booking.js';

const identityOf = (slug: string, user: TelegramUser): ClientIdentity => ({
  businessSlug: slug,
  channel: 'telegram',
  externalUserId: user.id,
});

/** Client bookings made from the Telegram Mini App. */
@Controller()
export class MiniAppBookingsController {
  constructor(
    @Inject(CreateClientBooking) private readonly createBooking: CreateClientBooking,
    @Inject(ClientBookings) private readonly bookings: ClientBookings,
  ) {}

  @ContractRoute(createMiniAppBooking)
  create(
    @ContractInput() input: RouteInput<typeof createMiniAppBooking>,
    @TelegramClient() user: TelegramUser,
  ): Promise<ClientBooking> {
    return this.createBooking.execute({
      businessSlug: input.params.slug,
      channel: 'telegram',
      source: 'telegram_mini_app',
      externalUserId: user.id,
      idempotencyKey: input.headers['idempotency-key'],
      locationId: input.body.locationId,
      serviceIds: input.body.serviceIds,
      staffId: input.body.staffId,
      start: input.body.start,
      agreedTotal: input.body.agreedTotal,
      contact: input.body.contact,
      comment: input.body.comment,
    });
  }

  @ContractRoute(listMiniAppBookings)
  list(
    @ContractInput() input: RouteInput<typeof listMiniAppBookings>,
    @TelegramClient() user: TelegramUser,
  ): Promise<RouteResult<typeof listMiniAppBookings>> {
    return this.bookings.list(
      identityOf(input.params.slug, user),
      input.query.scope,
      input.query.cursor ?? null,
    );
  }

  @ContractRoute(getMiniAppBooking)
  get(
    @ContractInput() input: RouteInput<typeof getMiniAppBooking>,
    @TelegramClient() user: TelegramUser,
  ): Promise<ClientBooking> {
    return this.bookings.get(identityOf(input.params.slug, user), input.params.bookingId);
  }

  @ContractRoute(getMiniAppProfile)
  profile(
    @ContractInput() input: RouteInput<typeof getMiniAppProfile>,
    @TelegramClient() user: TelegramUser,
  ): Promise<RouteResult<typeof getMiniAppProfile>> {
    return this.bookings.profile(identityOf(input.params.slug, user));
  }
}
