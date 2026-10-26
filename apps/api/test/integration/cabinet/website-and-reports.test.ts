import { randomUUID } from 'node:crypto';
import { Temporal } from '@slotwise/domain';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FIXTURE_PRICE } from '../support/booking-client.js';
import { addMember, cabinetHeaders, enableDemoSignIn } from '../support/cabinet-session.js';
import { localStart } from '../support/local-time.js';
import { MutableClock } from '../support/mutable-clock.js';
import { createTestApp } from '../support/test-app.js';
import { createTenant, fixtureTimeZone, type TenantFixture } from '../support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from '../support/test-database.js';

describe('website bookings and reports', () => {
  const clock = new MutableClock();
  let app: NestFastifyApplication;
  let databases: TestDatabases;
  let tenant: TenantFixture;

  const bookOnWebsite = (phone: string, start: string) =>
    app.inject({
      method: 'POST',
      url: `/v1/widget/businesses/${tenant.slug}/bookings`,
      headers: { 'idempotency-key': randomUUID() },
      payload: {
        locationId: tenant.locationId,
        serviceIds: [tenant.serviceId],
        staffId: null,
        start,
        agreedTotal: FIXTURE_PRICE,
        contact: { name: 'Гость сайта', phone },
        comment: null,
        consent: true,
        returnPath: '/widget/',
      },
    });

  beforeAll(async () => {
    databases = openTestDatabases();
    app = await createTestApp({ clock });
    tenant = await createTenant(databases.admin);
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('books from the website and shows the booking only with its token', async () => {
    const refused = await bookOnWebsite('+70004120701', localStart(1, '10:00'));
    expect(refused.statusCode).toBe(400);

    await enableDemoSignIn(databases.admin, tenant);
    const created = await bookOnWebsite('+70004120701', localStart(1, '10:00'));
    expect(created.statusCode).toBe(201);
    const { booking, token, checkoutUrl } = created.json<{
      booking: { id: string; status: string };
      token: string;
      checkoutUrl: string | null;
    }>();
    expect(booking.status).toBe('confirmed');
    expect(checkoutUrl).toBeNull();

    const read = (value: string) =>
      app.inject({
        method: 'GET',
        url: `/v1/widget/businesses/${tenant.slug}/bookings/${booking.id}`,
        headers: { 'x-booking-token': value },
      });
    expect((await read(token)).json<{ id: string }>().id).toBe(booking.id);
    expect((await read(`${token.slice(0, -2)}xx`)).statusCode).toBe(404);
  });

  it('reports visits, revenue and occupancy of a period', async () => {
    await addMember(databases.admin, tenant, 'owner', 'Владелец');
    const headers = await cabinetHeaders(app, tenant, 'owner');
    const start = localStart(1, '10:00');
    const [visit] = await databases.admin
      .selectFrom('bookings')
      .select(['id', 'version'])
      .where('businessId', '=', tenant.businessId)
      .execute();
    clock.set(Date.parse(start) + 90 * 60_000);
    const completed = await app.inject({
      method: 'POST',
      url: `/v1/cabinet/businesses/${tenant.businessId}/bookings/${visit?.id ?? ''}/complete`,
      headers,
      payload: { expectedVersion: visit?.version ?? 1, passId: null, points: 0 },
    });
    expect(completed.statusCode).toBe(200);

    const day = Temporal.Now.plainDateISO(fixtureTimeZone).add({ days: 1 }).toString();
    const report = await app.inject({
      method: 'GET',
      url: `/v1/cabinet/businesses/${tenant.businessId}/reports?from=${day}&to=${day}`,
      headers,
    });
    clock.reset();
    expect(report.statusCode).toBe(200);
    expect(report.json<{ total: object }>().total).toEqual({
      workingMinutes: 12 * 60,
      bookedMinutes: 60,
      revenueMinor: FIXTURE_PRICE.amountMinor,
      visits: 1,
      noShows: 0,
      repeatVisits: 0,
    });
    // The day before has no records yet: a change against it would only show missing data.
    expect(report.json<{ comparable: string[] }>().comparable).toEqual([]);
  });
});
