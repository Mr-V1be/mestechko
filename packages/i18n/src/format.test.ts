import { describe, expect, it } from 'vitest';
import { createI18n } from './create-i18n.js';
import {
  formatCurrencySymbol,
  formatDuration,
  formatHourMark,
  formatInstant,
  formatLocalDate,
  formatMoney,
  formatMoneyCompact,
  formatMoneyRange,
  formatNumber,
  formatShare,
  formatInstantRange,
  formatWallTime,
  formatWallTimeRange,
} from './format.js';

describe('formatting', () => {
  it('formats roubles without kopecks when whole', () => {
    expect(formatMoney('ru', { amountMinor: 250_000, currency: 'RUB' })).toBe('2 500 ₽');
    expect(formatMoney('ru', { amountMinor: 250_050, currency: 'RUB' })).toBe('2 500,50 ₽');
    expect(
      formatMoneyRange(
        'ru',
        { amountMinor: 470_000, currency: 'RUB' },
        { amountMinor: 530_000, currency: 'RUB' },
      ),
    ).toMatch(/^4\s700\s?–\s?5\s300\s₽$/u);
  });

  it('formats compact sums, shares and signed changes', () => {
    expect(formatMoneyCompact('ru', { amountMinor: 1_200_000, currency: 'RUB' })).toMatch(
      /^12\sтыс\.\s₽$/u,
    );
    expect(formatShare('ru', 0.587)).toMatch(/^59\s%$/u);
    expect(formatShare('ru', 0.0563, { fractionDigits: 1 })).toMatch(/^5,6\s%$/u);
    expect(formatNumber('ru', 2.25, { fractionDigits: 1, signed: true })).toBe('+2,3');
    expect(formatNumber('ru', 0, { signed: true })).toBe('0');
  });

  it('shows instants in the time zone of the location', () => {
    expect(formatInstant('ru', '2026-03-02T03:00:00Z', 'Asia/Novosibirsk', 'time')).toBe('10:00');
    expect(formatLocalDate('ru', '2026-03-02', 'dayMonth')).toBe('2 марта');
  });

  it('spells durations in the language of the reader', async () => {
    const i18n = await createI18n({
      locale: 'ru',
      preload: ['en'],
      defaultNamespace: 'common',
    });
    const ru = i18n.getFixedT('ru') as (key: string, options: { count: number }) => string;
    expect(formatDuration(ru, 90)).toBe('1 ч 30 мин');
    expect(formatDuration(ru, 45)).toBe('45 мин');
    expect(formatDuration(ru, 120)).toBe('2 ч');
    const en = i18n.getFixedT('en') as (key: string, options: { count: number }) => string;
    expect(formatDuration(en, 90)).toBe('1 h 30 min');
  });
});

describe('the organisation currency', () => {
  const dollars = (amountMinor: number) => ({ amountMinor, currency: 'USD' as const });

  it('is kept whatever language the amount is read in', () => {
    expect(formatMoney('en', dollars(8_500))).toBe('$85');
    expect(formatMoney('en', dollars(8_550))).toBe('$85.50');
    expect(formatMoney('ru', dollars(8_500))).toMatch(/^85\s\$$/u);
    expect(formatMoney('en', { amountMinor: 250_000, currency: 'RUB' })).toMatch(/^RUB\s2,500$/u);
  });

  it('formats ranges, compact sums and the sign people type next to', () => {
    expect(formatMoneyRange('en', dollars(8_500), dollars(11_000))).toMatch(/^\$85\s?–\s?\$110$/u);
    expect(formatMoneyRange('en', dollars(8_500), dollars(8_500))).toBe('$85');
    expect(formatMoneyCompact('en', dollars(1_200_000))).toBe('$12K');
    expect(formatCurrencySymbol('en', 'USD')).toBe('$');
    expect(formatCurrencySymbol('ru', 'RUB')).toBe('₽');
  });

  it('shows times of a US location on its own clock, written the way each language writes them', () => {
    expect(formatInstant('en', '2026-03-02T15:00:00Z', 'America/New_York', 'time')).toMatch(
      /^10:00\sAM$/u,
    );
    expect(formatInstant('en', '2026-03-02T14:05:00Z', 'America/New_York', 'time')).toMatch(
      /^9:05\sAM$/u,
    );
    expect(formatInstant('ru', '2026-03-02T06:05:00Z', 'Europe/Moscow', 'time')).toBe('09:05');
    expect(formatWallTime('en', 13 * 60 + 30)).toMatch(/^1:30\sPM$/u);
    expect(formatWallTime('ru', 9 * 60)).toBe('09:00');
    expect(formatWallTimeRange('ru', 600, 690)).toBe('10:00–11:30');
    expect(formatHourMark('ru', 11)).toBe('11:00');
    expect(formatHourMark('en', 13)).toMatch(/^1\sPM$/u);
    expect(formatWallTimeRange('en', 600, 690)).toMatch(/^10:00\s–\s11:30\sAM$/u);
    expect(
      formatInstantRange(
        'en',
        '2026-03-02T15:00:00Z',
        '2026-03-02T18:45:00Z',
        'America/New_York',
        'time',
      ),
    ).toMatch(/^10:00\sAM\s–\s1:45\sPM$/u);
    expect(formatLocalDate('en', '2026-03-02', 'dayMonth')).toBe('March 2');
  });
});
