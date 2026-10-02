import { migrateToLatest } from '../platform/db/migrator.js';
import { adminEnvironmentFrom, createAdminDatabase } from './admin-database.js';

const environment = adminEnvironmentFrom();
const admin = createAdminDatabase(environment.DATABASE_ADMIN_URL);
try {
  const results = await migrateToLatest(admin);
  for (const result of results) {
    console.log(`${result.status}: ${result.migrationName}`);
  }
  console.log(results.length === 0 ? 'Schema is up to date.' : 'Migrations applied.');
} finally {
  await admin.destroy();
}
