import { provisionApplicationRole } from '../platform/db/provisioning.js';
import { adminEnvironmentFrom, createAdminDatabase } from './admin-database.js';

const environment = adminEnvironmentFrom();
const admin = createAdminDatabase(environment.DATABASE_ADMIN_URL);
try {
  await provisionApplicationRole(admin, environment.DATABASE_URL);
  console.log('Application database role is provisioned.');
} finally {
  await admin.destroy();
}
