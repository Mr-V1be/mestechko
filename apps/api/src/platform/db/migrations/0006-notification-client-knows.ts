import { sql, type Kysely } from 'kysely';

/**
 * What the client was last told about a visit, kept on its pending notices. A change
 * taken back before its notice went out (the desk's «Вернуть») then leaves the client
 * with nothing to hear: the visit is again what they know.
 */
const up = sql.raw(`
ALTER TABLE notifications
  ADD COLUMN client_knows_starts_at timestamptz,
  ADD COLUMN client_knows_staff_id uuid,
  ADD CONSTRAINT notifications_client_knows_check
    CHECK ((client_knows_starts_at IS NULL) = (client_knows_staff_id IS NULL));
`);

const down = sql.raw(`
ALTER TABLE notifications
  DROP CONSTRAINT notifications_client_knows_check,
  DROP COLUMN client_knows_staff_id,
  DROP COLUMN client_knows_starts_at;
`);

export const notificationClientKnowsMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await up.execute(db);
  },
  async down(db: Kysely<unknown>): Promise<void> {
    await down.execute(db);
  },
};
