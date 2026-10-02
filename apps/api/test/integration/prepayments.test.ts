import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  type ReleaseExpiredHolds,
  bookingHoldHandlerTokens,
} from '../../src/modules/booking/application/lifecycle/booking-holds.js';
import { signTestPayBody } from '../../src/modules/payments/infrastructure/test-pay-protocol.js';
import { DEMO_USER_BASE, book, launchAs } from './support/booking-client.js';
import { enableDemoSignIn } from './support/cabinet-session.js';
import { freePort } from './support/free-port.js';
import { InlineJobQueue } from './support/inline-job-queue.js';
import { localStart } from './support/local-time.js';
import { MutableClock } from './support/mutable-clock.js';
import { createTestApp, TEST_PAY_WEBHOOK_SECRET } from './support/test-app.js';
import { createTenant, type TenantFixture } from './support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from './support/test-database.js';

interface Booking {
  id: string;
  status: string;
  hold: { reason: string; expiresAt: string } | null;
  deposit: { amountMinor: number } | null;
  payment: {
    status: string;
    amount: { amountMinor: number };
    refunded: { amountMinor: number };
  } | null;
}

const DEPOSIT = 75_000;

describe('prepayments through the test provider', () => {
  const clock = new MutableClock();
  const jobs = new InlineJobQueue();
  let app: NestFastifyApplication;
  let databases: TestDatabases;
  let tenant: TenantFixture;
  let initData = '';

  const miniapp = (method: 'GET' | 'POST', path: string, payload?: object) =>
    app.inject({
      method,
      url: `/v1/miniapp/businesses/${tenant.slug}/bookings${path}`,
      headers: { authorization: `tma ${initData}` },
      ...(payload ? { payload } : {}),
    });

  const bookAt = async (days: number, time: string): Promise<Booking> => {
    const response = await book(app, tenant, {
      initData,
      start: localStart(days, time),
      staffId: tenant.staffIds[0] ?? null,
    });
    expect(response.statusCode).toBe(201);
    return response.json<Booking>();
  };

  const pay = async (bookingId: string, decision: 'pay' | 'cancel' = 'pay') => {
    const opened = await miniapp('POST', `/${bookingId}/payment`, {
      returnPath: `/b/${tenant.slug}/bookings/${bookingId}?payment=return`,
    });
    expect(opened.statusCode).toBe(200);
    const { checkoutUrl } = opened.json<{ checkoutUrl: string }>();
    const page = await app.inject({ method: 'GET', url: checkoutUrl });
    expect(page.headers['content-type']).toContain('text/html');
    const answer = await app.inject({ method: 'POST', url: `${checkoutUrl}/${decision}` });
    expect(answer.statusCode).toBe(303);
    expect(answer.headers.location).toBe(`/b/${tenant.slug}/bookings/${bookingId}?payment=return`);
    await jobs.drain();
  };

  const ledgerOf = (bookingId: string) =>
    databases.admin
      .selectFrom('ledgerEntries')
      .select(['reason', 'amount'])
      .where('bookingId', '=', bookingId)
      .orderBy('createdAt')
      .execute();

  beforeAll(async () => {
    const port = await freePort();
    const base = `http://127.0.0.1:${String(port)}`;
    databases = openTestDatabases();
    app = await createTestApp({
      clock,
      jobs,
      environment: {
        TEST_PAY_API_URL: `${base}/test-pay/api`,
        TEST_PAY_WEBHOOK_URL: `${base}/v1/payments/webhooks/test`,
      },
    });
    await app.listen({ port, host: '127.0.0.1' });
    tenant = await createTenant(databases.admin, { staffCount: 1, chairs: 1 });
    await enableDemoSignIn(databases.admin, tenant);
    await databases.admin
      .updateTable('businesses')
      .set({
        rulesOverrides: JSON.stringify({ minLeadMinutes: 0, prepayment: { depositPercent: 30 } }),
      })
      .where('id', '=', tenant.businessId)
      .execute();
    initData = await launchAs(app, tenant.slug, DEMO_USER_BASE + 800);
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('holds the time until the prepayment arrives, then confirms the booking once', async () => {
    const held = await bookAt(1, '10:00');
    expect(held).toMatchObject({
      status: 'held',
      hold: { reason: 'payment' },
      deposit: { amountMinor: DEPOSIT },
      payment: { status: 'pending' },
    });

    await pay(held.id);
    const confirmed = (await miniapp('GET', `/${held.id}`)).json<Booking>();
    expect(confirmed).toMatchObject({
      status: 'confirmed',
      hold: null,
      payment: { status: 'succeeded' },
    });
    expect(await ledgerOf(held.id)).toEqual([{ reason: 'prepayment', amount: DEPOSIT }]);

    // The provider delivers the same notification again: nothing changes.
    const event = await databases.admin
      .selectFrom('testPayEvents')
      .select('body')
      .where('type', '=', 'payment.succeeded')
      .orderBy('createdAt', 'desc')
      .executeTakeFirstOrThrow();
    const timestamp = Math.floor(clock.now().epochMilliseconds / 1000);
    const replay = await app.inject({
      method: 'POST',
      url: '/v1/payments/webhooks/test',
      headers: {
        'content-type': 'application/json',
        'x-testpay-signature': signTestPayBody(TEST_PAY_WEBHOOK_SECRET, timestamp, event.body),
      },
      payload: event.body,
    });
    expect(replay.statusCode).toBe(200);
    expect(await ledgerOf(held.id)).toHaveLength(1);

    const forged = await app.inject({
      method: 'POST',
      url: '/v1/payments/webhooks/test',
      headers: {
        'content-type': 'application/json',
        'x-testpay-signature': signTestPayBody('not-the-secret-0123456789', timestamp, event.body),
      },
      payload: event.body,
    });
    expect(forged.statusCode).toBe(400);
  });

  it('gives the prepayment back when the client cancels in time', async () => {
    const held = await bookAt(2, '11:00');
    await pay(held.id);
    const cancelled = await miniapp('POST', `/${held.id}/cancel`);
    expect(cancelled.json<Booking>().status).toBe('cancelled');
    await jobs.drain();
    const after = (await miniapp('GET', `/${held.id}`)).json<Booking>();
    expect(after.payment).toMatchObject({ status: 'refunded', refunded: { amountMinor: DEPOSIT } });
    expect(await ledgerOf(held.id)).toEqual([
      { reason: 'prepayment', amount: DEPOSIT },
      { reason: 'prepayment_refund', amount: -DEPOSIT },
    ]);
  });

  it('releases an unpaid hold when it runs out and returns money that arrives too late', async () => {
    const held = await bookAt(3, '12:00');
    const opened = await miniapp('POST', `/${held.id}/payment`, {
      returnPath: `/b/${tenant.slug}/bookings/${held.id}`,
    });
    const { checkoutUrl } = opened.json<{ checkoutUrl: string }>();

    clock.set(Date.parse(held.hold?.expiresAt ?? '') + 60_000);
    await app.get<ReleaseExpiredHolds>(bookingHoldHandlerTokens.sweep).handle();
    const released = await databases.admin
      .selectFrom('bookings')
      .select('status')
      .where('id', '=', held.id)
      .executeTakeFirstOrThrow();
    expect(released.status).toBe('cancelled');

    // The page was still open at the provider: the client pays after all.
    await databases.admin
      .updateTable('testPayPayments')
      .set({ expiresAt: new Date(clock.now().epochMilliseconds + 60_000) })
      .execute();
    await app.inject({ method: 'POST', url: `${checkoutUrl}/pay` });
    await jobs.drain();
    expect(await ledgerOf(held.id)).toEqual([
      { reason: 'prepayment', amount: DEPOSIT },
      { reason: 'prepayment_refund', amount: -DEPOSIT },
    ]);
    clock.reset();
  });
});
