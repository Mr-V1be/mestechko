import { offersMessenger } from '@slotwise/domain';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { Database } from '../platform/db/database.js';
import type { IdGenerator } from '../shared/application/ports.js';
import type { BuiltCatalog } from './catalog-builder.js';
import type { GeneratedBooking } from './history-generator.js';
import {
  SEED_MAX_ID_BASE,
  SEED_TELEGRAM_ID_BASE,
  pickMaxClients,
  planMaxNotifications,
  withMaxSources,
  type WrittenBooking,
} from './messenger-clients.js';
import { writeOperations } from './operations-writer.js';
import type { DemoPerson } from './people/index.js';

const BATCH_SIZE = 400;
const MS_PER_MINUTE = 60_000;

/** Next synthetic messenger account number, shared across demo businesses. */
export interface MessengerIdCounters {
  telegram: number;
  max: number;
}

type Tx = Transaction<Database>;

function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) {
    throw new Error(`Seed data is inconsistent: missing ${what}`);
  }
  return value;
}

async function inBatches<T>(
  rows: readonly T[],
  write: (batch: T[]) => Promise<unknown>,
): Promise<void> {
  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    await write(rows.slice(index, index + BATCH_SIZE));
  }
}

async function writeCatalog(tx: Tx, catalog: BuiltCatalog, now: Date): Promise<void> {
  const businessId = catalog.businessId;
  const { definition } = catalog;
  await tx
    .insertInto('businesses')
    .values({
      id: businessId,
      slug: definition.slug,
      name: definition.name,
      verticalId: definition.verticalId,
      countryCode: definition.countryCode,
      currency: definition.currency,
      locale: definition.locale,
      rulesOverrides: JSON.stringify(definition.rulesOverrides ?? {}),
      isDemo: true,
      createdAt: now,
      updatedAt: now,
    })
    .execute();
  await tx
    .insertInto('locations')
    .values(
      catalog.locations.map(({ key: _key, ...location }) => ({
        ...location,
        businessId,
        createdAt: now,
      })),
    )
    .execute();
  await tx
    .insertInto('resources')
    .values(catalog.resources.map((resource) => ({ ...resource, businessId, createdAt: now })))
    .execute();
  await tx
    .insertInto('serviceCategories')
    .values(
      catalog.categories.map(({ key: _key, ...category }) => ({
        ...category,
        businessId,
        createdAt: now,
      })),
    )
    .execute();
  await tx
    .insertInto('services')
    .values(
      catalog.services.map(({ templateKey, ...service }) => ({
        ...service,
        templateKey,
        businessId,
        isActive: true,
        createdAt: now,
      })),
    )
    .execute();
  await tx
    .insertInto('staffMembers')
    .values(
      catalog.staff.map((member) => ({
        id: member.id,
        businessId,
        displayName: member.displayName,
        title: member.title,
        avatarSeed: member.avatarSeed,
        sortOrder: member.sortOrder,
        isActive: true,
        createdAt: now,
      })),
    )
    .execute();
  await tx
    .insertInto('staffServices')
    .values(
      catalog.staff.flatMap((member) =>
        member.terms.map((term) => ({ ...term, businessId, staffId: member.id })),
      ),
    )
    .execute();
  await tx
    .insertInto('staffSchedules')
    .values(
      catalog.staff.map((member) => ({
        id: member.schedule.id,
        businessId,
        staffId: member.id,
        locationId: member.locationId,
        patternKind: member.schedule.patternKind,
        cycleLengthDays: member.schedule.cycleLengthDays,
        anchorDate: member.schedule.anchorDate,
        validFrom: member.schedule.validFrom,
        validUntil: null,
        createdAt: now,
      })),
    )
    .execute();
  await tx
    .insertInto('staffScheduleIntervals')
    .values(
      catalog.staff.flatMap((member) =>
        member.schedule.intervals.map((interval) => ({
          ...interval,
          businessId,
          scheduleId: member.schedule.id,
        })),
      ),
    )
    .execute();
  const daysOff = catalog.staff.flatMap((member) =>
    member.daysOff.map((dayOff) => ({
      id: dayOff.id,
      businessId,
      staffId: member.id,
      onDate: dayOff.date,
      locationId: null,
      createdAt: now,
    })),
  );
  if (daysOff.length > 0) {
    await tx.insertInto('staffScheduleOverrides').values(daysOff).execute();
  }
}

async function writeClients(
  tx: Tx,
  catalog: BuiltCatalog,
  bookings: readonly GeneratedBooking[],
  people: readonly DemoPerson[],
  ids: IdGenerator,
  messengerIds: MessengerIdCounters,
  maxClients: ReadonlySet<number>,
): Promise<{ clientIds: Map<number, string>; customerIds: Map<number, string> }> {
  const clientIds = new Map<number, string>();
  const customerIds = new Map<number, string>();
  const telegramClients = new Set(
    bookings
      .filter(
        (booking) => booking.source === 'telegram_mini_app' || booking.source === 'max_mini_app',
      )
      .map((booking) => booking.clientIndex),
  );
  const firstVisit = new Map<number, Date>();
  for (const booking of bookings) {
    const known = firstVisit.get(booking.clientIndex);
    if (!known || booking.createdAt < known) {
      firstVisit.set(booking.clientIndex, booking.createdAt);
    }
  }
  const customers: { id: string; createdAt: Date }[] = [];
  const identities: {
    channel: 'telegram' | 'max';
    externalId: string;
    customerId: string;
    chatId: string | null;
    messagingAllowedAt: Date | null;
    languageTag: string;
    createdAt: Date;
  }[] = [];
  // The clients of a business speak its language in their messengers.
  const languageTag = catalog.definition.locale;
  const emulatedUsers: {
    userId: string;
    firstName: string;
    lastName: null;
    botStartedAt: Date;
    createdAt: Date;
  }[] = [];
  const clients = [...firstVisit.entries()].map(([index, createdAt]) => {
    const person = required(people[index], `person #${String(index)}`);
    const id = ids.next();
    clientIds.set(index, id);
    let customerId: string | null = null;
    if (maxClients.has(index)) {
      // They started the MAX bot, so it may write to them; the emulator knows them.
      customerId = ids.next();
      const externalId = String(SEED_MAX_ID_BASE + messengerIds.max);
      messengerIds.max += 1;
      customers.push({ id: customerId, createdAt });
      identities.push({
        channel: 'max',
        externalId,
        customerId,
        chatId: externalId,
        messagingAllowedAt: createdAt,
        languageTag,
        createdAt,
      });
      emulatedUsers.push({
        userId: externalId,
        firstName: person.displayName.split(' ')[0] ?? person.displayName,
        lastName: null,
        botStartedAt: createdAt,
        createdAt,
      });
    } else if (telegramClients.has(index)) {
      customerId = ids.next();
      customers.push({ id: customerId, createdAt });
      identities.push({
        channel: 'telegram',
        externalId: String(SEED_TELEGRAM_ID_BASE + messengerIds.telegram),
        customerId,
        chatId: null,
        messagingAllowedAt: null,
        languageTag,
        createdAt,
      });
      messengerIds.telegram += 1;
    }
    if (customerId) {
      customerIds.set(index, customerId);
    }
    return {
      id,
      businessId: catalog.businessId,
      customerId,
      displayName: person.displayName,
      phone: person.phone,
      tags: [],
      createdAt,
      updatedAt: createdAt,
    };
  });
  await inBatches(customers, (batch) => tx.insertInto('customers').values(batch).execute());
  await inBatches(identities, (batch) =>
    tx.insertInto('customerIdentities').values(batch).execute(),
  );
  await inBatches(clients, (batch) => tx.insertInto('clients').values(batch).execute());
  await inBatches(emulatedUsers, (batch) =>
    tx.insertInto('maxEmulatorUsers').values(batch).execute(),
  );
  return { clientIds, customerIds };
}

/** Cancellations happened somewhere between booking and the visit, never in the future. */
function cancellationTime(booking: GeneratedBooking, now: Date): Date {
  const midpoint = (booking.createdAt.getTime() + booking.plan.start) / 2;
  return new Date(Math.max(booking.createdAt.getTime(), Math.min(midpoint, now.getTime())));
}

async function writeBookings(
  tx: Tx,
  catalog: BuiltCatalog,
  bookings: readonly GeneratedBooking[],
  clientIds: ReadonlyMap<number, string>,
  customerIds: ReadonlyMap<number, string>,
  ids: IdGenerator,
  now: Date,
): Promise<WrittenBooking[]> {
  const businessId = catalog.businessId;
  const rows = bookings.map((booking) => ({ booking, id: ids.next() }));
  await inBatches(rows, (batch) =>
    tx
      .insertInto('bookings')
      .values(
        batch.map(({ booking, id }) => ({
          id,
          businessId,
          locationId: booking.locationId,
          clientId: required(clientIds.get(booking.clientIndex), 'client'),
          staffId: booking.staff.id,
          status: booking.status,
          holdReason: null,
          holdExpiresAt: null,
          depositMinor: 0,
          source: booking.source,
          startsAt: new Date(booking.plan.start),
          endsAt: new Date(booking.plan.end),
          totalPriceMinor: booking.totalMinor,
          currency: catalog.definition.currency,
          clientComment: booking.comment,
          idempotencyKey: null,
          version: 1,
          cancelledAt: booking.status === 'cancelled' ? cancellationTime(booking, now) : null,
          createdAt: booking.createdAt,
          updatedAt: booking.createdAt,
        })),
      )
      .execute(),
  );
  const items = rows.flatMap(({ booking, id }) =>
    booking.plan.items.map((item, position) => ({
      id: ids.next(),
      businessId,
      bookingId: id,
      status: booking.status,
      staffId: booking.staff.id,
      position,
      serviceId: item.serviceId,
      resourceId: item.resourceId,
      serviceName: required(booking.services[position], 'service').name,
      durationMinutes: (item.end - item.start) / MS_PER_MINUTE,
      priceMinor: required(booking.prices[position], 'price'),
      startsAt: new Date(item.start),
      endsAt: new Date(item.end),
      occupied: sql<string>`tstzrange(${new Date(item.occupied.start)}, ${new Date(item.occupied.end)}, '[)')`,
    })),
  );
  await inBatches(items, (batch) => tx.insertInto('bookingItems').values(batch).execute());
  return rows.map(({ booking, id }) => ({
    id,
    customerId: customerIds.get(booking.clientIndex) ?? null,
    booking,
  }));
}

/** Writes one demo business with its catalog, clients and booking history atomically. */
export async function writeDemoBusiness(
  db: Kysely<Database>,
  input: {
    readonly catalog: BuiltCatalog;
    readonly bookings: readonly GeneratedBooking[];
    readonly people: readonly DemoPerson[];
    readonly ids: IdGenerator;
    readonly now: Date;
    readonly messengerIds: MessengerIdCounters;
  },
): Promise<{ clients: number; bookings: number; maxClients: number; notifications: number }> {
  // Only a business whose clients are offered MAX has clients there.
  const maxClients = offersMessenger(input.catalog.definition.locale, 'max')
    ? pickMaxClients(input.bookings, input.now)
    : new Set<number>();
  const bookings = withMaxSources(input.bookings, maxClients);
  return db.transaction().execute(async (tx) => {
    await sql`select set_config('app.business_id', ${input.catalog.businessId}, true)`.execute(tx);
    await writeCatalog(tx, input.catalog, input.now);
    const { clientIds, customerIds } = await writeClients(
      tx,
      input.catalog,
      bookings,
      input.people,
      input.ids,
      input.messengerIds,
      maxClients,
    );
    const written = await writeBookings(
      tx,
      input.catalog,
      bookings,
      clientIds,
      customerIds,
      input.ids,
      input.now,
    );
    await writeOperations(tx, {
      catalog: input.catalog,
      written,
      clientIds,
      ids: input.ids,
      now: input.now,
    });
    const notifications = await planMaxNotifications(tx, {
      businessId: input.catalog.businessId,
      written,
      ids: input.ids,
      now: input.now,
    });
    return {
      clients: clientIds.size,
      bookings: written.length,
      maxClients: maxClients.size,
      notifications,
    };
  });
}
