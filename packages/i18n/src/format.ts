import { currencies, type CurrencyCode, type Money } from '@mestechko/domain';

const MINUTES_PER_HOUR = 60;
const formatterCache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

function cached<T extends Intl.DateTimeFormat | Intl.NumberFormat>(key: string, build: () => T): T {
  const existing = formatterCache.get(key);
  if (existing) {
    return existing as T;
  }
  const created = build();
  formatterCache.set(key, created);
  return created;
}

function dateFormatter(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return cached(
    `d|${locale}|${JSON.stringify(options)}`,
    () => new Intl.DateTimeFormat(locale, options),
  );
}

/** Instants are always shown in the time zone of the business location. */
export type InstantStyle =
  | 'time'
  | 'dayNumber'
  | 'monthShort'
  | 'dayMonth'
  | 'dayMonthYear'
  | 'weekdayShort'
  | 'weekdayDayMonth'
  | 'full';

const instantStyles: Record<InstantStyle, Intl.DateTimeFormatOptions> = {
  time: { hour: '2-digit', minute: '2-digit' },
  dayNumber: { day: 'numeric' },
  monthShort: { month: 'short' },
  dayMonth: { day: 'numeric', month: 'long' },
  /** For dates outside the current year, where the day and month alone mislead. */
  dayMonthYear: { day: 'numeric', month: 'long', year: 'numeric' },
  weekdayShort: { weekday: 'short' },
  weekdayDayMonth: { weekday: 'short', day: 'numeric', month: 'long' },
  full: { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' },
};

export function formatInstant(
  locale: string,
  instant: string | number,
  timeZone: string,
  style: InstantStyle,
): string {
  return dateFormatter(locale, { ...instantStyles[style], timeZone }).format(new Date(instant));
}

/** Local calendar dates (`YYYY-MM-DD`) have no time zone of their own. */
export type LocalDateStyle =
  | 'dayMonth'
  | 'dayMonthShort'
  | 'dayMonthYear'
  | 'weekdayShort'
  | 'weekdayLong'
  | 'weekdayDayMonth'
  | 'monthYear'
  | 'dayNumber';

const localDateStyles: Record<LocalDateStyle, Intl.DateTimeFormatOptions> = {
  dayMonth: { day: 'numeric', month: 'long' },
  dayMonthShort: { day: 'numeric', month: 'short' },
  dayMonthYear: { day: 'numeric', month: 'long', year: 'numeric' },
  weekdayShort: { weekday: 'short' },
  weekdayLong: { weekday: 'long' },
  weekdayDayMonth: { weekday: 'long', day: 'numeric', month: 'long' },
  monthYear: { month: 'long', year: 'numeric' },
  dayNumber: { day: 'numeric' },
};

export function formatLocalDate(locale: string, isoDate: string, style: LocalDateStyle): string {
  return dateFormatter(locale, { ...localDateStyles[style], timeZone: 'UTC' }).format(
    new Date(`${isoDate}T12:00:00Z`),
  );
}

/** `12–18 окт.`: shared parts of both dates are written once; one date when they match. */
export function formatLocalDateRange(
  locale: string,
  from: string,
  to: string,
  style: LocalDateStyle,
): string {
  return dateFormatter(locale, { ...localDateStyles[style], timeZone: 'UTC' }).formatRange(
    new Date(`${from}T12:00:00Z`),
    new Date(`${to}T12:00:00Z`),
  );
}

export function formatMoney(locale: string, value: Money): string {
  const digits = currencies[value.currency].minorUnitDigits;
  const amount = value.amountMinor / 10 ** digits;
  const fractionDigits = Number.isInteger(amount) ? 0 : digits;
  const formatter = cached(
    `m|${locale}|${value.currency}|${String(fractionDigits)}`,
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: value.currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
  );
  return formatter.format(amount);
}

/** The sign people see next to amounts they type, e.g. `₽`. */
export function formatCurrencySymbol(locale: string, currency: CurrencyCode): string {
  const formatter = cached(
    `s|${locale}|${currency}`,
    () => new Intl.NumberFormat(locale, { style: 'currency', currency }),
  );
  return formatter.formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency;
}

/** `4 700–5 300 ₽`: one currency sign for the whole range. */
export function formatMoneyRange(locale: string, min: Money, max: Money): string {
  if (min.amountMinor === max.amountMinor) {
    return formatMoney(locale, min);
  }
  const digits = currencies[min.currency].minorUnitDigits;
  const lower = min.amountMinor / 10 ** digits;
  const upper = max.amountMinor / 10 ** digits;
  const fractionDigits = Number.isInteger(lower) && Number.isInteger(upper) ? 0 : digits;
  return cached(
    `m|${locale}|${min.currency}|${String(fractionDigits)}`,
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: min.currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }),
  ).formatRange(lower, upper);
}

type CountTranslator = (key: string, options: { count: number }) => string;

/** `90` → `1 ч 30 мин` using the `common:duration` plurals. */
export function formatDuration(t: CountTranslator, totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  return [
    hours > 0 ? t('common:duration.hours', { count: hours }) : null,
    minutes > 0 || hours === 0 ? t('common:duration.minutes', { count: minutes }) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' ');
}
