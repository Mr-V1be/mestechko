import { randomUUID } from 'node:crypto';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { readSheet } from 'read-excel-file/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, cabinetHeaders, enableDemoSignIn } from './support/cabinet-session.js';
import { createTestApp } from './support/test-app.js';
import { createTenant, type TenantFixture } from './support/tenant-fixture.js';
import { openTestDatabases, type TestDatabases } from './support/test-database.js';

interface Card {
  client: { id: string; displayName: string; phone: string | null; tags: string[] };
  notes: { body: string; authorName: string | null }[];
}

describe('client CRM', () => {
  let app: NestFastifyApplication;
  let databases: TestDatabases;
  let tenant: TenantFixture;
  let headers: Record<string, string>;

  const url = (path: string) => `/v1/cabinet/businesses/${tenant.businessId}${path}`;

  beforeAll(async () => {
    databases = openTestDatabases();
    app = await createTestApp();
    tenant = await createTenant(databases.admin);
    await enableDemoSignIn(databases.admin, tenant);
    await addMember(databases.admin, tenant, 'owner', 'Владелец Анна');
    headers = await cabinetHeaders(app, tenant, 'owner');
  });

  afterAll(async () => {
    await app.close();
    await databases.destroy();
  });

  it('keeps cards with tags and notes, one per phone', async () => {
    const created = await app.inject({
      method: 'POST',
      url: url('/clients'),
      headers,
      payload: {
        displayName: 'Вера Соколова',
        phone: '+70004120501',
        email: null,
        tags: ['VIP', ' vip ', 'Окрашивание'],
      },
    });
    expect(created.statusCode).toBe(201);
    const card = created.json<Card>();
    expect(card.client.tags).toEqual(['VIP', 'Окрашивание']);

    const duplicate = await app.inject({
      method: 'POST',
      url: url('/clients'),
      headers,
      payload: { displayName: 'Вера', phone: '+70004120501', email: null, tags: [] },
    });
    expect(
      duplicate.json<{ error: { details: { fields: object } } }>().error.details.fields,
    ).toEqual({
      phone: 'taken',
    });

    await app.inject({
      method: 'POST',
      url: url(`/clients/${card.client.id}/notes`),
      headers,
      payload: { body: 'Аллергия на аммиак' },
    });
    const reread = await app.inject({
      method: 'GET',
      url: url(`/clients/${card.client.id}`),
      headers,
    });
    expect(reread.json<Card>().notes).toEqual([
      expect.objectContaining({ body: 'Аллергия на аммиак', authorName: 'Владелец Анна' }),
    ]);

    const byTag = await app.inject({ method: 'GET', url: url('/clients?tag=VIP'), headers });
    expect(byTag.json<{ items: { id: string }[] }>().items.map((item) => item.id)).toEqual([
      card.client.id,
    ]);
    const byPhone = await app.inject({
      method: 'GET',
      url: url('/clients?search=412-05'),
      headers,
    });
    expect(byPhone.json<{ items: unknown[] }>().items).toHaveLength(1);
  });

  it('imports a CSV, checking it first, and exports everyone to Excel', async () => {
    const csv = [
      'Имя;Телефон;Теги;Заметка',
      'Вера С.;8 000 412-05-01;Постоянная;Любит утро',
      'Новый клиент;+7 000 412 05 02;;',
      ';+7 000 412 05 03;;',
      'Ошибка в номере;12345;;',
    ].join('\n');
    const upload = (dryRun: boolean) =>
      app.inject({
        method: 'POST',
        url: url(`/clients/import?dryRun=${String(dryRun)}`),
        headers: { ...headers, 'content-type': 'text/csv' },
        payload: Buffer.from(`\uFEFF${csv}`, 'utf8'),
      });

    const checked = await upload(true);
    expect(checked.json()).toEqual({
      created: 1,
      updated: 1,
      rejected: [
        { row: 4, reason: 'missing_name' },
        { row: 5, reason: 'invalid_phone' },
      ],
      applied: false,
    });
    const applied = await upload(false);
    expect(applied.json<{ applied: boolean }>().applied).toBe(true);

    const vera = await app.inject({ method: 'GET', url: url('/clients?search=Вера'), headers });
    const [found] = vera.json<{ items: { displayName: string; tags: string[] }[] }>().items;
    expect(found).toMatchObject({
      displayName: 'Вера С.',
      tags: ['VIP', 'Окрашивание', 'Постоянная'],
    });

    const exported = await app.inject({
      method: 'GET',
      url: url('/clients/export?format=xlsx'),
      headers,
    });
    expect(exported.headers['content-disposition']).toContain('attachment');
    const rows = await readSheet(exported.rawPayload);
    expect(rows[0]?.[0]).toBe('Имя');
    expect(
      rows
        .slice(1)
        .map((row) => row[0])
        .sort(),
    ).toEqual(['Вера С.', 'Новый клиент']);
  });

  it('sells a pass whose visits and price land in the ledger', async () => {
    const plan = await app.inject({
      method: 'POST',
      url: url('/loyalty/plans'),
      headers,
      payload: {
        name: '5 стрижек',
        visits: 5,
        validityDays: 90,
        priceMinor: 1_000_000,
        serviceIds: [tenant.serviceId],
        isActive: true,
      },
    });
    expect(plan.statusCode).toBe(201);
    const client = await app.inject({ method: 'GET', url: url('/clients?search=Новый'), headers });
    const clientId = client.json<{ items: { id: string }[] }>().items[0]?.id ?? '';
    const key = randomUUID();
    const sell = () =>
      app.inject({
        method: 'POST',
        url: url(`/clients/${clientId}/passes`),
        headers: { ...headers, 'idempotency-key': key },
        payload: { planId: plan.json<{ id: string }>().id },
      });
    await sell();
    const card = (await sell()).json<{
      loyalty: { passes: { visitsLeft: number }[]; ledger: { reason: string; amount: number }[] };
    }>();
    expect(card.loyalty.passes).toEqual([expect.objectContaining({ visitsLeft: 5 })]);
    expect(card.loyalty.ledger.map((entry) => [entry.reason, entry.amount]).sort()).toEqual([
      ['pass_payment', 1_000_000],
      ['pass_sale', 5],
    ]);
  });
});
