import { bookingStatuses, bookingStatusIds, roleIds, type BookingStatus } from '@mestechko/domain';
import { sql } from 'kysely';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { UuidV7Generator } from '../../../src/platform/system-clock.js';
import { createTenant, type TenantFixture } from '../support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from '../support/test-database.js';

const ids = new UuidV7Generator();
const HOUR_MS = 3_600_000;

async function enumValues(databases: TestDatabases, type: string): Promise<string[]> {
  const result = await sql<{ value: string }>`
    select e.enumlabel as value from pg_enum e join pg_type t on t.oid = e.enumtypid
    where t.typname = ${type} order by e.enumsortorder
  `.execute(databases.admin);
  return result.rows.map((row) => row.value);
}

describe('database invariants match the domain registries', () => {
  let databases: TestDatabases;
  let tenant: TenantFixture;
  let clientId: string;

  beforeAll(async () => {
    databases = openTestDatabases();
    tenant = await createTenant(databases.admin, { staffCount: 2, chairs: 1 });
    clientId = ids.next();
    await databases.admin
      .insertInto('clients')
      .values({
        id: clientId,
        businessId: tenant.businessId,
        customerId: null,
        displayName: 'Client',
        phone: null,
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .execute();
  });

  afterAll(async () => {
    await databases.destroy();
  });

  async function insertBooking(
    status: BookingStatus,
    start: number,
    resourceId: string | null,
    staffIndex = 0,
  ): Promise<void> {
    const bookingId = ids.next();
    const staffId = tenant.staffIds[staffIndex] ?? '';
    await databases.admin.transaction().execute(async (tx) => {
      await tx
        .insertInto('bookings')
        .values({
          id: bookingId,
          businessId: tenant.businessId,
          locationId: tenant.locationId,
          clientId,
          staffId,
          status,
          holdReason: status === 'held' ? 'payment' : null,
          holdExpiresAt: status === 'held' ? new Date(start) : null,
          depositMinor: 0,
          source: 'cabinet',
          startsAt: new Date(start),
          endsAt: new Date(start + HOUR_MS),
          totalPriceMinor: 0,
          currency: 'RUB',
          clientComment: null,
          idempotencyKey: null,
          version: 1,
          cancelledAt: status === 'cancelled' ? new Date() : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .execute();
      await tx
        .insertInto('bookingItems')
        .values({
          id: ids.next(),
          businessId: tenant.businessId,
          bookingId,
          status,
          staffId,
          position: 0,
          serviceId: tenant.serviceId,
          resourceId,
          serviceName: 'Haircut',
          durationMinutes: 60,
          priceMinor: 0,
          startsAt: new Date(start),
          endsAt: new Date(start + HOUR_MS),
          occupied: sql<string>`tstzrange(${new Date(start)}, ${new Date(start + HOUR_MS)}, '[)')`,
        })
        .execute();
    });
  }

  it('stores exactly the statuses and roles the domain knows', async () => {
    expect(await enumValues(databases, 'booking_status')).toEqual([...bookingStatusIds]);
    expect(await enumValues(databases, 'membership_role')).toEqual([...roleIds]);
  });

  it.each(bookingStatusIds)(
    'lets "%s" block staff time exactly when the domain says it occupies time',
    async (status) => {
      const start = Date.UTC(2031, 0, 1 + bookingStatusIds.indexOf(status), 10);
      await insertBooking(status, start, null);
      const overlapping = insertBooking('confirmed', start + HOUR_MS / 2, null);
      if (bookingStatuses[status].occupiesTime) {
        await expect(overlapping).rejects.toMatchObject({ code: '23P01' });
      } else {
        await expect(overlapping).resolves.toBeUndefined();
      }
    },
  );

  it('never double-books a resource and allows back-to-back use', async () => {
    const start = Date.UTC(2031, 1, 1, 10);
    const chair = tenant.resourceIds[0] ?? null;
    await insertBooking('confirmed', start, chair, 0);
    await expect(insertBooking('confirmed', start + HOUR_MS / 2, chair, 1)).rejects.toMatchObject({
      code: '23P01',
    });
    await expect(insertBooking('confirmed', start + HOUR_MS, chair, 1)).resolves.toBeUndefined();
  });

  it('keeps item status in sync with its booking through the database', async () => {
    const start = Date.UTC(2031, 2, 1, 10);
    await insertBooking('confirmed', start, null);
    const booking = await databases.admin
      .selectFrom('bookings')
      .select('id')
      .where('businessId', '=', tenant.businessId)
      .where('startsAt', '=', new Date(start))
      .executeTakeFirstOrThrow();
    await databases.admin
      .updateTable('bookings')
      .set({ status: 'cancelled', cancelledAt: new Date() })
      .where('id', '=', booking.id)
      .execute();
    const item = await databases.admin
      .selectFrom('bookingItems')
      .select('status')
      .where('bookingId', '=', booking.id)
      .executeTakeFirstOrThrow();
    expect(item.status).toBe('cancelled');
    await expect(insertBooking('confirmed', start, null)).resolves.toBeUndefined();
  });

  it('rejects two schedules of one person on the same dates', async () => {
    const insert = databases.admin
      .insertInto('staffSchedules')
      .values({
        id: ids.next(),
        businessId: tenant.businessId,
        staffId: tenant.staffIds[0] ?? '',
        locationId: tenant.locationId,
        patternKind: 'weekly',
        cycleLengthDays: 7,
        anchorDate: null,
        validFrom: '2030-01-01',
        validUntil: null,
        createdAt: new Date(),
      })
      .execute();
    await expect(insert).rejects.toMatchObject({ code: '23P01' });
  });
});
