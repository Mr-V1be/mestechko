import { describe, expect, it } from 'vitest';
import { createI18n } from './create-i18n.js';
import {
  formatDuration,
  formatInstant,
  formatLocalDate,
  formatMoney,
  formatMoneyCompact,
  formatMoneyRange,
  formatNumber,
  formatShare,
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

  it('spells durations with Russian plurals', async () => {
    const i18n = await createI18n({ defaultNamespace: 'common' });
    const t = i18n.t.bind(i18n) as (key: string, options: { count: number }) => string;
    expect(formatDuration(t, 90)).toBe('1 ч 30 мин');
    expect(formatDuration(t, 45)).toBe('45 мин');
    expect(formatDuration(t, 120)).toBe('2 ч');
  });
});
