import { Controller, Inject } from '@nestjs/common';
import {
  getAvailability,
  listPublicServices,
  listPublicStaff,
  type RouteInput,
  type RouteResult,
} from '@mestechko/contracts';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import { BookingOptions } from '../application/availability/booking-options.js';

@Controller()
export class BookingOptionsController {
  constructor(@Inject(BookingOptions) private readonly options: BookingOptions) {}

  @ContractRoute(listPublicServices)
  async services(
    @ContractInput() input: RouteInput<typeof listPublicServices>,
  ): Promise<RouteResult<typeof listPublicServices>> {
    return { categories: await this.options.services(input.params.slug, input.query.locationId) };
  }

  @ContractRoute(listPublicStaff)
  staff(
    @ContractInput() input: RouteInput<typeof listPublicStaff>,
  ): Promise<RouteResult<typeof listPublicStaff>> {
    return this.options.staff(input.params.slug, input.query.locationId, input.query.serviceIds);
  }

  @ContractRoute(getAvailability)
  availability(
    @ContractInput() input: RouteInput<typeof getAvailability>,
  ): Promise<RouteResult<typeof getAvailability>> {
    return this.options.availability(input.params.slug, {
      locationId: input.query.locationId,
      serviceIds: input.query.serviceIds,
      staffId: input.query.staffId ?? null,
      from: input.query.from,
      to: input.query.to,
    });
  }
}
