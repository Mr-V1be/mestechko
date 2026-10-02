import { BookingStatusBadge, useFormat } from '@mestechko/booking-ui';
import type { getSchedule, RouteResult } from '@mestechko/contracts/client';
import { ListGroup, ListItem } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import { addDays, localDateOf } from './timeline-model';
import styles from './schedule.module.css';

type Schedule = RouteResult<typeof getSchedule>;

const WEEK_DAYS = 7;

/** A week as a list of days: the phone-sized alternative to a seven-column grid. */
export function AgendaList({
  schedule,
  weekStart,
  columnId,
  onOpenBooking,
}: {
  readonly schedule: Schedule;
  readonly weekStart: string;
  readonly columnId: string;
  readonly onOpenBooking: (bookingId: string) => void;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const time = (instant: string) => format.instant(instant, schedule.timeZone, 'time');
  return (
    <div className={styles.agenda}>
      {Array.from({ length: WEEK_DAYS }, (_, index) => {
        const date = addDays(weekStart, index);
        const working = schedule.workingHours.some(
          (entry) =>
            entry.columnId === columnId && entry.date === date && entry.intervals.length > 0,
        );
        const bookings = schedule.bookings.filter(
          (booking) =>
            booking.columnId === columnId && localDateOf(booking.start, schedule.timeZone) === date,
        );
        return (
          <ListGroup key={date} title={format.localDate(date, 'weekdayDayMonth')}>
            {bookings.length === 0 ? (
              <ListItem title={working ? t('schedule.emptyTitle') : t('schedule.dayOff')} />
            ) : (
              bookings.map((booking) => (
                <ListItem
                  key={booking.id}
                  leading={<span className={styles.agendaTime}>{time(booking.start)}</span>}
                  title={booking.clientName}
                  description={booking.serviceNames.join(', ')}
                  trailing={<BookingStatusBadge status={booking.status} />}
                  onClick={() => {
                    onOpenBooking(booking.id);
                  }}
                />
              ))
            )}
          </ListGroup>
        );
      })}
    </div>
  );
}
