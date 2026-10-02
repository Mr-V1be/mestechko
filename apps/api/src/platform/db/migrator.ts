import type { Kysely } from 'kysely';
import { Migrator, type MigrationResult } from 'kysely/migration';
import { migrations } from './migrations/index.js';

/** Migration bookkeeping lives outside `public`, where the application role has no access. */
export const MIGRATIONS_SCHEMA = 'migrations';

export async function migrateToLatest(db: Kysely<unknown>): Promise<readonly MigrationResult[]> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: () => Promise.resolve(migrations) },
    migrationTableSchema: MIGRATIONS_SCHEMA,
  });
  const { error, results } = await migrator.migrateToLatest();
  if (error) {
    throw error instanceof Error ? error : new Error('Migration failed');
  }
  return results ?? [];
}
