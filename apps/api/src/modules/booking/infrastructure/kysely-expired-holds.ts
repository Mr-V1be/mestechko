import { sql } from 'kysely';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type { ExpiredHolds } from '../application/ports.js';

/** Reads expired holds of every business through a narrow security-definer function. */
export class KyselyExpiredHolds implements ExpiredHolds {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async list(now: Date, limit: number): Promise<{ businessId: string; bookingId: string }[]> {
    const result = await sql<{ businessId: string; bookingId: string }>`
      select business_id as "businessId", booking_id as "bookingId"
      from expired_booking_holds(${now}, ${limit})
    `.execute(this.unitOfWork.platform());
    return result.rows;
  }
}
