/**
 * Live check of the Telegram bot for the owner, against a running API with a worker.
 * It acts for the person who most recently started the bot:
 *
 *   pnpm bot:check booking [--business siren] [--in-hours 26]
 *     books the nearest free time that many hours ahead through the regular use case;
 *     the bot confirms it, and reminders follow 24 and 2 hours before the visit.
 *   pnpm bot:check waitlist [--business siren] [--in-days 2]
 *     puts the person on the waitlist for that day and runs matching; free time on the
 *     day comes as an offer with a «Записаться» button.
 *
 * Demo businesses only. Prints what it did, never a token.
 */
import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { BookingOptions } from '../modules/booking/application/availability/booking-options.js';
import { CreateClientBooking } from '../modules/booking/application/client/create-client-booking.js';
import { CatalogQueries } from '../modules/catalog/application/catalog-queries.js';
import { WaitlistEntries } from '../modules/waitlist/application/waitlist-entries.js';
import { matchWaitlistJob } from '../modules/waitlist/application/waitlist-matching.js';
import { loadConfig } from '../platform/config/app-config.js';
import { DATABASE, type Database } from '../platform/db/database.js';
import { JOB_QUEUE, type JobQueue } from '../shared/application/job-queue.js';
import type { Kysely } from 'kysely';

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
/** A demo number (`+7 0XX`, see docs/demo-data.md): the check never stores a real one. */
const CHECK_CONTACT = { displayName: 'Проверка бота', phone: '+70000000999' };

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    business: { type: 'string', default: 'siren' },
    'in-hours': { type: 'string', default: '26' },
    'in-days': { type: 'string', default: '2' },
  },
});
const command = positionals[0];
if (command !== 'booking' && command !== 'waitlist') {
  console.error('Usage: pnpm bot:check booking|waitlist [--business siren]');
  process.exit(1);
}

const config = loadConfig({ ...process.env, APP_ROLES: 'api', LOG_LEVEL: 'warn' });
const app = await NestFactory.createApplicationContext(
  AppModule.forRoot(config, { prometheus: null, shutdown: () => Promise.resolve() }),
  { logger: ['error', 'warn'] },
);
try {
  const db = app.get<Kysely<Database>>(DATABASE);
  const person = await db
    .selectFrom('customerIdentities')
    .select('externalId')
    .where('channel', '=', 'telegram')
    .where('messagingAllowedAt', 'is not', null)
    .orderBy('messagingAllowedAt', 'desc')
    .executeTakeFirst();
  if (!person) {
    throw new Error('Nobody has started the bot yet: open it in Telegram and press Start.');
  }
  const slug = values.business;
  const business = await app.get(CatalogQueries).publicBusiness(slug);
  const location = business.locations[0];
  if (!location) {
    throw new Error(`${slug} has no locations`);
  }
  const options = app.get(BookingOptions);
  const service = (await options.services(slug, location.id))[0]?.services[0];
  if (!service) {
    throw new Error(`${slug} has nothing to book`);
  }
  const identity = {
    business: { slug },
    channel: 'telegram' as const,
    externalUserId: person.externalId,
  };

  if (command === 'booking') {
    const after = Date.now() + Number(values['in-hours']) * MS_PER_HOUR;
    const day = new Date(after).toISOString().slice(0, 10);
    const next = new Date(after + MS_PER_DAY).toISOString().slice(0, 10);
    const availability = await options.availability(slug, {
      locationId: location.id,
      serviceIds: [service.id],
      staffId: null,
      from: day,
      to: next,
    });
    const start = availability.days
      .flatMap((entry) => entry.slots.map((slot) => slot.start))
      .find((candidate) => Date.parse(candidate) >= after);
    if (!start) {
      throw new Error('No free time then; try another --in-hours');
    }
    const quote = await options.quote(slug, {
      locationId: location.id,
      serviceIds: [service.id],
      staffId: null,
      start,
    });
    if (!quote.assigned) {
      throw new Error('The time was just taken; run again');
    }
    const booking = await app.get(CreateClientBooking).execute({
      ...identity,
      source: 'telegram_mini_app',
      idempotencyKey: randomUUID(),
      locationId: location.id,
      serviceIds: [service.id],
      staffId: null,
      start,
      agreedTotal: quote.assigned.total,
      contact: CHECK_CONTACT,
      comment: null,
      surface: 'web_app',
    });
    console.warn(`Booked ${service.name} in ${business.name} at ${booking.start} (UTC).`);
    console.warn('The bot sends the confirmation now and reminders 24 h and 2 h before.');
  } else {
    const date = new Date(Date.now() + Number(values['in-days']) * MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    const entry = await app.get(WaitlistEntries).join(identity, {
      locationId: location.id,
      serviceIds: [service.id],
      staffId: null,
      date,
      dayPart: null,
      contact: CHECK_CONTACT,
    });
    await app
      .get<JobQueue>(JOB_QUEUE)
      .enqueue(
        matchWaitlistJob,
        { businessId: business.id, locationId: location.id, date: entry.date },
        { deduplicationKey: `bot-check-${randomUUID()}` },
      );
    console.warn(`Waiting for ${service.name} in ${business.name} on ${entry.date}.`);
    console.warn('The worker offers the earliest free time that day in the bot.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await app.close();
}
