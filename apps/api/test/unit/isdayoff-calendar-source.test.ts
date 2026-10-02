import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  IsDayOffCalendarSource,
  ProviderResponseError,
} from '../../src/modules/scheduling/infrastructure/isdayoff-calendar-source.js';

const responses = new Map<string, { status: number; body: string; delayMs?: number }>();
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const answer = responses.get(url.searchParams.get('year') ?? '') ?? {
      status: 404,
      body: '101',
    };
    setTimeout(() => {
      response.writeHead(answer.status, { 'content-type': 'text/plain' });
      response.end(answer.body);
    }, answer.delayMs ?? 0);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe('isdayoff.ru adapter', () => {
  it('maps day codes including holidays and shortened days', async () => {
    const days = `${'8'.repeat(8)}${'0'.repeat(10)}2${'1'.repeat(346)}`;
    responses.set('2026', { status: 200, body: days });
    const calendar = await new IsDayOffCalendarSource(baseUrl, 1_000).fetchYear('RU', 2026);
    expect(calendar.days[0]).toBe('public_holiday');
    expect(calendar.days[8]).toBe('working');
    expect(calendar.days[18]).toBe('pre_holiday');
    expect(calendar.days[19]).toBe('non_working');
  });

  it('rejects error responses, unknown codes and incomplete years', async () => {
    const source = new IsDayOffCalendarSource(baseUrl, 1_000);
    await expect(source.fetchYear('RU', 2030)).rejects.toBeInstanceOf(ProviderResponseError);
    responses.set('2031', { status: 200, body: '7'.repeat(365) });
    await expect(source.fetchYear('RU', 2031)).rejects.toBeInstanceOf(ProviderResponseError);
    responses.set('2032', { status: 200, body: '0'.repeat(365) });
    await expect(source.fetchYear('RU', 2032)).rejects.toMatchObject({ code: 'invalid_calendar' });
  });

  it('gives up after the timeout', async () => {
    responses.set('2033', { status: 200, body: '0'.repeat(365), delayMs: 500 });
    await expect(
      new IsDayOffCalendarSource(baseUrl, 50).fetchYear('RU', 2033),
    ).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });
});
