import { sql } from 'kysely';
import { ApplicationError } from '../../../shared/application/application-error.js';
import { currencyCode } from '../../../platform/db/column-parsers.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import { isExclusionViolation } from '../../../platform/db/pg-errors.js';
import type {
  BookingLifecycleStore,
  BookingMove,
  LockedBooking,
  NewBookingEvent,
} from '../application/lifecycle/ports.js';
import { SlotConflictError } from '../application/ports.js';

export class KyselyBookingLifecycleStore implements BookingLifecycleStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async lock(bookingId: string): Promise<LockedBooking | null> {
    const db = this.unitOfWork.tenant();
    const row = await db
      .selectFrom('bookings as b')
      .innerJoin('clients as c', 'c.id', 'b.clientId')
      .innerJoin('locations as l', 'l.id', 'b.locationId')
      .select([
        'b.id',
        'b.clientId',
        'c.customerId',
        'b.locationId',
        'l.timeZone',
        'b.staffId',
        'b.status',
        'b.source',
        'b.version',
        'b.startsAt',
        'b.endsAt',
        'b.attendanceConfirmedAt',
        'b.totalPriceMinor',
        'b.currency',
      ])
      .where('b.id', '=', bookingId)
      .forUpdate('b')
      .executeTakeFirst();
    if (!row) {
      return null;
    }
    const items = await db
      .selectFrom('bookingItems')
      .select('serviceId')
      .where('bookingId', '=', bookingId)
      .orderBy('position')
      .execute();
    return {
      ...row,
      currency: currencyCode(row.currency),
      serviceIds: items.map((item) => item.serviceId),
    };
  }

  async cancel(booking: LockedBooking, at: Date): Promise<void> {
    const result = await this.unitOfWork
      .tenant()
      .updateTable('bookings')
      .set({ status: 'cancelled', cancelledAt: at, version: booking.version + 1, updatedAt: at })
      .where('id', '=', booking.id)
      .where('version', '=', booking.version)
      .executeTakeFirst();
    assertUpdated(result.numUpdatedRows);
  }

  async move(booking: LockedBooking, move: BookingMove, at: Date): Promise<void> {
    const db = this.unitOfWork.tenant();
    const businessId = this.unitOfWork.currentBusinessId();
    // The old items leave first, so the booking never conflicts with itself; a taken
    // time rolls back to the savepoint and the caller may try another plan.
    await sql`savepoint booking_move`.execute(db);
    try {
      await db.deleteFrom('bookingItems').where('bookingId', '=', booking.id).execute();
      const result = await db
        .updateTable('bookings')
        .set({
          startsAt: move.startsAt,
          endsAt: move.endsAt,
          totalPriceMinor: move.totalPriceMinor,
          attendanceConfirmedAt: null,
          version: booking.version + 1,
          updatedAt: at,
        })
        .where('id', '=', booking.id)
        .where('version', '=', booking.version)
        .executeTakeFirst();
      assertUpdated(result.numUpdatedRows);
      await db
        .insertInto('bookingItems')
        .values(
          move.items.map((item) => ({
            id: item.id,
            businessId,
            bookingId: booking.id,
            status: booking.status,
            staffId: booking.staffId,
            position: item.position,
            serviceId: item.serviceId,
            resourceId: item.resourceId,
            serviceName: item.serviceName,
            durationMinutes: item.durationMinutes,
            priceMinor: item.priceMinor,
            startsAt: item.startsAt,
            endsAt: item.endsAt,
            occupied: sql<string>`tstzrange(${item.occupied.start}, ${item.occupied.end}, '[)')`,
          })),
        )
        .execute();
      await sql`release savepoint booking_move`.execute(db);
    } catch (error) {
      await sql`rollback to savepoint booking_move`.execute(db);
      if (isExclusionViolation(error)) {
        throw new SlotConflictError();
      }
      throw error;
    }
  }

  async confirmAttendance(booking: LockedBooking, at: Date): Promise<void> {
    const result = await this.unitOfWork
      .tenant()
      .updateTable('bookings')
      .set({ attendanceConfirmedAt: at, updatedAt: at })
      .where('id', '=', booking.id)
      .where('version', '=', booking.version)
      .executeTakeFirst();
    assertUpdated(result.numUpdatedRows);
  }

  async recordEvent(event: NewBookingEvent): Promise<void> {
    await this.unitOfWork
      .tenant()
      .insertInto('bookingEvents')
      .values({ ...event, businessId: this.unitOfWork.currentBusinessId() })
      .execute();
  }
}

/** The row is locked, so a version mismatch means it changed earlier in this transaction. */
function assertUpdated(rows: bigint): void {
  if (rows !== 1n) {
    throw new ApplicationError('booking_changed', 'The booking changed meanwhile');
  }
}
