import type { Money } from '@mestechko/contracts/client';
import type { CurrencyCode } from '@mestechko/domain';
import {
  formatCurrencySign,
  formatDuration,
  formatInstant,
  formatLocalDate,
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
  /** `₽` beside an amount field. */
  currencySign(currency: CurrencyCode): string;
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
      moneyRange: (min, max) => formatMoneyRange(locale, min, max),
      currencySign: (currency) => formatCurrencySign(locale, currency),
      instant: (value, timeZone, style) => formatInstant(locale, value, timeZone, style),
      localDate: (value, style) => formatLocalDate(locale, value, style),
      duration: (minutes) => formatDuration((key, options) => t(key, options), minutes),
    }),
    [locale, t],
  );
}
