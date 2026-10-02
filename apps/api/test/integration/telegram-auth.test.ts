import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { Temporal } from '@mestechko/domain';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TmaTelegramLaunch } from '../../src/modules/identity/infrastructure/tma-telegram-launch.js';
import { createTestApp, TEST_DEMO_KEY } from './support/test-app.js';
import { createTenant, type TenantFixture } from './support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from './support/test-database.js';

const user = {
  id: '9200000000001',
  firstName: 'Тест',
  lastName: null,
  username: null,
  languageCode: 'ru',
};

function signedAt(instant: Temporal.Instant, key: string): string {
  const signer = new TmaTelegramLaunch({ botToken: null, demoKey: key }, 86_400, {
    now: () => instant,
  });
  return signer.sign({ user, startParam: 'x' });
}

describe('Mini App launch data on the server', () => {
  let app: NestFastifyApplication;
  let databases: TestDatabases;
  let tenant: TenantFixture;

  beforeAll(async () => {
    app = await createTestApp();
    databases = openTestDatabases();
    tenant = await createTenant(databases.admin);
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  const listWith = (authorization: string | undefined) =>
    app.inject({
      method: 'GET',
      url: `/v1/miniapp/businesses/${tenant.slug}/bookings?scope=upcoming`,
      headers: authorization ? { authorization } : {},
    });

  it('accepts fresh, correctly signed launch data', async () => {
    const response = await listWith(`tma ${signedAt(Temporal.Now.instant(), TEST_DEMO_KEY)}`);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [], nextCursor: null });
  });

  it.each([
    ['missing', undefined, 'telegram_auth_invalid'],
    [
      'tampered',
      `tma ${signedAt(Temporal.Now.instant(), TEST_DEMO_KEY).replace('first_name', 'first_nam3')}`,
      'telegram_auth_invalid',
    ],
    [
      'signed with another key',
      `tma ${signedAt(Temporal.Now.instant(), 'another-key-0123456789abcdef0123')}`,
      'telegram_auth_invalid',
    ],
    [
      'expired',
      `tma ${signedAt(Temporal.Now.instant().subtract({ hours: 25 }), TEST_DEMO_KEY)}`,
      'telegram_auth_expired',
    ],
  ])('rejects %s launch data', async (_case, authorization, code) => {
    const response = await listWith(authorization);
    expect(response.statusCode).toBe(401);
    expect(response.json<{ error: { code: string } }>().error.code).toBe(code);
  });
});
