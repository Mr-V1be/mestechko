import { Temporal } from '@mestechko/domain';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_USER_BASE, book, launchAs, slotsOn } from './support/booking-client.js';
import { addMember, cabinetHeaders, enableDemoSignIn } from './support/cabinet-session.js';
import { localStart } from './support/local-time.js';
import { createTestApp } from './support/test-app.js';
import { createTenant, fixtureTimeZone, type TenantFixture } from './support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from './support/test-database.js';

const dayIn = (days: number) => Temporal.Now.plainDateISO(fixtureTimeZone).add({ days }).toString();

describe('team schedules and the catalog', () => {
  let app: NestFastifyApplication;
  let databases: TestDatabases;
  let tenant: TenantFixture;
  let headers: Record<string, string>;
  let staffId = '';

  const cabinet = (method: 'GET' | 'POST' | 'PUT' | 'PATCH', path: string, payload?: object) =>
    app.inject({
      method,
      url: `/v1/cabinet/businesses/${tenant.businessId}${path}`,
      headers,
      ...(payload ? { payload } : {}),
    });

  beforeAll(async () => {
    databases = openTestDatabases();
    app = await createTestApp();
    tenant = await createTenant(databases.admin, { staffCount: 1, chairs: 1 });
    staffId = tenant.staffIds[0] ?? '';
    await enableDemoSignIn(databases.admin, tenant);
    await addMember(databases.admin, tenant, 'owner', 'Владелец');
    headers = await cabinetHeaders(app, tenant, 'owner');
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('shows which visits a vacation would affect and saves it only once confirmed', async () => {
    const initData = await launchAs(app, tenant.slug, DEMO_USER_BASE + 900);
    const booked = await book(app, tenant, { initData, start: localStart(3, '12:00'), staffId });
    expect(booked.statusCode).toBe(201);
    const change = { type: 'absence', kind: 'vacation', from: dayIn(2), to: dayIn(5) };

    const preview = await cabinet('POST', `/team/${staffId}/schedule-changes/preview`, { change });
    const affected = preview.json<{ affected: { bookingId: string; clientName: string }[] }>()
      .affected;
    expect(affected).toEqual([
      expect.objectContaining({
        bookingId: booked.json<{ id: string }>().id,
        clientName: 'Клиент',
      }),
    ]);

    const unconfirmed = await cabinet('POST', `/team/${staffId}/schedule-changes`, {
      change,
      acknowledgedAffected: 0,
    });
    expect(unconfirmed.json<{ error: { code: string } }>().error.code).toBe('impact_changed');

    const applied = await cabinet('POST', `/team/${staffId}/schedule-changes`, {
      change,
      acknowledgedAffected: 1,
    });
    expect(applied.statusCode).toBe(200);
    expect(applied.json<{ member: { absences: { kind: string }[] } }>().member.absences).toEqual([
      expect.objectContaining({ kind: 'vacation', from: dayIn(2), to: dayIn(5) }),
    ]);
    expect(await slotsOn(app, tenant, dayIn(4), staffId)).toEqual([]);
  });

  it('applies a 2/2 schedule from a date and keeps earlier days', async () => {
    const pattern = {
      kind: 'template',
      template: 'two_two',
      hours: { start: '10:00', end: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
      weekdays: [],
      anchorDate: dayIn(10),
    };
    const change = {
      type: 'pattern',
      locationId: tenant.locationId,
      pattern,
      validFrom: dayIn(10),
    };
    const applied = await cabinet('POST', `/team/${staffId}/schedule-changes`, {
      change,
      acknowledgedAffected: 0,
    });
    expect(applied.statusCode).toBe(200);
    const member = applied.json<{
      member: {
        assignments: {
          validFrom: string;
          validUntil: string | null;
          pattern: { kind: string; days: unknown[] };
        }[];
      };
    }>().member;
    expect(member.assignments.at(-1)).toMatchObject({
      validFrom: dayIn(10),
      validUntil: null,
      pattern: {
        kind: 'cycle',
        days: [
          { start: '10:00', end: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
          { start: '10:00', end: '18:00', breaks: [{ start: '13:00', end: '14:00' }] },
          null,
          null,
        ],
      },
    });
    expect(await slotsOn(app, tenant, dayIn(12), staffId)).toEqual([]);
    expect((await slotsOn(app, tenant, dayIn(10), staffId)).length).toBeGreaterThan(0);
    expect((await slotsOn(app, tenant, dayIn(9), staffId)).length).toBeGreaterThan(0);
  });

  it('refuses booking services the business never books together', async () => {
    const created = await cabinet('POST', '/catalog/services', {
      categoryId: (
        await databases.admin
          .selectFrom('services')
          .select('categoryId')
          .where('id', '=', tenant.serviceId)
          .executeTakeFirstOrThrow()
      ).categoryId,
      name: 'Химическая завивка',
      description: null,
      durationMinutes: 90,
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 15,
      priceMinor: 400_000,
      resourceTypeId: 'hair_chair',
      depositPercent: null,
    });
    expect(created.statusCode).toBe(201);
    const perm = created.json<{ id: string }>().id;
    await cabinet('PUT', `/catalog/services/${perm}/staff`, {
      staff: [{ staffId, durationMinutes: 75, priceMinor: 380_000 }],
    });
    const marked = await cabinet('PUT', `/catalog/services/${perm}/incompatible`, {
      serviceIds: [tenant.serviceId],
    });
    expect(marked.json<{ incompatibleWith: string[]; staff: unknown[] }>()).toMatchObject({
      incompatibleWith: [tenant.serviceId],
      staff: [{ staffId, durationMinutes: 75, price: { amountMinor: 380_000 } }],
    });

    const services = await app.inject({
      method: 'GET',
      url: `/v1/public/businesses/${tenant.slug}/services?locationId=${tenant.locationId}`,
    });
    expect(services.json<{ incompatible: unknown[] }>().incompatible).toHaveLength(1);
    const together = await app.inject({
      method: 'GET',
      url: `/v1/public/businesses/${tenant.slug}/availability?locationId=${tenant.locationId}&serviceIds=${tenant.serviceId},${perm}&from=${dayIn(1)}&to=${dayIn(1)}`,
    });
    expect(together.json<{ error: { details: { reason: string } } }>().error.details.reason).toBe(
      'incompatible_services',
    );
  });
});
