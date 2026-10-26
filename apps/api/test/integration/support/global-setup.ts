import { sql } from 'kysely';
import type { TestProject } from 'vitest/node';
import { createDatabase } from '../../../src/platform/db/database.js';
import { migrateToLatest } from '../../../src/platform/db/migrator.js';
import { provisionApplicationRole } from '../../../src/platform/db/provisioning.js';

const TEST_DATABASE = 'slotwise_test';

declare module 'vitest' {
  export interface ProvidedContext {
    testAdminUrl: string;
    testAppUrl: string;
  }
}

function withDatabase(url: string, database: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${database}`;
  return parsed.toString();
}

/** Recreates an isolated database, provisions the restricted role and migrates it. */
export default async function setup(project: TestProject): Promise<void> {
  const adminUrl = process.env.DATABASE_ADMIN_URL;
  const appUrl = process.env.DATABASE_URL;
  if (!adminUrl || !appUrl) {
    throw new Error('DATABASE_ADMIN_URL and DATABASE_URL are required for integration tests');
  }
  const server = createDatabase({
    url: adminUrl,
    poolMax: 1,
    applicationName: 'slotwise-test-setup',
  });
  await sql`drop database if exists ${sql.id(TEST_DATABASE)} with (force)`.execute(server);
  await sql`create database ${sql.id(TEST_DATABASE)}`.execute(server);
  await server.destroy();

  const testAdminUrl = withDatabase(adminUrl, TEST_DATABASE);
  const testAppUrl = withDatabase(appUrl, TEST_DATABASE);
  const admin = createDatabase<unknown>({
    url: testAdminUrl,
    poolMax: 2,
    applicationName: 'slotwise-test-setup',
  });
  await provisionApplicationRole(admin, testAppUrl);
  await migrateToLatest(admin);
  await admin.destroy();

  project.provide('testAdminUrl', testAdminUrl);
  project.provide('testAppUrl', testAppUrl);
}
