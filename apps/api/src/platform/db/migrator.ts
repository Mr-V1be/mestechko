import type { Kysely } from 'kysely';
import { Migrator, type MigrationResult } from 'kysely/migration';
import { migrations } from './migrations/index.js';

/** Migration bookkeeping lives outside `public`, where the application role has no access. */
export const MIGRATIONS_SCHEMA = 'migrations';

/**
 * Applies pending migrations one transaction each. PostgreSQL lets a new enum value be
 * used only after the transaction adding it commits, so a migration may build on the
 * values an earlier one added.
 */
export async function migrateToLatest(db: Kysely<unknown>): Promise<readonly MigrationResult[]> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
    migrationTableSchema: MIGRATIONS_SCHEMA,
  });
  const applied: MigrationResult[] = [];
  for (;;) {
    const { error, results = [] } = await migrator.migrateUp();
    if (error) {
      throw error instanceof Error ? error : new Error('Migration failed');
    }
    if (results.length === 0) {
      return applied;
    }
    applied.push(...results);
  }
}
