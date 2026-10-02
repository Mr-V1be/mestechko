import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { TenantFixture } from './tenant-fixture.js';

/** Telegram user ids reserved for test clients. */
export const DEMO_USER_BASE = 9_100_000_000_000;
export const FIXTURE_PRICE = { amountMinor: 250_000, currency: 'RUB' } as const;
const MS_PER_DAY = 86_400_000;

/** Signed Mini App launch data for a demo client of the tenant. */
export async function launchAs(
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

export function dateInDays(days: number): string {
  return new Date(Date.now() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Offered starts on a day for the fixture's service, optionally for one staff member. */
export async function slotsOn(
  app: NestFastifyApplication,
  tenant: TenantFixture,
  date: string,
  staffId: string | null = null,
): Promise<string[]> {
  const staff = staffId ? `&staffId=${staffId}` : '';
  const response = await app.inject({
    method: 'GET',
    url: `/v1/public/businesses/${tenant.slug}/availability?locationId=${tenant.locationId}&serviceIds=${tenant.serviceId}&from=${date}&to=${date}${staff}`,
  });
  return (
    response
      .json<{ days: { slots: { start: string }[] }[] }>()
      .days[0]?.slots.map((slot) => slot.start) ?? []
  );
}

/** First offered start tomorrow for the fixture's service. */
export async function firstSlotTomorrow(
  app: NestFastifyApplication,
  tenant: TenantFixture,
  staffId: string | null = null,
): Promise<string> {
  const start = (await slotsOn(app, tenant, dateInDays(1), staffId))[0];
  if (!start) {
    throw new Error('Fixture has no free slot tomorrow');
  }
  return start;
}

export function book(
  app: NestFastifyApplication,
  tenant: TenantFixture,
  input: {
    initData: string;
    start: string;
    staffId: string | null;
    key?: string;
    agreedTotal?: { amountMinor: number; currency: 'RUB' };
  },
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
      agreedTotal: input.agreedTotal ?? FIXTURE_PRICE,
      contact: { name: 'Клиент', phone: '+79161234567' },
      comment: null,
    },
  });
}
