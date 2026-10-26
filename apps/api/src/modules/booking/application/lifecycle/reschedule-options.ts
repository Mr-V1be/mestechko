import type { AvailableDay } from '@slotwise/contracts';
import { Temporal, type Clock } from '@slotwise/domain';
import { notFound } from '../../../../shared/application/application-error.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type { ClientDirectory, CustomerIdentities } from '../../../clients/application/ports.js';
import type { BusinessContextResolver } from '../../../tenancy/application/business-context.js';
import type { AvailabilityAssembler } from '../availability/availability-assembler.js';
import { availableDaysOf } from '../availability/booking-options.js';
import type { ClientIdentity } from '../client/client-bookings.js';
import type { ClientBookingQueries } from '../ports.js';

/** Where a client's booking can move: the same services and staff member, other times. */
export class RescheduleOptions {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly customers: CustomerIdentities,
    private readonly clients: ClientDirectory,
    private readonly queries: ClientBookingQueries,
    private readonly assembler: AvailabilityAssembler,
    private readonly clock: Clock,
  ) {}

  async days(
    identity: ClientIdentity,
    bookingId: string,
    range: { readonly from: string; readonly to: string },
  ): Promise<{ timeZone: string; days: AvailableDay[] }> {
    const context = await this.businesses.resolve(identity.business);
    const customerId = await this.customers.find(identity.channel, identity.externalUserId);
    return this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const client = customerId ? await this.clients.findByCustomer(customerId) : null;
        const booking = client ? await this.queries.get(client.id, bookingId) : null;
        if (!booking) {
          throw notFound('Booking');
        }
        const assembled = await this.assembler.assemble({
          context,
          locationId: booking.location.id,
          serviceIds: booking.services.map((service) => service.id),
          staffId: booking.staff.id,
          from: Temporal.PlainDate.from(range.from),
          to: Temporal.PlainDate.from(range.to),
          now: this.clock.now(),
          excludeBookingId: booking.id,
        });
        return availableDaysOf(assembled);
      },
      { readOnly: true },
    );
  }
}
