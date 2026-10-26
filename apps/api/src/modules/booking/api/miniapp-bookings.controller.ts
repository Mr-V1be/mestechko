import { Controller, Inject } from '@nestjs/common';
import { messengerBookingSource, type Locale } from '@slotwise/domain';
import {
  cancelMiniAppBooking,
  confirmMiniAppAttendance,
  createMiniAppBooking,
  getMiniAppBooking,
  getMiniAppProfile,
  getRescheduleOptions,
  listMiniAppBookings,
  rescheduleMiniAppBooking,
  startMiniAppPayment,
  type ClientBooking,
  type RouteInput,
  type RouteResult,
} from '@slotwise/contracts';
import { TelegramClient } from '../../../platform/http/auth.guard.js';
import { clientContactOf } from '../../clients/application/client-contact-policy.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import { RequestLocale } from '../../../platform/http/request-locale.js';
import type { TelegramUser } from '../../../platform/http/principal.js';
import { ClientBookings, type ClientIdentity } from '../application/client/client-bookings.js';
import { CreateClientBooking } from '../application/client/create-client-booking.js';
import { PrepaidBookings } from '../application/client/prepaid-bookings.js';
import {
  ClientBookingChanges,
  type ChangeOrigin,
} from '../application/lifecycle/client-booking-changes.js';
import { RescheduleOptions } from '../application/lifecycle/reschedule-options.js';

const identityOf = (slug: string, user: TelegramUser): ClientIdentity => ({
  business: { slug },
  channel: 'telegram',
  externalUserId: user.id,
});

const MINI_APP: ChangeOrigin = { channel: 'telegram', surface: 'web_app' };

/** Client bookings made and managed from the Telegram Mini App. */
@Controller()
export class MiniAppBookingsController {
  constructor(
    @Inject(CreateClientBooking) private readonly createBooking: CreateClientBooking,
    @Inject(ClientBookings) private readonly bookings: ClientBookings,
    @Inject(ClientBookingChanges) private readonly changes: ClientBookingChanges,
    @Inject(RescheduleOptions) private readonly rescheduleOptions: RescheduleOptions,
    @Inject(PrepaidBookings) private readonly prepaid: PrepaidBookings,
  ) {}

  @ContractRoute(createMiniAppBooking)
  create(
    @ContractInput() input: RouteInput<typeof createMiniAppBooking>,
    @TelegramClient() user: TelegramUser,
  ): Promise<ClientBooking> {
    return this.createBooking.execute({
      business: { slug: input.params.slug },
      channel: MINI_APP.channel,
      source: messengerBookingSource(MINI_APP.channel, MINI_APP.surface),
      externalUserId: user.id,
      idempotencyKey: input.headers['idempotency-key'],
      locationId: input.body.locationId,
      serviceIds: input.body.serviceIds,
      staffId: input.body.staffId,
      start: input.body.start,
      agreedTotal: input.body.agreedTotal,
      contact: clientContactOf(input.body.contact, { demoNumbersAllowed: user.demoLaunch }),
      comment: input.body.comment,
      surface: MINI_APP.surface,
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

  @ContractRoute(cancelMiniAppBooking)
  cancel(
    @ContractInput() input: RouteInput<typeof cancelMiniAppBooking>,
    @TelegramClient() user: TelegramUser,
  ): Promise<ClientBooking> {
    return this.changes.cancel(
      identityOf(input.params.slug, user),
      input.params.bookingId,
      MINI_APP,
    );
  }

  @ContractRoute(getRescheduleOptions)
  rescheduleDays(
    @ContractInput() input: RouteInput<typeof getRescheduleOptions>,
    @TelegramClient() user: TelegramUser,
  ): Promise<RouteResult<typeof getRescheduleOptions>> {
    return this.rescheduleOptions.days(
      identityOf(input.params.slug, user),
      input.params.bookingId,
      {
        from: input.query.from,
        to: input.query.to,
      },
    );
  }

  @ContractRoute(rescheduleMiniAppBooking)
  reschedule(
    @ContractInput() input: RouteInput<typeof rescheduleMiniAppBooking>,
    @TelegramClient() user: TelegramUser,
  ): Promise<ClientBooking> {
    return this.changes.reschedule(
      identityOf(input.params.slug, user),
      input.params.bookingId,
      input.body.start,
      MINI_APP,
    );
  }

  @ContractRoute(confirmMiniAppAttendance)
  confirmAttendance(
    @ContractInput() input: RouteInput<typeof confirmMiniAppAttendance>,
    @TelegramClient() user: TelegramUser,
  ): Promise<ClientBooking> {
    return this.changes.confirmAttendance(
      identityOf(input.params.slug, user),
      input.params.bookingId,
      MINI_APP,
    );
  }

  @ContractRoute(startMiniAppPayment)
  async startPayment(
    @ContractInput() input: RouteInput<typeof startMiniAppPayment>,
    @TelegramClient() user: TelegramUser,
    @RequestLocale() locale: Locale,
  ): Promise<RouteResult<typeof startMiniAppPayment>> {
    const { checkout, booking } = await this.prepaid.startCheckout(
      identityOf(input.params.slug, user),
      input.params.bookingId,
      input.body.returnPath,
      locale,
    );
    return { checkoutUrl: checkout.url, checkoutPresentation: checkout.presentation, booking };
  }
}
