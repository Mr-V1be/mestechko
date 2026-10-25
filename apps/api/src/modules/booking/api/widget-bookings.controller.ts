import { Controller, Inject, Req } from '@nestjs/common';
import {
  createWidgetBooking,
  getWidgetBooking,
  type RouteInput,
  type RouteResult,
} from '@mestechko/contracts';
import type { Locale } from '@mestechko/domain';
import type { FastifyRequest } from 'fastify';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import { RequestLocale } from '../../../platform/http/request-locale.js';
import { WebsiteBookings } from '../application/client/website-bookings.js';

/** Bookings from the widget on the business's website: no account, limited per visitor. */
@Controller()
export class WidgetBookingsController {
  constructor(@Inject(WebsiteBookings) private readonly bookings: WebsiteBookings) {}

  @ContractRoute(createWidgetBooking)
  create(
    @ContractInput() input: RouteInput<typeof createWidgetBooking>,
    @Req() request: FastifyRequest,
    @RequestLocale() locale: Locale,
  ): Promise<RouteResult<typeof createWidgetBooking>> {
    return this.bookings.create({
      slug: input.params.slug,
      visitorAddress: request.ip,
      idempotencyKey: input.headers['idempotency-key'],
      locationId: input.body.locationId,
      serviceIds: input.body.serviceIds,
      staffId: input.body.staffId,
      start: input.body.start,
      agreedTotal: input.body.agreedTotal,
      contact: input.body.contact,
      comment: input.body.comment,
      returnPath: input.body.returnPath,
      locale,
    });
  }

  @ContractRoute(getWidgetBooking)
  get(
    @ContractInput() input: RouteInput<typeof getWidgetBooking>,
  ): Promise<RouteResult<typeof getWidgetBooking>> {
    return this.bookings.get(
      input.params.slug,
      input.params.bookingId,
      input.headers['x-booking-token'],
    );
  }
}
