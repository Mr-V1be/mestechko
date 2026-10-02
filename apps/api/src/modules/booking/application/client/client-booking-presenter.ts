import type { ClientBooking } from '@mestechko/contracts';
import type { Clock } from '@mestechko/domain';
import { notFound } from '../../../../shared/application/application-error.js';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { Prepayments } from '../../../payments/application/prepayments.js';
import type { BusinessContext } from '../../../tenancy/application/business-context.js';
import type { ClientBookingQueries, ClientBookingView } from '../ports.js';
import { toClientBooking } from './client-booking-view.js';

/** Turns a client's bookings into what client surfaces show, payments included. */
export class ClientBookingPresenter {
  constructor(
    private readonly queries: ClientBookingQueries,
    private readonly prepayments: Prepayments,
    private readonly avatars: AvatarUrls,
    private readonly clock: Clock,
  ) {}

  /** One booking of the client; must run inside the business's tenant unit of work. */
  async present(
    context: BusinessContext,
    clientId: string,
    bookingId: string,
  ): Promise<ClientBooking> {
    const view = await this.queries.get(clientId, bookingId);
    if (!view) {
      throw notFound('Booking');
    }
    return (await this.presentMany(context, [view]))[0] ?? this.fail(bookingId);
  }

  async presentMany(
    context: BusinessContext,
    views: readonly ClientBookingView[],
  ): Promise<ClientBooking[]> {
    const payments = await this.prepayments.ofBookings(views.map((view) => view.id));
    const now = this.clock.now().epochMilliseconds;
    return views.map((view) =>
      toClientBooking(
        view,
        payments.get(view.id) ?? null,
        this.avatars,
        context.rules.clientChanges,
        now,
      ),
    );
  }

  private fail(bookingId: string): never {
    throw new Error(`Booking ${bookingId} was not presented`);
  }
}
