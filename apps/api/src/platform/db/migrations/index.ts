import type { Migration } from 'kysely/migration';
import { foundationMigration } from './0001-foundation.js';

/** Ordered, immutable list of schema migrations. */
export const migrations: Readonly<Record<string, Migration>> = {
  '0001-foundation': foundationMigration,
};
