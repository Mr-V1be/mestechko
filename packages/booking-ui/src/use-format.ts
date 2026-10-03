import type { Money } from '@mestechko/contracts/client';
import {
  formatCurrencySymbol,
  formatDuration,
  formatInstant,
  formatLocalDate,
  formatLocalDateRange,
  formatMoney,
  formatMoneyRange,
  type InstantStyle,
  type LocalDateStyle,
} from '@mestechko/i18n';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export interface Formatters {
  money(value: Money): string;
  moneyRange(min: Money, max: Money): string;
  /** The sign shown next to amounts people type, e.g. `₽`. */
  currencySymbol(currency: Money['currency']): string;
  /** Instants are shown in the time zone of the business location. */
  instant(value: string, timeZone: string, style: InstantStyle): string;
  localDate(value: string, style: LocalDateStyle): string;
  /** Both ends included, e.g. a vacation: `12–18 окт.`. */
  localDateRange(from: string, to: string, style: LocalDateStyle): string;
  duration(minutes: number): string;
}

export function useFormat(): Formatters {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  return useMemo(
    () => ({
      money: (value) => formatMoney(locale, value),
      moneyRange: (min, max) => formatMoneyRange(locale, min, max),
      currencySymbol: (currency) => formatCurrencySymbol(locale, currency),
      instant: (value, timeZone, style) => formatInstant(locale, value, timeZone, style),
      localDate: (value, style) => formatLocalDate(locale, value, style),
      localDateRange: (from, to, style) => formatLocalDateRange(locale, from, to, style),
      duration: (minutes) => formatDuration((key, options) => t(key, options), minutes),
    }),
    [locale, t],
  );
}
