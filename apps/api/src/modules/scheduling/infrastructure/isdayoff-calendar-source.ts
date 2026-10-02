import { calendarYear, type CalendarDayKind, type CalendarYear } from '@mestechko/domain';
import type { ProductionCalendarSource } from '../application/ports.js';

/**
 * isdayoff.ru answers with one digit per day. With `pre=1&holiday=1`:
 * 0 working, 1 day off, 2 shortened pre-holiday day, 4 working (special regime),
 * 8 public holiday. https://isdayoff.ru/extapi/
 */
const kindByDigit: Readonly<Record<string, CalendarDayKind>> = {
  '0': 'working',
  '1': 'non_working',
  '2': 'pre_holiday',
  '4': 'working',
  '8': 'public_holiday',
};

export class ProviderResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderResponseError';
  }
}

export class IsDayOffCalendarSource implements ProductionCalendarSource {
  readonly name = 'isdayoff.ru';

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  async fetchYear(countryCode: string, year: number): Promise<CalendarYear> {
    const url = new URL('/api/getdata', this.baseUrl);
    url.search = new URLSearchParams({
      year: String(year),
      cc: countryCode.toLowerCase(),
      pre: '1',
      holiday: '1',
    }).toString();
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(this.timeoutMs) });
    const body = (await response.text()).trim();
    if (!response.ok) {
      throw new ProviderResponseError(
        `isdayoff.ru responded ${String(response.status)}: ${body.slice(0, 20)}`,
      );
    }
    const days = body.split('').map((digit) => {
      const kind = kindByDigit[digit];
      if (!kind) {
        throw new ProviderResponseError(`Unexpected day code "${digit}" from isdayoff.ru`);
      }
      return kind;
    });
    return calendarYear(year, days);
  }
}
