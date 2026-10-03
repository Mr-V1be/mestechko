import type { Money } from '@mestechko/contracts/client';
import {
  formatDuration,
  formatInstant,
  formatLocalDate,
  formatMoney,
  formatMoneyCompact,
  formatMoneyRange,
  formatNumber,
  formatShare,
  type InstantStyle,
  type LocalDateStyle,
  type NumberStyle,
} from '@mestechko/i18n';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export interface Formatters {
  money(value: Money): string;
  /** `12 тыс. ₽`: for axes and tight places where the order of the sum is enough. */
  moneyCompact(value: Money): string;
  moneyRange(min: Money, max: Money): string;
  number(value: number, style?: NumberStyle): string;
  /** A share of a whole (`0.587`) as percent. */
  share(value: number, style?: NumberStyle): string;
  /** Instants are shown in the time zone of the business location. */
  instant(value: string, timeZone: string, style: InstantStyle): string;
  localDate(value: string, style: LocalDateStyle): string;
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
      number: (value, style) => formatNumber(locale, value, style),
      share: (value, style) => formatShare(locale, value, style),
      instant: (value, timeZone, style) => formatInstant(locale, value, timeZone, style),
      localDate: (value, style) => formatLocalDate(locale, value, style),
      duration: (minutes) => formatDuration((key, options) => t(key, options), minutes),
    }),
    [locale, t],
  );
}
