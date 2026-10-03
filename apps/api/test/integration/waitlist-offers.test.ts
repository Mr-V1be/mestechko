import { Temporal } from '@mestechko/domain';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bookingHoldHandlerTokens,
  type ReleaseExpiredHolds,
} from '../../src/modules/booking/application/lifecycle/booking-holds.js';
import {
  waitlistHandlerTokens,
  type MatchWaitlist,
} from '../../src/modules/waitlist/application/waitlist-matching.js';
import { WaitlistOffers } from '../../src/modules/waitlist/application/waitlist-offers.js';
import { DEMO_USER_BASE, launchAs } from './support/booking-client.js';
import { addMember, cabinetHeaders, enableDemoSignIn } from './support/cabinet-session.js';
import { InlineJobQueue } from './support/inline-job-queue.js';
import { MutableClock } from './support/mutable-clock.js';
import { createTestApp } from './support/test-app.js';
import { createTenant, fixtureTimeZone, type TenantFixture } from './support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from './support/test-database.js';

describe('waitlist offers, one client at a time', () => {
  const clock = new MutableClock();
  const jobs = new InlineJobQueue();
  let app: NestFastifyApplication;
  let databases: TestDatabases;
  let tenant: TenantFixture;
  const date = Temporal.Now.plainDateISO(fixtureTimeZone).add({ days: 2 }).toString();
  const users = [DEMO_USER_BASE + 1001, DEMO_USER_BASE + 1002];
  const entryOf = new Map<number, string>();

  const offers = () =>
    databases.admin
      .selectFrom('waitlistOffers as o')
      .innerJoin('bookings as b', 'b.id', 'o.bookingId')
      .select(['o.entryId', 'o.status', 'b.status as bookingStatus'])
      .where('o.businessId', '=', tenant.businessId)
      .orderBy('o.createdAt')
      .execute();

  const match = () =>
    app
      .get<MatchWaitlist>(waitlistHandlerTokens.match)
      .match({ businessId: tenant.businessId, locationId: tenant.locationId, date });

  const identity = (user: number) => ({
    business: { id: tenant.businessId },
    channel: 'telegram' as const,
    externalUserId: String(user),
  });

  beforeAll(async () => {
    databases = openTestDatabases();
    app = await createTestApp({ clock, jobs });
    tenant = await createTenant(databases.admin, { staffCount: 1, chairs: 1 });
    await enableDemoSignIn(databases.admin, tenant);
    await addMember(databases.admin, tenant, 'owner', 'Владелец');
    const headers = await cabinetHeaders(app, tenant, 'owner');
    // That day the only free hour is 10:00–11:00: one start for a one-hour service.
    const narrowed = await app.inject({
      method: 'POST',
      url: `/v1/cabinet/businesses/${tenant.businessId}/team/${tenant.staffIds[0] ?? ''}/schedule-changes`,
      headers,
      payload: {
        change: {
          type: 'day',
          date,
          day: {
            kind: 'work',
            locationId: tenant.locationId,
            hours: { start: '10:00', end: '11:00', breaks: [] },
          },
        },
        acknowledgedAffected: 0,
      },
    });
    expect(narrowed.statusCode).toBe(200);
    for (const [index, user] of users.entries()) {
      const initData = await launchAs(app, tenant.slug, user);
      const joined = await app.inject({
        method: 'POST',
        url: `/v1/miniapp/businesses/${tenant.slug}/waitlist`,
        headers: { authorization: `tma ${initData}` },
        payload: {
          locationId: tenant.locationId,
          serviceIds: [tenant.serviceId],
          staffId: null,
          date,
          dayPart: null,
          contact: { name: `Ждёт ${String(index + 1)}`, phone: `+7000412060${String(index)}` },
        },
      });
      expect(joined.statusCode).toBe(201);
      entryOf.set(user, joined.json<{ id: string }>().id);
    }
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('holds the time for the first in line, then passes it on when they decline or stay silent', async () => {
    const [first = 0, second = 0] = users;
    expect(await match()).toEqual({ offered: 1 });
    expect(await offers()).toEqual([
      { entryId: entryOf.get(first), status: 'pending', bookingStatus: 'held' },
    ]);

    const start = new Date(
      Temporal.PlainDateTime.from(`${date}T10:00`).toZonedDateTime(fixtureTimeZone)
        .epochMilliseconds,
    );
    await app.get(WaitlistOffers).decline(identity(first), entryOf.get(first) ?? '', start);
    await jobs.drain();
    expect(await offers()).toEqual([
      { entryId: entryOf.get(first), status: 'declined', bookingStatus: 'cancelled' },
      { entryId: entryOf.get(second), status: 'pending', bookingStatus: 'held' },
    ]);

    clock.set(Date.now() + 2 * 60 * 60_000);
    await app.get<ReleaseExpiredHolds>(bookingHoldHandlerTokens.sweep).handle();
    await jobs.drain();
    clock.reset();
    expect(await offers()).toEqual([
      { entryId: entryOf.get(first), status: 'declined', bookingStatus: 'cancelled' },
      { entryId: entryOf.get(second), status: 'expired', bookingStatus: 'cancelled' },
    ]);
  });

  it('lets the client take the offer in the Mini App, and nobody else', async () => {
    // Both earlier clients answered this start already; a newcomer is next in line.
    const newcomer = DEMO_USER_BASE + 1003;
    const joined = await app.inject({
      method: 'POST',
      url: `/v1/miniapp/businesses/${tenant.slug}/waitlist`,
      headers: { authorization: `tma ${await launchAs(app, tenant.slug, newcomer)}` },
      payload: {
        locationId: tenant.locationId,
        serviceIds: [tenant.serviceId],
        staffId: null,
        date,
        dayPart: null,
        contact: { name: 'Ждёт 3', phone: '+70004120603' },
      },
    });
    expect(joined.statusCode).toBe(201);
    entryOf.set(newcomer, joined.json<{ id: string }>().id);
    expect(await match()).toEqual({ offered: 1 });
    const pending = await databases.admin
      .selectFrom('waitlistOffers')
      .select(['entryId', 'bookingId'])
      .where('businessId', '=', tenant.businessId)
      .where('status', '=', 'pending')
      .executeTakeFirstOrThrow();
    expect(pending.entryId).toBe(entryOf.get(newcomer));
    const [stranger = 0] = users;
    const answer = async (user: number) =>
      app.inject({
        method: 'POST',
        url: `/v1/miniapp/businesses/${tenant.slug}/bookings/${pending.bookingId}/offer/accept`,
        headers: { authorization: `tma ${await launchAs(app, tenant.slug, user)}` },
      });

    expect((await answer(stranger)).statusCode).toBe(404);
    const taken = await answer(newcomer);
    expect(taken.statusCode).toBe(200);
    expect(taken.json<{ status: string; hold: unknown }>()).toMatchObject({
      status: 'confirmed',
      hold: null,
    });
  });
});
