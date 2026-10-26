import { openBookingStatuses } from '@slotwise/domain';
import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type { StaffVisits, StaffVisitView } from '../application/ports.js';

export class KyselyStaffVisits implements StaffVisits {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async upcoming(staffId: string, from: Date): Promise<StaffVisitView[]> {
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('bookings as b')
      .innerJoin('clients as c', 'c.id', 'b.clientId')
      .innerJoin('locations as l', 'l.id', 'b.locationId')
      .select([
        'b.id as bookingId',
        'b.status',
        'b.locationId',
        'l.timeZone',
        'b.startsAt',
        'b.endsAt',
        'c.displayName as clientName',
      ])
      .select((eb) => [
        eb
          .selectFrom('bookingItems as i')
          .select(sql<Date>`min(lower(i.occupied))`.as('start'))
          .whereRef('i.bookingId', '=', 'b.id')
          .as('occupiedStart'),
        eb
          .selectFrom('bookingItems as i')
          .select(sql<Date>`max(upper(i.occupied))`.as('end'))
          .whereRef('i.bookingId', '=', 'b.id')
          .as('occupiedEnd'),
        jsonArrayFrom(
          eb
            .selectFrom('bookingItems as i')
            .select('i.serviceName as name')
            .whereRef('i.bookingId', '=', 'b.id')
            .orderBy('i.position'),
        ).as('services'),
      ])
      .where('b.staffId', '=', staffId)
      .where('b.status', 'in', openBookingStatuses)
      .where('b.endsAt', '>', from)
      .orderBy('b.startsAt')
      .execute();
    return rows.map(({ occupiedStart, occupiedEnd, services, ...row }) => ({
      ...row,
      occupied: {
        start: (occupiedStart ?? row.startsAt).getTime(),
        end: (occupiedEnd ?? row.endsAt).getTime(),
      },
      serviceNames: services.map((service) => service.name),
    }));
  }

  async countUpcoming(from: Date): Promise<Map<string, number>> {
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('bookings')
      .select((eb) => ['staffId', eb.fn.countAll<string>().as('visits')])
      .where('status', 'in', openBookingStatuses)
      .where('endsAt', '>', from)
      .groupBy('staffId')
      .execute();
    return new Map(rows.map((row) => [row.staffId, Number(row.visits)]));
  }
}
