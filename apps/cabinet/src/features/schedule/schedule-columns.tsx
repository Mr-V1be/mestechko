import { apiAssetUrl, useVocabulary, type Formatters } from '@mestechko/booking-ui';
import type {
  getSchedule,
  RouteResult,
  ScheduleColumn,
  VerticalSummary,
} from '@mestechko/contracts/client';
import { Avatar } from '@mestechko/ui';
import { clsx } from 'clsx';
import { Armchair } from 'lucide-react';
import { appConfig } from '../../app/config';
import { addDays, nowMinuteIfToday, rangeOn, toBlock, type TimelineColumn } from './timeline-model';
import styles from './schedule.module.css';

type Schedule = RouteResult<typeof getSchedule>;

const WEEK_DAYS = 7;

export function ColumnHeader({
  column,
  vertical,
}: {
  readonly column: ScheduleColumn;
  readonly vertical: VerticalSummary;
}) {
  const vocabulary = useVocabulary(vertical);
  const subtitle = column.typeTerm ? vocabulary.resourceType(column.typeTerm) : column.subtitle;
  return (
    <div className={styles.columnHeader}>
      {column.avatarUrl ? (
        <Avatar
          name={column.title}
          src={apiAssetUrl(appConfig.apiBaseUrl, column.avatarUrl)}
          size="sm"
        />
      ) : (
        <span className={styles.resourceIcon}>
          <Armchair aria-hidden="true" />
        </span>
      )}
      <div className={styles.columnText}>
        <p className={styles.columnTitle} title={column.title}>
          {column.title}
        </p>
        {subtitle ? <p className={styles.columnSubtitle}>{subtitle}</p> : null}
      </div>
    </div>
  );
}

function columnOn(
  schedule: Schedule,
  columnId: string,
  date: string,
  format: Formatters,
  now: Date,
): Omit<TimelineColumn, 'key' | 'header'> {
  return {
    working: schedule.workingHours
      .filter((entry) => entry.columnId === columnId && entry.date === date)
      .flatMap((entry) =>
        entry.intervals.map((interval) => rangeOn(date, interval, schedule.timeZone)),
      ),
    blocks: schedule.bookings
      .filter((booking) => booking.columnId === columnId)
      .map((booking) => toBlock(booking, date, schedule.timeZone, format))
      .filter((block) => block.service.end > block.service.start),
    nowMinute: nowMinuteIfToday(date, schedule.timeZone, now),
  };
}

/** Day view: one column per staff member or resource. */
export function dayColumns(
  schedule: Schedule,
  date: string,
  vertical: VerticalSummary,
  format: Formatters,
  now: Date,
  only: string | null,
): TimelineColumn[] {
  return schedule.columns
    .filter((column) => only === null || column.id === only)
    .map((column) => ({
      key: column.id,
      header: <ColumnHeader column={column} vertical={vertical} />,
      ...columnOn(schedule, column.id, date, format, now),
    }));
}

/** Week view: seven day columns of one staff member or resource. */
export function weekColumns(
  schedule: Schedule,
  weekStart: string,
  columnId: string,
  format: Formatters,
  now: Date,
): TimelineColumn[] {
  return Array.from({ length: WEEK_DAYS }, (_, index) => {
    const date = addDays(weekStart, index);
    const column = columnOn(schedule, columnId, date, format, now);
    return {
      key: date,
      header: (
        <div className={clsx(styles.dayHeader, column.nowMinute !== null && styles.dayHeaderToday)}>
          <span className={styles.dayName}>{format.localDate(date, 'weekdayShort')}</span>
          <span className={styles.dayNumber}>{format.localDate(date, 'dayNumber')}</span>
        </div>
      ),
      ...column,
    };
  });
}
