import { sql, type Kysely } from 'kysely';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createDatabase } from '../../../src/platform/db/database.js';
import {
  provisionApplicationRole,
  UnsafeApplicationRoleError,
} from '../../../src/platform/db/provisioning.js';

/**
 * A PostgreSQL shared with other products gives the product an owner that is not a
 * superuser: CREATEROLE to create the application role, BYPASSRLS for migrations and the
 * demo reset. Provisioning runs on every rollout, so it must succeed again and again there.
 */
const DATABASE = 'slotwise_test_shared';
const OWNER = { role: 'slotwise_test_shared_owner', password: 'test-shared-owner-password' };
const APPLICATION_ROLE = 'slotwise_test_shared_app';
const SUPERUSER_ROLE = 'slotwise_test_superuser_app';

function connectionUrl(role: string, password: string): string {
  const url = new URL(inject('testAdminUrl'));
  url.username = role;
  url.password = password;
  url.pathname = `/${DATABASE}`;
  return url.toString();
}

function connect(url: string): Kysely<unknown> {
  return createDatabase<unknown>({ url, poolMax: 1, applicationName: 'slotwise-test' });
}

async function asServerAdmin(work: (server: Kysely<unknown>) => Promise<void>): Promise<void> {
  const server = connect(inject('testAdminUrl'));
  try {
    await work(server);
  } finally {
    await server.destroy();
  }
}

async function dropFixtures(server: Kysely<unknown>): Promise<void> {
  await sql`drop database if exists ${sql.id(DATABASE)} with (force)`.execute(server);
  for (const role of [APPLICATION_ROLE, SUPERUSER_ROLE, OWNER.role]) {
    await sql`drop role if exists ${sql.id(role)}`.execute(server);
  }
}

describe('application role provisioning', () => {
  beforeAll(async () => {
    await asServerAdmin(async (server) => {
      await dropFixtures(server);
      await sql`create role ${sql.id(OWNER.role)} with login createrole bypassrls password ${sql.lit(OWNER.password)}`.execute(
        server,
      );
      await sql`create database ${sql.id(DATABASE)} owner ${sql.id(OWNER.role)}`.execute(server);
    });
  });

  afterAll(async () => {
    await asServerAdmin(dropFixtures);
  });

  it('runs again and again under an owner that is not a superuser', async () => {
    const owner = connect(connectionUrl(OWNER.role, OWNER.password));
    try {
      await provisionApplicationRole(owner, connectionUrl(APPLICATION_ROLE, 'first-password'));
      await provisionApplicationRole(owner, connectionUrl(APPLICATION_ROLE, 'second-password'));

      const attributes = await sql<{ superuser: boolean; bypassRls: boolean; login: boolean }>`
        select rolsuper as superuser, rolbypassrls as bypass_rls, rolcanlogin as login
        from pg_roles where rolname = ${APPLICATION_ROLE}
      `.execute(owner);
      expect(attributes.rows).toEqual([{ superuser: false, bypassRls: false, login: true }]);
    } finally {
      await owner.destroy();
    }

    const application = connect(connectionUrl(APPLICATION_ROLE, 'second-password'));
    try {
      const current = await sql<{ role: string }>`select current_user as role`.execute(application);
      expect(current.rows).toEqual([{ role: APPLICATION_ROLE }]);
    } finally {
      await application.destroy();
    }
  });

  it('refuses an application role that is a superuser', async () => {
    await asServerAdmin(async (server) => {
      await sql`create role ${sql.id(SUPERUSER_ROLE)} with login superuser`.execute(server);
      await expect(
        provisionApplicationRole(server, connectionUrl(SUPERUSER_ROLE, 'any-password')),
      ).rejects.toBeInstanceOf(UnsafeApplicationRoleError);
    });
  });
});
