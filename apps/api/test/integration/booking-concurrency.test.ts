import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './support/test-app.js';
import { createTenant, type TenantFixture } from './support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from './support/test-database.js';

const DEMO_USER_BASE = 9_100_000_000_000;

async function launchAs(
  app: NestFastifyApplication,
  slug: string,
  userId: number,
): Promise<string> {
  const response = await app.inject({
    method: 'POST',
    url: '/v1/demo/telegram-launch',
    payload: { businessSlug: slug, demoUserId: String(userId) },
  });
  return response.json<{ initData: string }>().initData;
}

/** First offered start tomorrow for the fixture's service. */
async function firstSlotTomorrow(
  app: NestFastifyApplication,
  tenant: TenantFixture,
): Promise<string> {
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const response = await app.inject({
    method: 'GET',
    url: `/v1/public/businesses/${tenant.slug}/availability?locationId=${tenant.locationId}&serviceIds=${tenant.serviceId}&from=${tomorrow}&to=${tomorrow}`,
  });
  const start = response.json<{ days: { slots: { start: string }[] }[] }>().days[0]?.slots[0]
    ?.start;
  if (!start) {
    throw new Error('Fixture has no free slot tomorrow');
  }
  return start;
}

function book(
  app: NestFastifyApplication,
  tenant: TenantFixture,
  input: { initData: string; start: string; staffId: string | null; key?: string },
) {
  return app.inject({
    method: 'POST',
    url: `/v1/miniapp/businesses/${tenant.slug}/bookings`,
    headers: {
      authorization: `tma ${input.initData}`,
      'idempotency-key': input.key ?? randomUUID(),
    },
    payload: {
      locationId: tenant.locationId,
      serviceIds: [tenant.serviceId],
      staffId: input.staffId,
      start: input.start,
      contact: { name: 'Клиент', phone: '+79161234567' },
      comment: null,
    },
  });
}

describe('concurrent booking', () => {
  let app: NestFastifyApplication;
  let databases: TestDatabases;

  beforeAll(async () => {
    app = await createTestApp();
    databases = openTestDatabases();
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('lets exactly one of many simultaneous requests take the same staff member and time', async () => {
    // The fixture is a demo business so its launch data can be signed in the test.
    const tenant = await createTenant(databases.admin, { staffCount: 1, chairs: 3 });
    await databases.admin
      .updateTable('businesses')
      .set({ isDemo: true })
      .where('id', '=', tenant.businessId)
      .execute();
    const start = await firstSlotTomorrow(app, tenant);
    const launches = await Promise.all(
      Array.from({ length: 6 }, (_, index) => launchAs(app, tenant.slug, DEMO_USER_BASE + index)),
    );

    const responses = await Promise.all(
      launches.map((initData) =>
        book(app, tenant, { initData, start, staffId: tenant.staffIds[0] ?? null }),
      ),
    );

    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      201, 409, 409, 409, 409, 409,
    ]);
    const conflict = responses.find((response) => response.statusCode === 409);
    expect(conflict?.json<{ error: { code: string } }>().error.code).toBe('slot_unavailable');
    const stored = await databases.admin
      .selectFrom('bookings')
      .select('id')
      .where('businessId', '=', tenant.businessId)
      .execute();
    expect(stored).toHaveLength(1);
  });

  it('spreads simultaneous "any staff" requests over free staff until the shared chair runs out', async () => {
    const tenant = await createTenant(databases.admin, { staffCount: 3, chairs: 2 });
    await databases.admin
      .updateTable('businesses')
      .set({ isDemo: true })
      .where('id', '=', tenant.businessId)
      .execute();
    const start = await firstSlotTomorrow(app, tenant);
    const launches = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        launchAs(app, tenant.slug, DEMO_USER_BASE + 100 + index),
      ),
    );

    const responses = await Promise.all(
      launches.map((initData) => book(app, tenant, { initData, start, staffId: null })),
    );

    expect(responses.filter((response) => response.statusCode === 201)).toHaveLength(2);
    const staff = responses
      .filter((response) => response.statusCode === 201)
      .map((response) => response.json<{ staff: { id: string } }>().staff.id);
    expect(new Set(staff).size).toBe(2);
  });

  it('returns the same booking for a repeated request with one idempotency key', async () => {
    const tenant = await createTenant(databases.admin, { staffCount: 2, chairs: 2 });
    await databases.admin
      .updateTable('businesses')
      .set({ isDemo: true })
      .where('id', '=', tenant.businessId)
      .execute();
    const start = await firstSlotTomorrow(app, tenant);
    const initData = await launchAs(app, tenant.slug, DEMO_USER_BASE + 200);
    const key = randomUUID();

    const responses = await Promise.all(
      Array.from({ length: 3 }, () => book(app, tenant, { initData, start, staffId: null, key })),
    );

    expect(responses.map((response) => response.statusCode)).toEqual([201, 201, 201]);
    expect(new Set(responses.map((response) => response.json<{ id: string }>().id)).size).toBe(1);
    const stored = await databases.admin
      .selectFrom('bookings')
      .select('id')
      .where('businessId', '=', tenant.businessId)
      .execute();
    expect(stored).toHaveLength(1);
  });
});
