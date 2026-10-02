import type { Migration } from 'kysely/migration';
import { foundationMigration } from './0001-foundation.js';
import { clientLifecycleMigration } from './0002-client-lifecycle-and-notifications.js';
import { maxEmulatorMigration } from './0003-max-emulator.js';

/** Ordered, immutable list of schema migrations. */
export const migrations: Readonly<Record<string, Migration>> = {
  '0001-foundation': foundationMigration,
  '0002-client-lifecycle-and-notifications': clientLifecycleMigration,
  '0003-max-emulator': maxEmulatorMigration,
};
