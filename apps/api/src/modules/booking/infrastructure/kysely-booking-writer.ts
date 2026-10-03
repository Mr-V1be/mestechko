import { sql } from 'kysely';
import { isTimeConflict, isUniqueViolation } from '../../../platform/db/pg-errors.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import {
  DuplicateRequestError,
  SlotConflictError,
  type BookingWriter,
  type NewBooking,
} from '../application/ports.js';

const IDEMPOTENCY_CONSTRAINT = 'bookings_idempotency_key';

/**
 * Inserts a booking under a savepoint: a rejected attempt rolls back only itself, so
 * the surrounding transaction can try the next staff member.
 */
export class KyselyBookingWriter implements BookingWriter {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async insert(booking: NewBooking): Promise<void> {
    const db = this.unitOfWork.tenant();
    const businessId = this.unitOfWork.currentBusinessId();
    await sql`savepoint booking_attempt`.execute(db);
    try {
      await db
        .insertInto('bookings')
        .values({
          id: booking.id,
          businessId,
          locationId: booking.locationId,
          clientId: booking.clientId,
          staffId: booking.staffId,
          status: booking.status,
          holdReason: booking.hold?.reason ?? null,
          holdExpiresAt: booking.hold?.expiresAt ?? null,
          depositMinor: booking.depositMinor,
          source: booking.source,
          startsAt: booking.startsAt,
          endsAt: booking.endsAt,
          totalPriceMinor: booking.totalPriceMinor,
          currency: booking.currency,
          clientComment: booking.comment,
          idempotencyKey: booking.idempotencyKey,
          version: 1,
          cancelledAt: null,
          createdAt: booking.createdAt,
          updatedAt: booking.createdAt,
        })
        .execute();
      await db
        .insertInto('bookingItems')
        .values(
          booking.items.map((item) => ({
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
      await sql`release savepoint booking_attempt`.execute(db);
    } catch (error) {
      await sql`rollback to savepoint booking_attempt`.execute(db);
      if (isTimeConflict(error)) {
        throw new SlotConflictError();
      }
      if (isUniqueViolation(error, IDEMPOTENCY_CONSTRAINT)) {
        throw new DuplicateRequestError();
      }
      throw error;
    }
  }
}
