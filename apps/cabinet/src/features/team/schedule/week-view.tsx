import { useFormat } from '@mestechko/booking-ui';
import type { DayHours, SchedulePatternView } from '@mestechko/contracts/client';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { addDays } from '../../schedule/timeline-model';
import { cycleIndex, isoWeekdays, weekdayDate } from './dates';
import { sameHours } from './hours-model';
import styles from './schedule.module.css';

/** Two weeks of a shift cycle show its rhythm. */
const CYCLE_SPAN_DAYS = 14;

interface DayCell {
  readonly key: string;
  readonly name: string;
  /** Day of the month for dated cells of a cycle. */
  readonly number: string | null;
  readonly hours: DayHours | null;
}

interface HoursGroup {
  readonly hours: DayHours;
  /** Positions in the pattern sharing these hours. */
  readonly positions: number[];
}

function groupHours(days: readonly (DayHours | null)[]): HoursGroup[] {
  const groups: HoursGroup[] = [];
  days.forEach((hours, position) => {
    if (!hours) {
      return;
    }
    const group = groups.find((candidate) => sameHours(candidate.hours, hours));
    if (group) {
      group.positions.push(position);
    } else {
      groups.push({ hours, positions: [position] });
    }
  });
  return groups;
}

/** `Пн–Пт`, `Пн, Ср, Пт`: consecutive days collapse into a range. */
function joinRuns(positions: readonly number[], name: (position: number) => string): string {
  const runs: number[][] = [];
  for (const position of positions) {
    const run = runs.at(-1);
    if (run?.at(-1) === position - 1) {
      run.push(position);
    } else {
      runs.push([position]);
    }
  }
  return runs
    .map((run) => {
      const first = run[0] ?? 0;
      const last = run.at(-1) ?? first;
      return run.length > 2 ? `${name(first)}–${name(last)}` : run.map(name).join(', ');
    })
    .join(', ');
}

/**
 * A regular schedule at a glance: which days are worked, then the hours of each group
 * of days. A weekly pattern reads Monday to Sunday; a cycle reads by date from `from`.
 */
export function WeekView({
  pattern,
  from,
}: {
  readonly pattern: SchedulePatternView;
  readonly from: string;
}) {
  const { t } = useTranslation('team');
  const format = useFormat();
  const range = (span: { start: string; end: string }) => `${span.start}–${span.end}`;
  const weekdayName = (date: string) => format.localDate(date, 'weekdayShort');
  const cells: DayCell[] =
    pattern.kind === 'weekly'
      ? isoWeekdays.map((weekday) => ({
          key: String(weekday),
          name: weekdayName(weekdayDate(weekday)),
          number: null,
          hours: pattern.days[weekday - 1] ?? null,
        }))
      : Array.from({ length: CYCLE_SPAN_DAYS }, (_, offset) => {
          const date = addDays(from, offset);
          return {
            key: date,
            name: weekdayName(date),
            number: format.localDate(date, 'dayNumber'),
            hours: pattern.days[cycleIndex(pattern.anchorDate, date, pattern.days.length)] ?? null,
          };
        });
  const groups = groupHours(pattern.days);
  const positionName = (position: number) =>
    pattern.kind === 'weekly'
      ? weekdayName(weekdayDate(position + 1))
      : t('editor.cycleDay', { n: position + 1 });

  return (
    <div className={styles.week}>
      <ol className={styles.days} aria-label={t('schedule.days')}>
        {cells.map((cell) => (
          <li key={cell.key} className={clsx(styles.day, cell.hours ? styles.work : styles.off)}>
            <span className={styles.dayName}>{cell.name}</span>
            {cell.number ? <span className={styles.dayNumber}>{cell.number}</span> : null}
            <span className="visually-hidden">
              {cell.hours ? range(cell.hours) : t('schedule.dayOff')}
            </span>
          </li>
        ))}
      </ol>
      <ul className={styles.hoursList}>
        {groups.map((group) => (
          <li key={group.positions.join()} className={styles.hoursRow}>
            {groups.length > 1 ? (
              <span className={styles.hoursDays}>{joinRuns(group.positions, positionName)}</span>
            ) : null}
            <span className={styles.hoursTime}>{range(group.hours)}</span>
            {group.hours.breaks.map((pause) => (
              <span key={pause.start} className={styles.hoursBreak}>
                {t('schedule.break', { range: range(pause) })}
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
