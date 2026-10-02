import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { RoleId } from '@mestechko/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ScryptPasswordHasher } from '../../src/modules/identity/infrastructure/crypto-adapters.js';
import { UuidV7Generator } from '../../src/platform/system-clock.js';
import {
  DEMO_USER_BASE,
  book,
  dateInDays,
  firstSlotTomorrow,
  launchAs,
} from './support/booking-client.js';
import { createTestApp } from './support/test-app.js';
import { createTenant, type TenantFixture } from './support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from './support/test-database.js';

const ids = new UuidV7Generator();

describe('staff role in the cabinet', () => {
  let databases: TestDatabases;
  let app: NestFastifyApplication;
  let tenant: TenantFixture;
  let ownStaffId: string;
  let colleagueStaffId: string;
  const bookingOf = new Map<string, string>();

  async function addMember(role: RoleId, displayName: string, staffId: string | null) {
    const userId = ids.next();
    await databases.admin
      .insertInto('users')
      .values({
        id: userId,
        email: `${role}-${userId.slice(-8)}@example.test`,
        displayName,
        passwordHash: await new ScryptPasswordHasher().hash('unused password'),
        createdAt: new Date(),
      })
      .execute();
    await databases.admin
      .insertInto('memberships')
      .values({ businessId: tenant.businessId, userId, role, staffId, createdAt: new Date() })
      .execute();
  }

  async function demoSession(role: RoleId): Promise<Record<string, string>> {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/demo-sessions',
      payload: { businessSlug: tenant.slug, role },
    });
    expect(response.statusCode).toBe(200);
    const cookie = response.cookies.find((entry) => entry.name === 'mst_session');
    return { cookie: `mst_session=${cookie?.value ?? ''}` };
  }

  beforeAll(async () => {
    databases = openTestDatabases();
    app = await createTestApp();
    tenant = await createTenant(databases.admin, { staffCount: 2, chairs: 2 });
    [ownStaffId = '', colleagueStaffId = ''] = tenant.staffIds;
    await databases.admin
      .updateTable('businesses')
      .set({ isDemo: true })
      .where('id', '=', tenant.businessId)
      .execute();
    await addMember('owner', 'Владелец', null);
    await addMember('staff', 'Мастер', ownStaffId);
    for (const [index, staffId] of [ownStaffId, colleagueStaffId].entries()) {
      const initData = await launchAs(app, tenant.slug, DEMO_USER_BASE + 500 + index);
      const start = await firstSlotTomorrow(app, tenant, staffId);
      const response = await book(app, tenant, { initData, start, staffId });
      expect(response.statusCode).toBe(201);
      bookingOf.set(staffId, response.json<{ id: string }>().id);
    }
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('offers the demo visitor every role the business has', async () => {
    const response = await app.inject({ method: 'GET', url: '/v1/demo/businesses' });
    const business = response
      .json<{ businesses: { slug: string; personas: { role: string; displayName: string }[] }[] }>()
      .businesses.find((candidate) => candidate.slug === tenant.slug);
    expect(business?.personas).toEqual([
      { role: 'owner', displayName: 'Владелец' },
      { role: 'staff', displayName: 'Мастер' },
    ]);
  });

  it('shows a staff member only their own schedule column and visits', async () => {
    const headers = await demoSession('staff');
    const tomorrow = dateInDays(1);
    const schedule = await app.inject({
      method: 'GET',
      url: `/v1/cabinet/businesses/${tenant.businessId}/schedule?locationId=${tenant.locationId}&from=${tomorrow}&to=${tomorrow}&axis=staff`,
      headers,
    });
    expect(schedule.statusCode).toBe(200);
    const body = schedule.json<{ columns: { id: string }[]; bookings: { id: string }[] }>();
    expect(body.columns.map((column) => column.id)).toEqual([ownStaffId]);
    expect(body.bookings.map((booking) => booking.id)).toEqual([bookingOf.get(ownStaffId)]);

    const list = await app.inject({
      method: 'GET',
      url: `/v1/cabinet/businesses/${tenant.businessId}/bookings?from=${tomorrow}&to=${tomorrow}&staffId=${colleagueStaffId}`,
      headers,
    });
    expect(list.json<{ items: { id: string }[] }>().items.map((item) => item.id)).toEqual([
      bookingOf.get(ownStaffId),
    ]);

    const colleagues = await app.inject({
      method: 'GET',
      url: `/v1/cabinet/businesses/${tenant.businessId}/bookings/${bookingOf.get(colleagueStaffId) ?? ''}`,
      headers,
    });
    expect(colleagues.statusCode).toBe(404);
  });

  it('shows the owner every visit', async () => {
    const headers = await demoSession('owner');
    const tomorrow = dateInDays(1);
    const list = await app.inject({
      method: 'GET',
      url: `/v1/cabinet/businesses/${tenant.businessId}/bookings?from=${tomorrow}&to=${tomorrow}`,
      headers,
    });
    expect(
      list
        .json<{ items: { id: string }[] }>()
        .items.map((item) => item.id)
        .sort(),
    ).toEqual([...bookingOf.values()].sort());
  });
});
