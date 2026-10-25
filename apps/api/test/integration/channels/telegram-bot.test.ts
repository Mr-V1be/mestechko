import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { dispatchNotificationsJob } from '../../../src/modules/notifications/application/notification-jobs.js';
import { DEMO_USER_BASE, book, dateInDays, launchAs, slotsOn } from '../support/booking-client.js';
import { InlineJobQueue } from '../support/inline-job-queue.js';
import { MockTelegram } from '../support/mock-telegram.js';
import { MutableClock } from '../support/mutable-clock.js';
import { TelegramChat, WEBHOOK_SECRET } from '../support/telegram-chat.js';
import { createTestApp } from '../support/test-app.js';
import { createTenant, type TenantFixture } from '../support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from '../support/test-database.js';

const HOUR = 3_600_000;
const MINUTE = 60_000;

interface ClientBookingBody {
  id: string;
  start: string;
  version: number;
  status: string;
  attendanceConfirmed: boolean;
}

describe('Telegram bot', () => {
  const telegram = new MockTelegram();
  const jobs = new InlineJobQueue();
  const clock = new MutableClock();
  let app: NestFastifyApplication;
  let databases: TestDatabases;
  let tenant: TenantFixture;
  let nextUser = DEMO_USER_BASE + 7_000;

  async function client() {
    nextUser += 1;
    const chat = new TelegramChat(app, telegram, nextUser);
    const initData = await launchAs(app, tenant.slug, nextUser);
    return { chat, initData };
  }

  async function bookOn(initData: string, date: string, slotIndex = 0) {
    const start = (await slotsOn(app, tenant, date))[slotIndex];
    if (!start) {
      throw new Error(`No free slot on ${date}`);
    }
    const response = await book(app, tenant, { initData, start, staffId: null });
    expect(response.statusCode).toBe(201);
    return response.json<ClientBookingBody>();
  }

  async function bookingOf(initData: string, bookingId: string) {
    const response = await app.inject({
      method: 'GET',
      url: `/v1/miniapp/businesses/${tenant.slug}/bookings/${bookingId}`,
      headers: { authorization: `tma ${initData}` },
    });
    return response.json<ClientBookingBody>();
  }

  /** What the minute-by-minute sweep does in production. */
  async function sweepAt(epochMs: number) {
    clock.set(epochMs);
    await jobs.enqueue(dispatchNotificationsJob, {}, { deduplicationKey: 'test' });
    await jobs.drain();
  }

  beforeAll(async () => {
    const apiRoot = await telegram.start();
    databases = openTestDatabases();
    app = await createTestApp({
      clock,
      jobs,
      environment: {
        TELEGRAM_BOT_TOKEN: telegram.token,
        TELEGRAM_API_ROOT: apiRoot,
        TELEGRAM_UPDATES_MODE: 'webhook',
        TELEGRAM_WEBHOOK_URL: 'https://api.example.test/v1/telegram/webhook',
        TELEGRAM_WEBHOOK_SECRET: WEBHOOK_SECRET,
        TELEGRAM_BOT_USERNAME: 'mestechko_test_bot',
      },
    });
    tenant = await createTenant(databases.admin, { staffCount: 1, chairs: 2 });
    await databases.admin
      .updateTable('businesses')
      .set({ isDemo: true })
      .where('id', '=', tenant.businessId)
      .execute();
  });

  beforeEach(() => {
    clock.reset();
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
    await telegram.stop();
  });

  it('confirms a booking, reminds a day and two hours ahead and takes the attendance answer', async () => {
    const { chat, initData } = await client();
    await chat.send('/start');
    expect(chat.lastText()).toContain('Здравствуйте');

    const booking = await bookOn(initData, dateInDays(3));
    await jobs.drain();
    expect(chat.lastText()).toContain('Запись подтверждена');
    expect(telegram.lastMessageTo(chat.chatId).buttons.map((button) => button.text)).toEqual([
      'Перенести',
      'Отменить',
    ]);

    const start = Date.parse(booking.start);
    await sweepAt(start - 24 * HOUR + MINUTE);
    expect(chat.lastText()).toContain('Завтра у вас запись');

    await sweepAt(start - 2 * HOUR + MINUTE);
    expect(chat.lastText()).toContain('Через 2 часа у вас запись');
    await chat.press('Приду');
    expect(telegram.notices().at(-1)).toBe('Спасибо, ждём вас!');
    expect(chat.lastText()).toContain('Вы подтвердили визит');
    clock.reset(); // the launch data was signed today and expires in a day
    expect((await bookingOf(initData, booking.id)).attendanceConfirmed).toBe(true);
  });

  it("speaks the client's language: the one they chose, otherwise their Telegram's", async () => {
    nextUser += 1;
    const chat = new TelegramChat(app, telegram, nextUser, 'en');
    await chat.send('/start');
    expect(chat.lastText()).toContain('Hi, ');

    const initData = await launchAs(app, tenant.slug, nextUser);
    const chosen = await app.inject({
      method: 'PUT',
      url: '/v1/miniapp/preferences',
      headers: { authorization: `tma ${initData}` },
      payload: { locale: 'ru' },
    });
    expect(chosen.json()).toEqual({ locale: 'ru' });
    await chat.send('/help');
    expect(chat.lastText()).toContain('Что умеет бот');
    await bookOn(initData, dateInDays(6));
    await jobs.drain();
    expect(chat.lastText()).toContain('Запись подтверждена');
  });

  it('moves a booking with buttons: day, time, confirmation', async () => {
    const { chat, initData } = await client();
    await chat.send('/start');
    const booking = await bookOn(initData, dateInDays(4));
    await jobs.drain();

    await chat.press('Перенести');
    expect(chat.lastText()).toContain('Выберите новый день');
    // The latest offered day keeps both reminders of the moved booking ahead.
    const dayButton = telegram.lastMessageTo(chat.chatId).buttons.at(-2);
    if (!dayButton?.callback_data) {
      throw new Error('No day offered');
    }
    await chat.pressData(dayButton.callback_data);
    expect(chat.lastText()).toContain('Свободное время');
    const timeButton = telegram.lastMessageTo(chat.chatId).buttons[0];
    if (!timeButton?.callback_data) {
      throw new Error('No time offered');
    }
    await chat.pressData(timeButton.callback_data);
    expect(chat.lastText()).toContain('Перенести на');
    await chat.press('Перенести');
    expect(chat.lastText()).toContain('Запись перенесена');

    const moved = await bookingOf(initData, booking.id);
    expect(moved.version).toBe(2);
    expect(moved.start).not.toBe(booking.start);
    const pending = await databases.admin
      .selectFrom('notifications')
      .select(['kind', 'bookingVersion', 'status'])
      .where('bookingId', '=', booking.id)
      .where('status', '=', 'pending')
      .execute();
    expect(pending.map((row) => [row.kind, row.bookingVersion]).sort()).toEqual([
      ['reminder_24h', 2],
      ['reminder_2h', 2],
    ]);
  });

  it('cancels with buttons and offers the freed time to the waitlist', async () => {
    const date = dateInDays(5);
    const owner = await client();
    const waiting = await client();
    await owner.chat.send('/start');
    await waiting.chat.send('/start');
    const slots = await slotsOn(app, tenant, date);
    // Everyone else takes the rest of the day, so the cancelled time is the only one.
    const booked = await bookOn(owner.initData, date);
    for (let index = 1; index < slots.length; index += 1) {
      const filler = await client();
      const start = slots[index];
      if (start) {
        await book(app, tenant, { initData: filler.initData, start, staffId: null });
      }
    }
    expect(await slotsOn(app, tenant, date)).toEqual([]);
    const join = await app.inject({
      method: 'POST',
      url: `/v1/miniapp/businesses/${tenant.slug}/waitlist`,
      headers: { authorization: `tma ${waiting.initData}` },
      payload: {
        locationId: tenant.locationId,
        serviceIds: [tenant.serviceId],
        staffId: null,
        date,
        dayPart: null,
        contact: { name: 'Ждущий клиент', phone: '+70001112233' },
      },
    });
    expect(join.statusCode).toBe(201);
    await jobs.drain();
    const ownerMessages = telegram.messagesTo(owner.chat.chatId).length;

    await owner.chat.press('Отменить');
    expect(owner.chat.lastText()).toContain('Отменить запись?');
    await owner.chat.press('Да, отменить');
    expect(owner.chat.lastText()).toContain('Запись отменена');
    expect(telegram.notices().at(-1)).toBe('Запись отменена');

    await jobs.drain();
    // The edited message is the confirmation; no separate notice follows.
    expect(telegram.messagesTo(owner.chat.chatId)).toHaveLength(ownerMessages + 2);
    expect(waiting.chat.lastText()).toContain('Освободилось время');

    await waiting.chat.press('Записаться');
    expect(telegram.notices().at(-1)).toBe('Вы записаны');
    expect(waiting.chat.lastText()).toContain('Запись подтверждена');
    const mine = await app.inject({
      method: 'GET',
      url: `/v1/miniapp/businesses/${tenant.slug}/bookings?scope=upcoming`,
      headers: { authorization: `tma ${waiting.initData}` },
    });
    const items = mine.json<{ items: ClientBookingBody[] }>().items;
    expect(items.map((item) => item.start)).toEqual([booked.start]);
    const wishes = await app.inject({
      method: 'GET',
      url: `/v1/miniapp/businesses/${tenant.slug}/waitlist`,
      headers: { authorization: `tma ${waiting.initData}` },
    });
    expect(wishes.json<{ items: unknown[] }>().items).toEqual([]);
  });

  it('writes only to people who started the bot, and stops when they block it', async () => {
    const silent = await client();
    await bookOn(silent.initData, dateInDays(6));
    await jobs.drain();
    expect(telegram.messagesTo(silent.chat.chatId)).toEqual([]);
    const skipped = await databases.admin
      .selectFrom('notifications')
      .innerJoin('customerIdentities', 'customerIdentities.customerId', 'notifications.customerId')
      .select(['notifications.kind', 'notifications.status', 'notifications.outcome'])
      .where('customerIdentities.externalId', '=', silent.chat.chatId)
      .orderBy('notifications.dueAt')
      .execute();
    // The notice was due and dropped; reminders wait in case the person starts the bot.
    expect(skipped).toEqual([
      { kind: 'booking_created', status: 'skipped', outcome: 'no_permission' },
      { kind: 'reminder_24h', status: 'pending', outcome: null },
      { kind: 'reminder_2h', status: 'pending', outcome: null },
    ]);

    const leaving = await client();
    await leaving.chat.send('/start');
    await leaving.chat.blockBot();
    const status = await app.inject({
      method: 'GET',
      url: '/v1/miniapp/notifications',
      headers: { authorization: `tma ${leaving.initData}` },
    });
    expect(status.json()).toEqual({
      enabled: false,
      connectUrl: 'https://t.me/mestechko_test_bot?start=notify',
    });
  });

  it('refuses webhook calls without the secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
      payload: { update_id: 1 },
    });
    expect(response.statusCode).toBe(404);
  });
});
