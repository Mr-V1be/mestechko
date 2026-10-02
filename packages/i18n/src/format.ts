import { currencies, type Money } from '@mestechko/domain';

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
  'time' | 'dayNumber' | 'monthShort' | 'dayMonth' | 'weekdayShort' | 'weekdayDayMonth' | 'full';

const instantStyles: Record<InstantStyle, Intl.DateTimeFormatOptions> = {
  time: { hour: '2-digit', minute: '2-digit' },
  dayNumber: { day: 'numeric' },
  monthShort: { month: 'short' },
  dayMonth: { day: 'numeric', month: 'long' },
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
  'dayMonth' | 'weekdayShort' | 'weekdayDayMonth' | 'monthYear' | 'dayNumber';

const localDateStyles: Record<LocalDateStyle, Intl.DateTimeFormatOptions> = {
  dayMonth: { day: 'numeric', month: 'long' },
  weekdayShort: { weekday: 'short' },
  weekdayDayMonth: { weekday: 'long', day: 'numeric', month: 'long' },
  monthYear: { month: 'long', year: 'numeric' },
  dayNumber: { day: 'numeric' },
};

export function formatLocalDate(locale: string, isoDate: string, style: LocalDateStyle): string {
  return dateFormatter(locale, { ...localDateStyles[style], timeZone: 'UTC' }).format(
    new Date(`${isoDate}T12:00:00Z`),
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
