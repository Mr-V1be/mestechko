import { clsx } from 'clsx';
import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { visibleHours, type MinuteRange, type TimelineColumn } from './timeline-model';
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

export interface TimelineGridProps {
  readonly columns: readonly TimelineColumn[];
  readonly onOpenBooking: (bookingId: string) => void;
}

/** Day columns on a shared time axis; positions come from minutes, sizes from tokens. */
export function TimelineGrid({ columns, onOpenBooking }: TimelineGridProps) {
  const { t } = useTranslation();
  const hours = visibleHours(columns);
  const gridStyle = {
    '--columns': columns.length,
    '--hours': hours.to - hours.from,
    '--from': hours.from * 60,
  } as CSSProperties;
  const hourMarks = Array.from({ length: hours.to - hours.from }, (_, index) => hours.from + index);
  return (
    <div className={styles.scroller}>
      <div className={styles.grid} style={gridStyle}>
        <div className={styles.corner} />
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
  );
}
