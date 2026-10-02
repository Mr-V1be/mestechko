import { Controller, Inject } from '@nestjs/common';
import {
  cancelCabinetBooking,
  completeCabinetBooking,
  createCabinetBooking,
  getVisitSettlementOptions,
  markCabinetNoShow,
  moveCabinetBooking,
  type RouteInput,
  type RouteResult,
} from '@mestechko/contracts';
import { CurrentBusinessAccess, SessionUser } from '../../../platform/http/auth.guard.js';
import { ContractInput, ContractRoute } from '../../../platform/http/contract-route.js';
import type { BusinessAccess } from '../../../shared/application/business-access.js';
import { RequireAccess } from '../../tenancy/api/business-access.guard.js';
import {
  BusinessBookingChanges,
  type DeskActor,
} from '../application/cabinet/business-booking-changes.js';

const actorOf = (access: BusinessAccess, user: { userId: string }): DeskActor => ({
  access,
  userId: user.userId,
});

/** The front desk: booking, moving, cancelling and closing visits from the cabinet. */
@Controller()
export class CabinetDeskController {
  constructor(@Inject(BusinessBookingChanges) private readonly desk: BusinessBookingChanges) {}

  @ContractRoute(createCabinetBooking)
  @RequireAccess('bookings')
  create(
    @ContractInput() input: RouteInput<typeof createCabinetBooking>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @SessionUser() user: { userId: string },
  ): Promise<RouteResult<typeof createCabinetBooking>> {
    return this.desk.create(actorOf(access, user), {
      ...input.body,
      idempotencyKey: input.headers['idempotency-key'],
    });
  }

  @ContractRoute(moveCabinetBooking)
  @RequireAccess('bookings')
  move(
    @ContractInput() input: RouteInput<typeof moveCabinetBooking>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @SessionUser() user: { userId: string },
  ): Promise<RouteResult<typeof moveCabinetBooking>> {
    return this.desk.move(actorOf(access, user), input.params.bookingId, input.body);
  }

  @ContractRoute(cancelCabinetBooking)
  @RequireAccess('bookings')
  cancel(
    @ContractInput() input: RouteInput<typeof cancelCabinetBooking>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @SessionUser() user: { userId: string },
  ): Promise<RouteResult<typeof cancelCabinetBooking>> {
    return this.desk.cancel(
      actorOf(access, user),
      input.params.bookingId,
      input.body.expectedVersion,
    );
  }

  @ContractRoute(completeCabinetBooking)
  @RequireAccess('bookings')
  complete(
    @ContractInput() input: RouteInput<typeof completeCabinetBooking>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @SessionUser() user: { userId: string },
  ): Promise<RouteResult<typeof completeCabinetBooking>> {
    return this.desk.complete(actorOf(access, user), input.params.bookingId, input.body);
  }

  @ContractRoute(markCabinetNoShow)
  @RequireAccess('bookings')
  noShow(
    @ContractInput() input: RouteInput<typeof markCabinetNoShow>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @SessionUser() user: { userId: string },
  ): Promise<RouteResult<typeof markCabinetNoShow>> {
    return this.desk.markNoShow(
      actorOf(access, user),
      input.params.bookingId,
      input.body.expectedVersion,
    );
  }

  @ContractRoute(getVisitSettlementOptions)
  @RequireAccess('bookings')
  settlementOptions(
    @ContractInput() input: RouteInput<typeof getVisitSettlementOptions>,
    @CurrentBusinessAccess() access: BusinessAccess,
    @SessionUser() user: { userId: string },
  ): Promise<RouteResult<typeof getVisitSettlementOptions>> {
    return this.desk.settlementOptions(actorOf(access, user), input.params.bookingId);
  }
}
