import { sql, type Kysely } from 'kysely';
import type { Database } from '../../../src/platform/db/database.js';
import { UuidV7Generator } from '../../../src/platform/system-clock.js';

const ids = new UuidV7Generator();

export interface TenantFixture {
  readonly businessId: string;
  readonly slug: string;
  readonly locationId: string;
  readonly staffIds: readonly string[];
  readonly serviceId: string;
  readonly resourceIds: readonly string[];
}

export const fixtureTimeZone = 'Europe/Moscow';

/**
 * A small tenant: one location open every day 09:00–21:00, staff providing a
 * 60-minute service that needs a chair, and the given number of chairs.
 */
export async function createTenant(
  admin: Kysely<Database>,
  options: { staffCount?: number; chairs?: number; verticalId?: string } = {},
): Promise<TenantFixture> {
  const now = new Date();
  const businessId = ids.next();
  const slug = `t-${businessId.slice(-12)}`;
  const locationId = ids.next();
  const categoryId = ids.next();
  const serviceId = ids.next();
  const staffIds = Array.from({ length: options.staffCount ?? 1 }, () => ids.next());
  const resourceIds = Array.from({ length: options.chairs ?? 1 }, () => ids.next());

  await admin.transaction().execute(async (tx) => {
    await sql`select set_config('app.business_id', ${businessId}, true)`.execute(tx);
    await tx
      .insertInto('businesses')
      .values({
        id: businessId,
        slug,
        name: `Fixture ${slug}`,
        verticalId: options.verticalId ?? 'beauty_salon',
        countryCode: 'RU',
        currency: 'RUB',
        locale: 'ru',
        rulesOverrides: JSON.stringify({ minLeadMinutes: 0 }),
        isDemo: false,
        createdAt: now,
        updatedAt: now,
      })
      .execute();
    await tx
      .insertInto('locations')
      .values({
        id: locationId,
        businessId,
        name: 'Main',
        address: 'Street 1',
        timeZone: fixtureTimeZone,
        sortOrder: 0,
        createdAt: now,
      })
      .execute();
    await tx
      .insertInto('resources')
      .values(
        resourceIds.map((id, index) => ({
          id,
          businessId,
          locationId,
          typeId: 'hair_chair',
          name: `Chair ${String(index)}`,
          sortOrder: index,
          createdAt: now,
        })),
      )
      .execute();
    await tx
      .insertInto('serviceCategories')
      .values({ id: categoryId, businessId, name: 'Hair', sortOrder: 0, createdAt: now })
      .execute();
    await tx
      .insertInto('services')
      .values({
        id: serviceId,
        businessId,
        categoryId,
        name: 'Haircut',
        description: null,
        durationMinutes: 60,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        priceMinor: 250_000,
        resourceTypeId: 'hair_chair',
        templateKey: null,
        sortOrder: 0,
        isActive: true,
        createdAt: now,
      })
      .execute();
    for (const [index, staffId] of staffIds.entries()) {
      const scheduleId = ids.next();
      await tx
        .insertInto('staffMembers')
        .values({
          id: staffId,
          businessId,
          displayName: `Master ${String(index)}`,
          title: null,
          avatarSeed: `seed-${String(index)}`,
          sortOrder: index,
          isActive: true,
          createdAt: now,
        })
        .execute();
      await tx
        .insertInto('staffServices')
        .values({ businessId, staffId, serviceId, durationMinutes: null, priceMinor: null })
        .execute();
      await tx
        .insertInto('staffSchedules')
        .values({
          id: scheduleId,
          businessId,
          staffId,
          locationId,
          patternKind: 'weekly',
          cycleLengthDays: 7,
          anchorDate: null,
          validFrom: '2020-01-01',
          validUntil: null,
          createdAt: now,
        })
        .execute();
      await tx
        .insertInto('staffScheduleIntervals')
        .values(
          Array.from({ length: 7 }, (_, dayIndex) => ({
            businessId,
            scheduleId,
            dayIndex,
            kind: 'work' as const,
            startMinute: 9 * 60,
            endMinute: 21 * 60,
          })),
        )
        .execute();
    }
  });
  return { businessId, slug, locationId, staffIds, serviceId, resourceIds };
}
