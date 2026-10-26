import type { Formatters } from '@slotwise/booking-ui';
import type { TFunction } from 'i18next';
import { addDays, localDateOf, todayIn } from '@slotwise/booking-ui';

/** "сегодня в 15:45", "завтра в 10:00" or "пн, 6 октября в 10:00" in the location's zone. */
export function describeWhen(
  t: TFunction,
  format: Formatters,
  instant: string,
  timeZone: string,
): string {
  const time = format.instant(instant, timeZone, 'time');
  const date = localDateOf(instant, timeZone);
  const today = todayIn(timeZone);
  if (date === today) {
    return t('when.today', { time });
  }
  if (date === addDays(today, 1)) {
    return t('when.tomorrow', { time });
  }
  return t('when.date', { date: format.instant(instant, timeZone, 'weekdayDayMonth'), time });
}
