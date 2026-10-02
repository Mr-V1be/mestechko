import { createServer } from 'node:net';
import { Redis } from 'ioredis';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CreateClientBooking } from '../../src/modules/booking/application/client/create-client-booking.js';
import { ScryptPasswordHasher } from '../../src/modules/identity/infrastructure/crypto-adapters.js';
import { UuidV7Generator } from '../../src/platform/system-clock.js';
import { FIXTURE_PRICE, firstSlotTomorrow } from './support/booking-client.js';
import { InlineJobQueue } from './support/inline-job-queue.js';
import { createTestApp, testRedisUrl } from './support/test-app.js';
import { createTenant, type TenantFixture } from './support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from './support/test-database.js';

const ids = new UuidV7Generator();
const MAX_USER = '7000000042';
const MAX_TOKEN = 'test-max-bot-token-0123456789';

interface ChatView {
  chat: { started: boolean };
  messages: {
    id: string;
    text: string | null;
    buttons: { type: string; text: string; payload?: string }[][];
  }[];
  notices: { text: string }[];
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  await new Promise<void>((resolve) =>
    server.close(() => {
      resolve();
    }),
  );
  if (!address || typeof address === 'string') {
    throw new Error('No port');
  }
  return address.port;
}

/**
 * MAX end to end: the cabinet acts as the client in the emulator, the bot process
 * long-polls the emulator through the real MAX adapter and answers through it.
 */
describe('MAX channel through the emulator', () => {
  const jobs = new InlineJobQueue();
  let app: NestFastifyApplication;
  let databases: TestDatabases;
  let tenant: TenantFixture;
  let headers: Record<string, string>;

  const chatUrl = () =>
    `/v1/cabinet/businesses/${tenant.businessId}/max-emulator/chats/${MAX_USER}`;

  async function chat(): Promise<ChatView> {
    const response = await app.inject({ method: 'GET', url: chatUrl(), headers });
    expect(response.statusCode).toBe(200);
    return response.json<ChatView>();
  }

  async function press(label: string): Promise<void> {
    const view = await chat();
    const message = [...view.messages]
      .reverse()
      .find((candidate) => candidate.buttons.flat().some((button) => button.text === label));
    const button = message?.buttons.flat().find((candidate) => candidate.text === label);
    if (!message || !button?.payload) {
      throw new Error(`No button "${label}"`);
    }
    const response = await app.inject({
      method: 'POST',
      url: `${chatUrl()}/press`,
      headers,
      payload: { messageId: message.id, payload: button.payload },
    });
    expect(response.statusCode).toBe(204);
  }

  async function lastBotText(): Promise<string> {
    const view = await chat();
    return view.messages.filter((message) => message.text).at(-1)?.text ?? '';
  }

  beforeAll(async () => {
    const port = await freePort();
    // The bot remembers where it stopped reading; this test's emulator starts afresh.
    const redis = new Redis(testRedisUrl());
    await redis.del('mestechko:max:updates-marker');
    redis.disconnect();
    databases = openTestDatabases();
    app = await createTestApp({
      jobs,
      environment: {
        APP_ROLES: 'api,bot',
        MAX_BOT_TOKEN: MAX_TOKEN,
        MAX_API_BASE_URL: `http://127.0.0.1:${String(port)}/max-emulator`,
        MAX_EMULATOR_ENABLED: 'true',
      },
    });
    await app.listen(port, '127.0.0.1');
    tenant = await createTenant(databases.admin, { staffCount: 1, chairs: 1 });
    await databases.admin
      .updateTable('businesses')
      .set({ isDemo: true })
      .where('id', '=', tenant.businessId)
      .execute();
    const now = new Date();
    const userId = ids.next();
    const customerId = ids.next();
    await databases.admin
      .insertInto('users')
      .values({
        id: userId,
        email: `owner-${userId.slice(-8)}@example.test`,
        displayName: 'Владелец',
        passwordHash: await new ScryptPasswordHasher().hash('unused password'),
        createdAt: now,
      })
      .execute();
    await databases.admin
      .insertInto('memberships')
      .values({
        businessId: tenant.businessId,
        userId,
        role: 'owner',
        staffId: null,
        createdAt: now,
      })
      .execute();
    await databases.admin
      .insertInto('customers')
      .values({ id: customerId, createdAt: now })
      .execute();
    await databases.admin
      .insertInto('customerIdentities')
      .values({ channel: 'max', externalId: MAX_USER, customerId, createdAt: now })
      .execute();
    await databases.admin
      .insertInto('clients')
      .values({
        id: ids.next(),
        businessId: tenant.businessId,
        customerId,
        displayName: 'Ольга Клиентова',
        phone: '+70004120042',
        tags: [],
        createdAt: now,
        updatedAt: now,
      })
      .execute();
    const session = await app.inject({
      method: 'POST',
      url: '/v1/auth/demo-sessions',
      payload: { businessSlug: tenant.slug, role: 'owner' },
    });
    const cookie = session.cookies.find((entry) => entry.name === 'mst_session');
    headers = { cookie: `mst_session=${cookie?.value ?? ''}` };
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('lists the business’s MAX clients and starts the bot as one of them', async () => {
    const list = await app.inject({
      method: 'GET',
      url: `/v1/cabinet/businesses/${tenant.businessId}/max-emulator/chats`,
      headers,
    });
    expect(list.json<{ chats: { userId: string; started: boolean }[] }>().chats).toEqual([
      expect.objectContaining({ userId: MAX_USER, started: false }),
    ]);
    const start = await app.inject({ method: 'POST', url: `${chatUrl()}/start`, headers });
    expect(start.statusCode).toBe(204);
    await vi.waitFor(
      async () => {
        expect(await lastBotText()).toContain('Здравствуйте');
      },
      {
        timeout: 10_000,
        interval: 200,
      },
    );
  });

  it('delivers the booking notice to MAX and cancels by its buttons', async () => {
    const start = await firstSlotTomorrow(app, tenant);
    await app.get(CreateClientBooking).execute({
      business: { id: tenant.businessId },
      channel: 'max',
      source: 'max_mini_app',
      externalUserId: MAX_USER,
      idempotencyKey: ids.next(),
      locationId: tenant.locationId,
      serviceIds: [tenant.serviceId],
      staffId: null,
      start,
      contact: null,
      comment: null,
      agreedTotal: FIXTURE_PRICE,
      surface: 'web_app',
    });
    await jobs.drain();
    expect(await lastBotText()).toContain('Запись подтверждена');

    await press('Отменить');
    await vi.waitFor(
      async () => {
        expect(await lastBotText()).toContain('Отменить запись?');
      },
      {
        timeout: 10_000,
        interval: 200,
      },
    );
    await press('Да, отменить');
    await vi.waitFor(
      async () => {
        const view = await chat();
        expect(view.messages.at(-1)?.text).toContain('Запись отменена');
        expect(view.notices.at(-1)?.text).toBe('Запись отменена');
      },
      { timeout: 10_000, interval: 200 },
    );
  });

  it('refuses the bot API without the bot token', async () => {
    const response = await app.inject({ method: 'GET', url: '/max-emulator/me' });
    expect(response.statusCode).toBe(401);
  });
});
