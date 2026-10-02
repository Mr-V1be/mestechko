import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TenantContextMissingError } from '../../src/platform/db/kysely-unit-of-work.js';
import { ScryptPasswordHasher } from '../../src/modules/identity/infrastructure/crypto-adapters.js';
import { UuidV7Generator } from '../../src/platform/system-clock.js';
import { createTestApp } from './support/test-app.js';
import { createTenant, type TenantFixture } from './support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from './support/test-database.js';

const ids = new UuidV7Generator();
const PASSWORD = 'correct horse battery staple';

describe('tenant isolation', () => {
  let databases: TestDatabases;
  let app: NestFastifyApplication;
  let alpha: TenantFixture;
  let beta: TenantFixture;

  beforeAll(async () => {
    databases = openTestDatabases();
    app = await createTestApp();
    alpha = await createTenant(databases.admin);
    beta = await createTenant(databases.admin);
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('guards every table of a business with forced row-level security', async () => {
    // Platform tables serve every business by design: how members, the bot's outbox
    // and the payment provider find their business.
    const platformTables = ['memberships', 'notifications', 'payment_webhook_events'];
    const unguarded = await sql<{ table: string }>`
      select c.relname as table
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'business_id' and not a.attisdropped
      where n.nspname = 'public' and c.relkind = 'r'
        and not (c.relrowsecurity and c.relforcerowsecurity
                 and exists (select 1 from pg_policy p where p.polrelid = c.oid))
      order by c.relname
    `.execute(databases.admin);
    expect(unguarded.rows.map((row) => row.table)).toEqual(platformTables);
  });

  it('shows a tenant transaction only its own rows', async () => {
    const visible = await databases.unitOfWork.inTenant(alpha.businessId, () =>
      databases.unitOfWork.tenant().selectFrom('staffMembers').select('businessId').execute(),
    );
    expect(visible.length).toBeGreaterThan(0);
    expect(new Set(visible.map((row) => row.businessId))).toEqual(new Set([alpha.businessId]));
  });

  it('rejects writing another tenant’s rows from inside a tenant transaction', async () => {
    const write = databases.unitOfWork.inTenant(alpha.businessId, () =>
      databases.unitOfWork
        .tenant()
        .insertInto('serviceCategories')
        .values({
          id: ids.next(),
          businessId: beta.businessId,
          name: 'Intruder',
          sortOrder: 9,
          createdAt: new Date(),
        })
        .execute(),
    );
    await expect(write).rejects.toMatchObject({ code: '42501' });
  });

  it('fails closed when the application role reads without a tenant', async () => {
    const rows = await databases.app.selectFrom('locations').selectAll().execute();
    expect(rows).toEqual([]);
    expect(() => databases.unitOfWork.tenant()).toThrow(TenantContextMissingError);
  });

  it('cannot reference another tenant’s records even with a known id', async () => {
    const insert = databases.admin.transaction().execute(async (tx) => {
      await sql`select set_config('app.business_id', ${alpha.businessId}, true)`.execute(tx);
      await tx
        .insertInto('resources')
        .values({
          id: ids.next(),
          businessId: alpha.businessId,
          locationId: beta.locationId,
          typeId: 'hair_chair',
          name: 'X',
          sortOrder: 0,
          createdAt: new Date(),
        })
        .execute();
    });
    await expect(insert).rejects.toMatchObject({ code: '23503' });
  });

  it('forbids a cabinet user from opening another business', async () => {
    const userId = ids.next();
    const email = `owner-${userId.slice(-8)}@example.test`;
    await databases.admin
      .insertInto('users')
      .values({
        id: userId,
        email,
        displayName: 'Owner',
        passwordHash: await new ScryptPasswordHasher().hash(PASSWORD),
        createdAt: new Date(),
      })
      .execute();
    await databases.admin
      .insertInto('memberships')
      .values({
        businessId: alpha.businessId,
        userId,
        role: 'owner',
        staffId: null,
        createdAt: new Date(),
      })
      .execute();
    const signIn = await app.inject({
      method: 'POST',
      url: '/v1/auth/sessions',
      payload: { email, password: PASSWORD },
    });
    expect(signIn.statusCode).toBe(200);
    const cookie = signIn.cookies.find((entry) => entry.name === 'mst_session');
    const headers = { cookie: `mst_session=${cookie?.value ?? ''}` };
    const today = new Date().toISOString().slice(0, 10);
    const own = await app.inject({
      method: 'GET',
      url: `/v1/cabinet/businesses/${alpha.businessId}/bookings?from=${today}&to=${today}`,
      headers,
    });
    const foreign = await app.inject({
      method: 'GET',
      url: `/v1/cabinet/businesses/${beta.businessId}/bookings?from=${today}&to=${today}`,
      headers,
    });
    expect(own.statusCode).toBe(200);
    expect(foreign.statusCode).toBe(403);
    expect(foreign.json<{ error: { code: string } }>().error.code).toBe('forbidden');
  });
});
