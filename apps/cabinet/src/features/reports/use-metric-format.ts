import { useFormat } from '@mestechko/booking-ui';
import {
  reportMetrics,
  type CurrencyCode,
  type MetricChange,
  type ReportMetric,
} from '@mestechko/domain';
import { useTranslation } from 'react-i18next';
import type { AmountKind } from './metric-views';

const SHARE_DIGITS = 1;
const PERCENT = 100;
const MINUTES_PER_HOUR = 60;
/** Periods longer than a month label days with their month, `04.09`. */
const DAY_NUMBER_LIMIT = 31;

export interface ChangeView {
  readonly text: string;
  readonly direction: 'up' | 'down' | 'flat';
  readonly good: boolean | null;
}

/** `-0` reads as zero. */
const rounded = (value: number, digits: number) =>
  Math.round(value * 10 ** digits) / 10 ** digits || 0;

/** Report figures in the words and units of the cabinet. */
export function useMetricFormat(currency: CurrencyCode) {
  const { t } = useTranslation();
  const format = useFormat();
  const isMoney = (metric: ReportMetric) => reportMetrics[metric].unit === 'money';

  return {
    /** Full value for tiles and tables. */
    value(metric: ReportMetric, value: number | null): string {
      if (value === null) {
        return t('reports:noValue');
      }
      return isMoney(metric)
        ? format.money({ amountMinor: value, currency })
        : format.share(value, { fractionDigits: SHARE_DIGITS });
    },

    /** Short value for chart ticks and tooltips. */
    axis(metric: ReportMetric): (value: number) => string {
      return isMoney(metric)
        ? (value) => format.moneyCompact({ amountMinor: value, currency })
        : (value) => format.share(value);
    },

    /** A part or the whole of a share: booked hours, visits. */
    amount(kind: AmountKind, amount: number): string {
      return kind === 'hours'
        ? t('reports:units.hours', {
            value: format.number(amount / MINUTES_PER_HOUR, { fractionDigits: SHARE_DIGITS }),
          })
        : format.number(amount);
    },

    /** Shares change in percentage points, money in percent of before. */
    change(change: MetricChange | null): ChangeView | null {
      if (!change) {
        return null;
      }
      const points = change.measure === 'points';
      const shown = points
        ? rounded(change.amount * PERCENT, SHARE_DIGITS)
        : rounded(change.amount * PERCENT, 0);
      const direction = shown === 0 ? 'flat' : shown > 0 ? 'up' : 'down';
      return {
        text: points
          ? t('reports:delta.points', {
              value: format.number(shown, { fractionDigits: SHARE_DIGITS, signed: true }),
            })
          : t('reports:delta.percent', { value: format.number(shown, { signed: true }) }),
        direction,
        good: direction === 'flat' ? null : change.improved,
      };
    },

    /** Label under a bar: the day, with its month once a period spans months. */
    dayLabel(date: string, periodDays: number): string {
      return format.localDate(
        date,
        periodDays > DAY_NUMBER_LIMIT ? 'dayMonthNumeric' : 'dayNumber',
      );
    },

    dayTitle(date: string): string {
      return format.localDate(date, 'weekdayDayMonth');
    },

    dayShort(date: string): string {
      return format.localDate(date, 'weekdayDayMonthShort');
    },
  };
}

export type MetricFormat = ReturnType<typeof useMetricFormat>;
