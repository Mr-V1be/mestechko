import { IconButton } from '@mestechko/ui';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { visibleHours, type MinuteRange, type TimelineColumn } from './timeline-model';
import { useColumnPaging } from './use-column-paging';
import styles from './timeline.module.css';

/** Short visits show less: one line below 35 minutes, two lines below 55. */
const blockDensities = [
  { below: 35, className: styles.compact },
  { below: 55, className: styles.medium },
] as const;

function densityOf(minutes: number): string | undefined {
  return blockDensities.find((density) => minutes < density.below)?.className;
}

const blockStatusClass: Readonly<Record<string, string | undefined>> = {
  confirmed: styles.confirmed,
  completed: styles.completed,
  no_show: styles.no_show,
  cancelled: styles.cancelled,
};

function place(range: MinuteRange): CSSProperties {
  return { '--start': range.start, '--end': range.end } as CSSProperties;
}

/** How narrow a column may get: day columns of one person pack tighter. */
export type TimelineDensity = 'regular' | 'compact';

export interface TimelineGridProps {
  readonly columns: readonly TimelineColumn[];
  /** What the columns are, for the pager: «Мастера», «Дни». */
  readonly columnsLabel: string;
  readonly density?: TimelineDensity;
  readonly onOpenBooking: (bookingId: string) => void;
}

/**
 * Day columns on a shared time axis; positions come from minutes, sizes from tokens.
 * When the columns do not fit, the view shows whole columns only and pages through
 * the rest: the time axis stays put, the edges fade and a pager says what is shown.
 */
export function TimelineGrid({
  columns,
  columnsLabel,
  density = 'regular',
  onOpenBooking,
}: TimelineGridProps) {
  const { t } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);
  const corner = useRef<HTMLDivElement>(null);
  const paging = useColumnPaging(
    scroller,
    corner,
    columns.map((column) => column.key),
  );
  const hours = visibleHours(columns);
  const gridStyle = {
    '--columns': columns.length,
    '--hours': hours.to - hours.from,
    '--from': hours.from * 60,
    ...(paging.columnWidth === null ? {} : { '--column-width': `${String(paging.columnWidth)}px` }),
  } as CSSProperties;
  const hourMarks = Array.from({ length: hours.to - hours.from }, (_, index) => hours.from + index);
  const paged = paging.columnWidth !== null;
  return (
    <div className={styles.board}>
      {paged ? (
        <div className={styles.pager}>
          <span className={styles.pagerRange} aria-live="polite">
            {t('schedule.shownColumns', {
              what: columnsLabel,
              from: paging.first,
              to: paging.last,
              total: columns.length,
            })}
          </span>
          <IconButton
            label={t('schedule.previousColumns')}
            icon={<ChevronLeft />}
            soft
            disabled={!paging.canBack}
            onClick={() => {
              paging.page(-1);
            }}
          />
          <IconButton
            label={t('schedule.nextColumns')}
            icon={<ChevronRight />}
            soft
            disabled={!paging.canForward}
            onClick={() => {
              paging.page(1);
            }}
          />
        </div>
      ) : null}
      <div
        className={clsx(
          styles.frame,
          density === 'compact' && styles.compactColumns,
          paged && styles.paged,
          paging.canBack && styles.moreBefore,
          paging.canForward && styles.moreAfter,
        )}
      >
        <div ref={scroller} className={styles.scroller}>
          <div className={styles.grid} style={gridStyle}>
            <div ref={corner} className={styles.corner} />
            {columns.map((column) => (
              <div key={column.key} className={styles.header}>
                {column.header}
              </div>
            ))}
            <div className={styles.axis} aria-hidden="true">
              {hourMarks.map((hour, index) => (
                <span
                  key={hour}
                  className={styles.hourLabel}
                  style={{ '--offset': index } as CSSProperties}
                >
                  {`${String(hour).padStart(2, '0')}:00`}
                </span>
              ))}
            </div>
            {columns.map((column) => (
              <div key={column.key} className={styles.column}>
                {column.working.map((range) => (
                  <div
                    key={`w-${String(range.start)}`}
                    className={styles.working}
                    style={place(range)}
                  />
                ))}
                {column.blocks.map((block) => (
                  <div
                    key={`o-${block.id}`}
                    className={styles.occupied}
                    style={place(block.occupied)}
                  />
                ))}
                {column.blocks.map((block) => {
                  const density = densityOf(block.service.end - block.service.start);
                  const compact = density === styles.compact;
                  return (
                    <button
                      key={block.id}
                      type="button"
                      className={clsx(styles.block, blockStatusClass[block.status], density)}
                      style={place(block.service)}
                      aria-label={t('schedule.bookingLabel', {
                        time: block.timeLabel,
                        client: block.client,
                        services: block.services,
                      })}
                      onClick={() => {
                        onOpenBooking(block.id);
                      }}
                    >
                      <span className={styles.blockTime}>
                        {compact ? block.startLabel : block.timeLabel}
                      </span>
                      <span className={styles.blockClient}>{block.client}</span>
                      <span className={styles.blockServices}>{block.services}</span>
                    </button>
                  );
                })}
                {column.nowMinute !== null ? (
                  <div
                    className={styles.now}
                    style={place({ start: column.nowMinute, end: column.nowMinute })}
                    aria-label={t('schedule.now')}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <span aria-hidden="true" className={clsx(styles.edge, styles.edgeStart)} />
        <span aria-hidden="true" className={clsx(styles.edge, styles.edgeEnd)} />
      </div>
    </div>
  );
}
