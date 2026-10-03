import type { Migration } from 'kysely/migration';
import { foundationMigration } from './0001-foundation.js';
import { clientLifecycleMigration } from './0002-client-lifecycle-and-notifications.js';
import { maxEmulatorMigration } from './0003-max-emulator.js';
import { bookingStatesMigration } from './0004-booking-states.js';
import { businessOperationsMigration } from './0005-business-operations.js';
import { notificationClientKnowsMigration } from './0006-notification-client-knows.js';

/** Ordered, immutable list of schema migrations. */
export const migrations: Readonly<Record<string, Migration>> = {
  '0001-foundation': foundationMigration,
  '0002-client-lifecycle-and-notifications': clientLifecycleMigration,
  '0003-max-emulator': maxEmulatorMigration,
  '0004-booking-states': bookingStatesMigration,
  '0005-business-operations': businessOperationsMigration,
  '0006-notification-client-knows': notificationClientKnowsMigration,
};
