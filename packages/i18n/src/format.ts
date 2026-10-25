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

/** 09:05 UTC: its hour shows whether the locale pads hours with a zero. */
const SINGLE_DIGIT_HOUR = new Date(Date.UTC(2000, 0, 1, 9, 5));

/**
 * How the locale writes the hour of a time: `09:05` in Russian, `9:05 AM` in English.
 * Read from the locale's own short time style, so every language gets its native form.
 */
function nativeHour(locale: string): Intl.DateTimeFormatOptions['hour'] {
  const hour = dateFormatter(locale, { timeStyle: 'short', timeZone: 'UTC' })
    .formatToParts(SINGLE_DIGIT_HOUR)
    .find((part) => part.type === 'hour')?.value;
  return hour?.length === 2 ? '2-digit' : 'numeric';
}

/** The style's options with times written the way the locale writes them. */
function inLocale(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions {
  return options.hour === undefined ? options : { ...options, hour: nativeHour(locale) };
}

export function formatInstant(
  locale: string,
  instant: string | number,
  timeZone: string,
  style: InstantStyle,
): string {
  return dateFormatter(locale, { ...inLocale(locale, instantStyles[style]), timeZone }).format(
    new Date(instant),
  );
}

/**
 * A span between two instants, written once where both ends share parts: `10:00–11:30`
 * in Russian, `10:00 – 11:30 AM` in English.
 */
export function formatInstantRange(
  locale: string,
  start: string | number,
  end: string | number,
  timeZone: string,
  style: InstantStyle,
): string {
  return dateFormatter(locale, { ...inLocale(locale, instantStyles[style]), timeZone }).formatRange(
    new Date(start),
    new Date(end),
  );
}

const MS_PER_MINUTE = 60_000;

function wallTimeFormatter(locale: string): Intl.DateTimeFormat {
  return dateFormatter(locale, { ...inLocale(locale, instantStyles.time), timeZone: 'UTC' });
}

/** A time of day given in minutes after midnight, as the locale writes times: `09:30`, `9:30 AM`. */
export function formatWallTime(locale: string, minuteOfDay: number): string {
  return wallTimeFormatter(locale).format(new Date(minuteOfDay * MS_PER_MINUTE));
}

const MS_PER_HOUR = 60 * MS_PER_MINUTE;

/** Whether the locale tells time on a 12-hour clock with AM and PM. */
function usesTwelveHours(locale: string): boolean {
  return dateFormatter(locale, { timeStyle: 'short', timeZone: 'UTC' })
    .formatToParts(SINGLE_DIGIT_HOUR)
    .some((part) => part.type === 'dayPeriod');
}

/** An hour mark of a timeline, as calendars write it: `11:00` on a 24-hour clock, `11 AM` on a 12-hour one. */
export function formatHourMark(locale: string, hour: number): string {
  return usesTwelveHours(locale)
    ? dateFormatter(locale, { hour: 'numeric', timeZone: 'UTC' }).format(
        new Date(hour * MS_PER_HOUR),
      )
    : formatWallTime(locale, hour * (MS_PER_HOUR / MS_PER_MINUTE));
}

/** A span of the day in minutes after midnight: `10:00–11:30`, `10:00 – 11:30 AM`. */
export function formatWallTimeRange(locale: string, from: number, to: number): string {
  return wallTimeFormatter(locale).formatRange(
    new Date(from * MS_PER_MINUTE),
    new Date(to * MS_PER_MINUTE),
  );
}

/** Local calendar dates (`YYYY-MM-DD`) have no time zone of their own. */
export type LocalDateStyle =
  | 'dayMonth'
  | 'dayMonthShort'
  | 'dayMonthYear'
  | 'dayMonthNumeric'
  | 'weekdayShort'
  | 'weekdayLong'
  | 'weekdayDayMonth'
  | 'weekdayDayMonthShort'
  | 'monthYear'
  | 'dayNumber';

const localDateStyles: Record<LocalDateStyle, Intl.DateTimeFormatOptions> = {
  dayMonth: { day: 'numeric', month: 'long' },
  dayMonthShort: { day: 'numeric', month: 'short' },
  dayMonthYear: { day: 'numeric', month: 'long', year: 'numeric' },
  dayMonthNumeric: { day: '2-digit', month: '2-digit' },
  weekdayShort: { weekday: 'short' },
  weekdayLong: { weekday: 'long' },
  weekdayDayMonth: { weekday: 'long', day: 'numeric', month: 'long' },
  weekdayDayMonthShort: { weekday: 'short', day: 'numeric', month: 'short' },
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

/** `12 тыс. ₽`, `1,4 млн ₽`: sums where the order matters more than kopecks, e.g. axes. */
export function formatMoneyCompact(locale: string, value: Money): string {
  const amount = value.amountMinor / 10 ** currencies[value.currency].minorUnitDigits;
  return cached(
    `mc|${locale}|${value.currency}`,
    () =>
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: value.currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      }),
  ).format(amount);
}

export interface NumberStyle {
  /** Exactly this many digits after the separator. */
  readonly fractionDigits?: number;
  /** `+3` and `−3` for changes; zero stays unsigned. */
  readonly signed?: boolean;
}

function numberFormatter(locale: string, kind: 'decimal' | 'percent', style: NumberStyle) {
  const digits = style.fractionDigits ?? 0;
  const signed = style.signed ?? false;
  return cached(
    `n|${locale}|${kind}|${String(digits)}|${String(signed)}`,
    () =>
      new Intl.NumberFormat(locale, {
        style: kind,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
        signDisplay: signed ? 'exceptZero' : 'auto',
      }),
  );
}

/** `1 234`, `+2,5`: grouped in the way of the locale. */
export function formatNumber(locale: string, value: number, style: NumberStyle = {}): string {
  return numberFormatter(locale, 'decimal', style).format(value);
}

/** A share of a whole, `0.587` → `59 %`. */
export function formatShare(locale: string, share: number, style: NumberStyle = {}): string {
  return numberFormatter(locale, 'percent', style).format(share);
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
