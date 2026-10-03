import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_USER_BASE, book, firstSlotTomorrow, launchAs } from '../support/booking-client.js';
import { createTestApp } from '../support/test-app.js';
import { createTenant } from '../support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from '../support/test-database.js';

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

  it('answers a crowd racing for one time with one booking and conflicts, never an error', async () => {
    // Writers of overlapping rows may wait on each other inside the exclusion check;
    // the database then aborts one of them, which is a lost race like any other.
    const tenant = await createTenant(databases.admin, { staffCount: 1, chairs: 3 });
    await databases.admin
      .updateTable('businesses')
      .set({ isDemo: true })
      .where('id', '=', tenant.businessId)
      .execute();
    const start = await firstSlotTomorrow(app, tenant);
    const crowd = 24;
    const launches = await Promise.all(
      Array.from({ length: crowd }, (_, index) =>
        launchAs(app, tenant.slug, DEMO_USER_BASE + 400 + index),
      ),
    );

    const responses = await Promise.all(
      launches.map((initData) =>
        book(app, tenant, { initData, start, staffId: tenant.staffIds[0] ?? null }),
      ),
    );

    const statuses = responses.map((response) => response.statusCode);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(crowd - 1);
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

  it('never books above the agreed price and asks again when only pricier staff are free', async () => {
    const tenant = await createTenant(databases.admin, { staffCount: 2, chairs: 2 });
    await databases.admin
      .updateTable('businesses')
      .set({ isDemo: true })
      .where('id', '=', tenant.businessId)
      .execute();
    const [senior, junior] = tenant.staffIds;
    await databases.admin
      .updateTable('staffServices')
      .set({ priceMinor: 530_000 })
      .where('staffId', '=', senior ?? '')
      .execute();
    const start = await firstSlotTomorrow(app, tenant);
    const quote = await app.inject({
      method: 'GET',
      url: `/v1/public/businesses/${tenant.slug}/quote?locationId=${tenant.locationId}&serviceIds=${tenant.serviceId}&start=${encodeURIComponent(start)}`,
    });
    const terms = quote.json<{
      priceRange: { min: { amountMinor: number }; max: { amountMinor: number } };
    }>();
    expect([terms.priceRange.min.amountMinor, terms.priceRange.max.amountMinor]).toEqual([
      250_000, 530_000,
    ]);

    const first = await book(app, tenant, {
      initData: await launchAs(app, tenant.slug, DEMO_USER_BASE + 300),
      start,
      staffId: null,
    });
    expect(first.statusCode).toBe(201);
    expect(first.json<{ staff: { id: string }; total: { amountMinor: number } }>()).toMatchObject({
      staff: { id: junior },
      total: { amountMinor: 250_000 },
    });

    const secondClient = await launchAs(app, tenant.slug, DEMO_USER_BASE + 301);
    const second = await book(app, tenant, { initData: secondClient, start, staffId: null });
    expect(second.statusCode).toBe(409);
    expect(second.json<{ error: { code: string } }>().error.code).toBe('price_changed');

    const agreed = await book(app, tenant, {
      initData: secondClient,
      start,
      staffId: null,
      agreedTotal: { amountMinor: 530_000, currency: 'RUB' },
    });
    expect(agreed.json<{ staff: { id: string }; total: { amountMinor: number } }>()).toMatchObject({
      staff: { id: senior },
      total: { amountMinor: 530_000 },
    });
  });
});
