import { sql } from 'kysely';
import { Migrator } from 'kysely/migration';
import { inject, describe, expect, it } from 'vitest';
import { createDatabase } from '../../../src/platform/db/database.js';
import { migrateToLatest, MIGRATIONS_SCHEMA } from '../../../src/platform/db/migrator.js';
import { migrations } from '../../../src/platform/db/migrations/index.js';

const SCRATCH_DATABASE = 'mestechko_test_migrations';

describe('migrations', () => {
  it('apply from scratch, roll back completely and apply again', async () => {
    const serverUrl = new URL(inject('testAdminUrl'));
    const server = createDatabase({
      url: serverUrl.toString(),
      poolMax: 1,
      applicationName: 'mestechko-test',
    });
    await sql`drop database if exists ${sql.id(SCRATCH_DATABASE)} with (force)`.execute(server);
    await sql`create database ${sql.id(SCRATCH_DATABASE)}`.execute(server);
    await server.destroy();

    serverUrl.pathname = `/${SCRATCH_DATABASE}`;
    const db = createDatabase<unknown>({
      url: serverUrl.toString(),
      poolMax: 1,
      applicationName: 'mestechko-test',
    });
    try {
      const tables = async () =>
        (
          await sql<{
            count: string;
          }>`select count(*) from information_schema.tables where table_schema = 'public'`.execute(
            db,
          )
        ).rows[0]?.count;
      await migrateToLatest(db);
      expect(Number(await tables())).toBeGreaterThan(10);

      const migrator = new Migrator({
        db,
        provider: { getMigrations: () => Promise.resolve(migrations) },
        migrationTableSchema: MIGRATIONS_SCHEMA,
      });
      for (const _migration of Object.keys(migrations)) {
        const { error } = await migrator.migrateDown();
        expect(error).toBeUndefined();
      }
      expect(Number(await tables())).toBe(0);

      await migrateToLatest(db);
      expect(Number(await tables())).toBeGreaterThan(10);
    } finally {
      await db.destroy();
    }
  });
});
