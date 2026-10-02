import type { Kysely } from 'kysely';
import { inject } from 'vitest';
import { createDatabase, type Database } from '../../../src/platform/db/database.js';
import { KyselyUnitOfWork } from '../../../src/platform/db/kysely-unit-of-work.js';

export interface TestDatabases {
  /** Superuser connection: bypasses row-level security, used to arrange data. */
  readonly admin: Kysely<Database>;
  /** Restricted application role, exactly as the API connects. */
  readonly app: Kysely<Database>;
  readonly unitOfWork: KyselyUnitOfWork;
  destroy(): Promise<void>;
}

export function openTestDatabases(): TestDatabases {
  const admin = createDatabase({
    url: inject('testAdminUrl'),
    poolMax: 4,
    applicationName: 'mestechko-test-admin',
  });
  const app = createDatabase({
    url: inject('testAppUrl'),
    poolMax: 10,
    applicationName: 'mestechko-test-app',
  });
  return {
    admin,
    app,
    unitOfWork: new KyselyUnitOfWork(app),
    async destroy() {
      await Promise.all([admin.destroy(), app.destroy()]);
    },
  };
}
