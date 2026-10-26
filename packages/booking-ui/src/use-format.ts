import type { Money } from '@slotwise/contracts/client';
import {
  formatCurrencySymbol,
  formatDuration,
  formatHourMark,
  formatInstant,
  formatLocalDate,
  formatLocalDateRange,
  formatMoney,
  formatMoneyCompact,
  formatMoneyRange,
  formatNumber,
  formatShare,
  formatInstantRange,
  formatWallTime,
  formatWallTimeRange,
  type InstantStyle,
  type LocalDateStyle,
  type NumberStyle,
} from '@slotwise/i18n';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export interface Formatters {
  money(value: Money): string;
  /** `12 тыс. ₽`, `$12K`: for axes and tight places where the order of the sum is enough. */
  moneyCompact(value: Money): string;
  moneyRange(min: Money, max: Money): string;
  /** The sign shown next to amounts people type, e.g. `₽` or `$`. */
  currencySymbol(currency: Money['currency']): string;
  number(value: number, style?: NumberStyle): string;
  /** A share of a whole (`0.587`) as percent. */
  share(value: number, style?: NumberStyle): string;
  /** Instants are shown in the time zone of the business location. */
  instant(value: string, timeZone: string, style: InstantStyle): string;
  /** A span between instants, shared parts written once: `10:00–11:30`, `10:00 – 11:30 AM`. */
  instantRange(start: string, end: string, timeZone: string, style: InstantStyle): string;
  /** A time of day in minutes after midnight, e.g. an hour mark of the schedule. */
  wallTime(minuteOfDay: number): string;
  wallTimeRange(from: number, to: number): string;
  /** An hour mark of a timeline: `11:00`, or `11 AM` on a 12-hour clock. */
  hourMark(hour: number): string;
  localDate(value: string, style: LocalDateStyle): string;
  /** Both ends included, e.g. a vacation: `12–18 окт.`, `Oct 12 – 18`. */
  localDateRange(from: string, to: string, style: LocalDateStyle): string;
  duration(minutes: number): string;
}

export function useFormat(): Formatters {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  return useMemo(
    () => ({
      money: (value) => formatMoney(locale, value),
      moneyCompact: (value) => formatMoneyCompact(locale, value),
      moneyRange: (min, max) => formatMoneyRange(locale, min, max),
      currencySymbol: (currency) => formatCurrencySymbol(locale, currency),
      number: (value, style) => formatNumber(locale, value, style),
      share: (value, style) => formatShare(locale, value, style),
      instant: (value, timeZone, style) => formatInstant(locale, value, timeZone, style),
      instantRange: (start, end, timeZone, style) =>
        formatInstantRange(locale, start, end, timeZone, style),
      wallTime: (minuteOfDay) => formatWallTime(locale, minuteOfDay),
      wallTimeRange: (from, to) => formatWallTimeRange(locale, from, to),
      hourMark: (hour) => formatHourMark(locale, hour),
      localDate: (value, style) => formatLocalDate(locale, value, style),
      localDateRange: (from, to, style) => formatLocalDateRange(locale, from, to, style),
      duration: (minutes) => formatDuration((key, options) => t(key, options), minutes),
    }),
    [locale, t],
  );
}
