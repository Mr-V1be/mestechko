import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_USER_BASE, book, launchAs } from '../support/booking-client.js';
import { addMember, cabinetHeaders, enableDemoSignIn } from '../support/cabinet-session.js';
import { localStart } from '../support/local-time.js';
import { MutableClock } from '../support/mutable-clock.js';
import { createTestApp } from '../support/test-app.js';
import { createTenant, type TenantFixture } from '../support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from '../support/test-database.js';

interface Details {
  id: string;
  version: number;
  status: string;
  staff: { id: string };
  total: { amountMinor: number };
  history: { kind: string; previousStaffName: string | null; actorName: string | null }[];
  settlement: { entries: { reason: string; amount: number }[] } | null;
}

describe('front desk', () => {
  const clock = new MutableClock();
  let app: NestFastifyApplication;
  let databases: TestDatabases;
  let tenant: TenantFixture;
  let headers: Record<string, string>;
  let first = '';
  let second = '';

  const desk = (path: string, payload: object, extra: Record<string, string> = {}) =>
    app.inject({
      method: 'POST',
      url: `/v1/cabinet/businesses/${tenant.businessId}/bookings${path}`,
      headers: { ...headers, ...extra },
      payload,
    });

  const walkIn = (
    staffId: string,
    start: string,
    client: object = { kind: 'new', name: 'Гость', phone: null },
  ) =>
    desk(
      '',
      {
        locationId: tenant.locationId,
        staffId,
        serviceIds: [tenant.serviceId],
        start,
        client,
        comment: null,
      },
      {
        'idempotency-key': randomUUID(),
      },
    );

  /** The booking's own notice went out right away, as the dispatcher sends it. */
  const markSent = (bookingId: string) =>
    databases.admin
      .updateTable('notifications')
      .set({ status: 'sent', sentAt: new Date() })
      .where('bookingId', '=', bookingId)
      .where('status', '=', 'pending')
      .where('kind', '=', 'booking_created')
      .execute();

  beforeAll(async () => {
    databases = openTestDatabases();
    app = await createTestApp({ clock });
    tenant = await createTenant(databases.admin, { staffCount: 2, chairs: 2 });
    [first = '', second = ''] = tenant.staffIds;
    await enableDemoSignIn(databases.admin, tenant);
    await addMember(databases.admin, tenant, 'owner', 'Администратор Ольга');
    headers = await cabinetHeaders(app, tenant, 'owner');
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('books a walk-in at any five minutes and says why another time does not work', async () => {
    const booked = await walkIn(first, localStart(1, '10:05'));
    expect(booked.statusCode).toBe(201);
    expect(booked.json<Details>()).toMatchObject({ status: 'confirmed', staff: { id: first } });

    const reasonAt = async (staffId: string, time: string) =>
      (await walkIn(staffId, localStart(1, time))).json<{
        error: { code: string; details: { reason: string } };
      }>().error;
    expect(await reasonAt(first, '10:30')).toMatchObject({
      code: 'slot_unavailable',
      details: { reason: 'staff_busy' },
    });
    expect((await reasonAt(first, '20:30')).details.reason).toBe('outside_hours');
    expect((await reasonAt(first, '10:07')).details.reason).toBe('off_grid');
  });

  it('moves a client booking to another staff member by version, keeping the agreed price', async () => {
    clock.reset();
    const initData = await launchAs(app, tenant.slug, DEMO_USER_BASE + 700);
    const start = localStart(2, '12:00');
    const created = await book(app, tenant, { initData, start, staffId: first });
    expect(created.statusCode).toBe(201);
    const bookingId = created.json<{ id: string }>().id;
    await markSent(bookingId);

    const moved = await desk(`/${bookingId}/move`, { staffId: second, start, expectedVersion: 1 });
    expect(moved.statusCode).toBe(200);
    const details = moved.json<Details>();
    expect(details).toMatchObject({
      version: 2,
      staff: { id: second },
      total: { amountMinor: 250_000 },
    });
    expect(details.history.at(-1)).toMatchObject({
      kind: 'rescheduled',
      previousStaffName: 'Master 0',
      actorName: 'Администратор Ольга',
    });

    const stale = await desk(`/${bookingId}/move`, {
      staffId: first,
      start: localStart(2, '14:00'),
      expectedVersion: 1,
    });
    expect(stale.json<{ error: { code: string } }>().error.code).toBe('booking_changed');

    const planned = await databases.admin
      .selectFrom('notifications')
      .select(['kind', 'bookingVersion'])
      .where('bookingId', '=', bookingId)
      .where('status', '=', 'pending')
      .execute();
    expect(planned).toContainEqual({ kind: 'booking_rescheduled', bookingVersion: 2 });
  });

  it('tells the client nothing about a move the desk took back before the notice went out', async () => {
    clock.reset();
    const initData = await launchAs(app, tenant.slug, DEMO_USER_BASE + 701);
    const start = localStart(3, '12:00');
    const created = await book(app, tenant, { initData, start, staffId: first });
    const bookingId = created.json<{ id: string }>().id;
    await markSent(bookingId);
    const notices = () =>
      databases.admin
        .selectFrom('notifications')
        .select(['bookingVersion', 'status', 'dueAt'])
        .where('bookingId', '=', bookingId)
        .where('kind', '=', 'booking_rescheduled')
        .orderBy('createdAt')
        .execute();

    const moved = await desk(`/${bookingId}/move`, {
      staffId: second,
      start: localStart(3, '15:00'),
      expectedVersion: 1,
    });
    expect(moved.statusCode).toBe(200);
    // The notice waits a moment: «Вернуть» may follow.
    const [waiting] = await notices();
    expect(waiting?.status).toBe('pending');
    expect((waiting?.dueAt.getTime() ?? 0) - clock.now().epochMilliseconds).toBeGreaterThan(0);

    const undone = await desk(`/${bookingId}/move`, { staffId: first, start, expectedVersion: 2 });
    expect(undone.statusCode).toBe(200);
    expect(await notices()).toEqual([
      expect.objectContaining({ bookingVersion: 2, status: 'cancelled' }),
    ]);

    // Moved again for real: now the client hears about it.
    const again = await desk(`/${bookingId}/move`, {
      staffId: first,
      start: localStart(3, '16:00'),
      expectedVersion: 3,
    });
    expect(again.statusCode).toBe(200);
    expect((await notices()).at(-1)).toMatchObject({ bookingVersion: 4, status: 'pending' });
  });

  it('settles a completed visit with points and accrues points on the money paid', async () => {
    clock.reset();
    await app.inject({
      method: 'PUT',
      url: `/v1/cabinet/businesses/${tenant.businessId}/loyalty/program`,
      headers,
      payload: { kind: 'cashback_points', accrualPercent: 5, maxRedeemPercent: 30 },
    });
    const start = localStart(3, '11:00');
    const booked = await walkIn(first, start, {
      kind: 'new',
      name: 'Постоянная',
      phone: '+70004120001',
    });
    const visit = booked.json<Details & { client: { id: string } }>();
    const points = await app.inject({
      method: 'POST',
      url: `/v1/cabinet/businesses/${tenant.businessId}/clients/${visit.client.id}/points`,
      headers: { ...headers, 'idempotency-key': randomUUID() },
      payload: { amount: 1000, note: 'Перенос баллов' },
    });
    expect(points.json<{ loyalty: { points: number } }>().loyalty.points).toBe(1000);

    const early = await desk(`/${visit.id}/complete`, {
      expectedVersion: 1,
      passId: null,
      points: 0,
    });
    expect(early.json<{ error: { code: string } }>().error.code).toBe('change_not_allowed');

    clock.set(Date.parse(start) + 30 * 60_000);
    const options = await app.inject({
      method: 'GET',
      url: `/v1/cabinet/businesses/${tenant.businessId}/bookings/${visit.id}/settlement-options`,
      headers,
    });
    expect(options.json()).toMatchObject({ pointsBalance: 1000, pointsRedeemable: 750 });

    const completed = await desk(`/${visit.id}/complete`, {
      expectedVersion: 1,
      passId: null,
      points: 2000,
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json<Details>().settlement?.entries).toEqual([
      { reason: 'points_redemption', amount: -750, passName: null },
      { reason: 'visit_payment', amount: 175_000, passName: null },
      { reason: 'points_accrual', amount: 87, passName: null },
    ]);
    const again = await desk(`/${visit.id}/complete`, {
      expectedVersion: 2,
      passId: null,
      points: 0,
    });
    expect(again.json<{ error: { code: string } }>().error.code).toBe('change_not_allowed');
    clock.reset();
  });

  it('keeps ledger entries append-only in the database', async () => {
    await expect(
      databases.admin.updateTable('ledgerEntries').set({ amount: 1 }).execute(),
    ).rejects.toThrow(/append-only/);
    await expect(databases.admin.deleteFrom('ledgerEntries').execute()).rejects.toThrow(
      /append-only/,
    );
  });
});
