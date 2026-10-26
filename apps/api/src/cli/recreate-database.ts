/**
 * Drops and recreates a scratch database on the same server, e.g. the one the
 * screenshot pipeline seeds from scratch. The working database is never touched.
 *
 *   node … recreate-database.ts --database slotwise_screenshots
 */
import { sql } from 'kysely';
import { parseArgs } from 'node:util';
import { createDatabase } from '../platform/db/database.js';
import { SYSTEM_NAME, systemNameOf } from '../platform/system-name.js';
import { adminEnvironmentFrom } from './admin-database.js';

const SCRATCH_NAME = new RegExp(`^${SYSTEM_NAME}_[a-z0-9_]+$`);

const { values } = parseArgs({ options: { database: { type: 'string' } } });
const environment = adminEnvironmentFrom();
const working = new URL(environment.DATABASE_ADMIN_URL).pathname.replace(/^\//, '');
const target = values.database ?? '';
if (!SCRATCH_NAME.test(target) || target === working) {
  console.error(`Refusing to recreate "${target}": pass a scratch database other than ${working}.`);
  process.exit(1);
}
const server = new URL(environment.DATABASE_ADMIN_URL);
server.pathname = '/postgres';
const db = createDatabase<unknown>({
  url: server.toString(),
  poolMax: 1,
  applicationName: systemNameOf('cli'),
});
try {
  await sql`drop database if exists ${sql.id(target)} with (force)`.execute(db);
  await sql`create database ${sql.id(target)}`.execute(db);
  console.log(`Database ${target} is empty and ready.`);
} finally {
  await db.destroy();
}
