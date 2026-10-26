import { useFormat } from '@slotwise/booking-ui';
import { useTranslation } from 'react-i18next';
import { localDateOf, todayIn } from '../schedule/timeline-model';

const YEAR_LENGTH = 4;

/**
 * Dates of visits, notes and passes in the business's time zone: «29 сентября» this
 * year, «29 сентября 2025 г.» otherwise, so an old visit never reads as a recent one.
 */
export function useClientDates(timeZone: string) {
  const { t } = useTranslation();
  const format = useFormat();
  const today = todayIn(timeZone);
  const thisYear = (localDate: string) =>
    localDate.slice(0, YEAR_LENGTH) === today.slice(0, YEAR_LENGTH);
  const day = (instant: string) =>
    format.instant(
      instant,
      timeZone,
      thisYear(localDateOf(instant, timeZone)) ? 'dayMonth' : 'dayMonthYear',
    );
  return {
    /** Today's calendar date in the business's time zone, `YYYY-MM-DD`. */
    today,
    day,
    dayTime: (instant: string) =>
      t('clients:dayTime', { day: day(instant), time: format.instant(instant, timeZone, 'time') }),
    /** A calendar date (`YYYY-MM-DD`), e.g. the last day of a pass. */
    date: (localDate: string) =>
      format.localDate(localDate, thisYear(localDate) ? 'dayMonth' : 'dayMonthYear'),
  };
}
