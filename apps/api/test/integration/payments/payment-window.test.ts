import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_USER_BASE, book, launchAs } from '../support/booking-client.js';
import { enableDemoSignIn } from '../support/cabinet-session.js';
import { freePort } from '../support/free-port.js';
import { InlineJobQueue } from '../support/inline-job-queue.js';
import { localStart } from '../support/local-time.js';
import { MutableClock } from '../support/mutable-clock.js';
import { createTestApp } from '../support/test-app.js';
import { createTenant, type TenantFixture } from '../support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from '../support/test-database.js';

/** A provider whose page cannot live inside the app: it opens in the browser. */
describe('a payment page outside the app', () => {
  const clock = new MutableClock();
  const jobs = new InlineJobQueue();
  let app: NestFastifyApplication;
  let databases: TestDatabases;
  let tenant: TenantFixture;
  let returnPage = '';

  beforeAll(async () => {
    const port = await freePort();
    const base = `http://127.0.0.1:${String(port)}`;
    returnPage = `${base}/v1/payments/return`;
    databases = openTestDatabases();
    app = await createTestApp({
      clock,
      jobs,
      environment: {
        TEST_PAY_API_URL: `${base}/test-pay/api`,
        TEST_PAY_WEBHOOK_URL: `${base}/v1/payments/webhooks/test`,
        TEST_PAY_CHECKOUT: 'external',
        PAYMENTS_RETURN_PAGE_URL: returnPage,
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
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('says to open it in the browser and brings the payer back to a neutral page', async () => {
    const initData = await launchAs(app, tenant.slug, DEMO_USER_BASE + 900);
    const created = await book(app, tenant, {
      initData,
      start: localStart(1, '10:00'),
      staffId: tenant.staffIds[0] ?? null,
    });
    const held = created.json<{ id: string }>();
    const opened = await app.inject({
      method: 'POST',
      url: `/v1/miniapp/businesses/${tenant.slug}/bookings/${held.id}/payment`,
      headers: { authorization: `tma ${initData}`, 'accept-language': 'ru' },
      payload: { returnPath: `/b/${tenant.slug}/bookings/${held.id}?payment=return` },
    });
    expect(opened.statusCode).toBe(200);
    const { checkoutUrl, checkoutPresentation } = opened.json<{
      checkoutUrl: string;
      checkoutPresentation: string;
    }>();
    expect(checkoutPresentation).toBe('external');

    const answer = await app.inject({ method: 'POST', url: `${checkoutUrl}/pay` });
    // The neutral page opens in a browser of its own, so its address carries the payer's language.
    expect(answer.headers.location).toBe(`${returnPage}?locale=ru`);
    await jobs.drain();
    const page = await app.inject({ method: 'GET', url: '/v1/payments/return?locale=ru' });
    expect(page.headers['content-type']).toContain('text/html');
    expect(page.body).toContain('Оплата завершена');
    const english = await app.inject({ method: 'GET', url: '/v1/payments/return?locale=en' });
    expect(english.body).toContain('Payment complete');
    const booking = await app.inject({
      method: 'GET',
      url: `/v1/miniapp/businesses/${tenant.slug}/bookings/${held.id}`,
      headers: { authorization: `tma ${initData}` },
    });
    expect(booking.json<{ status: string }>().status).toBe('confirmed');
  });
});
