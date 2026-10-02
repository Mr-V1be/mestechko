import { Controller, Inject } from '@nestjs/common';
import {
  getCabinetBooking,
  getSchedule,
  listCabinetBookings,
  type RouteInput,
  type RouteResult,
} from '@mestechko/contracts';
import { CurrentBusinessAccess } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { BusinessAccess } from '../../../shared/application/business-access.js';
import { RequireAccess } from '../../tenancy/api/business-access.guard.js';
import { CabinetBookings } from '../application/cabinet/cabinet-bookings.js';
import { ScheduleView } from '../application/cabinet/schedule-view.js';

@Controller()
export class CabinetBookingsController {
  constructor(
    @Inject(ScheduleView) private readonly schedule: ScheduleView,
    @Inject(CabinetBookings) private readonly bookings: CabinetBookings,
  ) {}

  @ContractRoute(getSchedule)
  @RequireAccess('schedule')
  scheduleView(
    @ContractInput() input: RouteInput<typeof getSchedule>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof getSchedule>> {
    return this.schedule.execute(access, input.query);
  }

  @ContractRoute(listCabinetBookings)
  @RequireAccess('bookings')
  list(
    @ContractInput() input: RouteInput<typeof listCabinetBookings>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof listCabinetBookings>> {
    const query = input.query;
    return this.bookings.list(access, {
      from: query.from,
      to: query.to,
      status: query.status ?? null,
      staffId: query.staffId ?? null,
      locationId: query.locationId ?? null,
      search: query.search ?? null,
      cursor: query.cursor ?? null,
      limit: query.limit ?? null,
    });
  }

  @ContractRoute(getCabinetBooking)
  @RequireAccess('bookings')
  details(
    @ContractInput() input: RouteInput<typeof getCabinetBooking>,
    @CurrentBusinessAccess() access: BusinessAccess,
  ): Promise<RouteResult<typeof getCabinetBooking>> {
    return this.bookings.details(access, input.params.bookingId);
  }
}
