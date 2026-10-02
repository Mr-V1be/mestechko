import { sql, type Kysely } from 'kysely';

/**
 * New values of existing enums: held bookings and the events of a visit's outcome.
 * They are added in a migration of their own because PostgreSQL allows using a new
 * enum value only after the transaction that added it has committed.
 *
 * Enum values cannot be dropped in place; rolling back leaves them unused, and the
 * earlier migrations' rollbacks drop the types themselves.
 */
const up = sql.raw(`
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'held' BEFORE 'confirmed';
ALTER TYPE booking_event_kind ADD VALUE IF NOT EXISTS 'confirmed';
ALTER TYPE booking_event_kind ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE booking_event_kind ADD VALUE IF NOT EXISTS 'no_show';
`);

export const bookingStatesMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await up.execute(db);
  },
  async down(): Promise<void> {
    // Nothing to undo: see above.
  },
};
