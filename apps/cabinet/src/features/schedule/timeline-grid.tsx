import { useFormat } from '@slotwise/booking-ui';
import { IconButton } from '@slotwise/ui';
import { clsx } from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useBlockDrag, type DropTarget } from './use-block-drag';
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
  held: styles.held,
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

const MINUTES_PER_HOUR = 60;
/** Grid a dragged block snaps to and a click on free time starts at. */
const SNAP_MINUTES = 15;

export interface TimelineEditing {
  /** Whether blocks may land in another column (staff member or day). */
  readonly acrossColumns: boolean;
  readonly onMove: (bookingId: string, target: DropTarget, from: DropTarget) => void;
  /** A click on free time of a column starts a booking there. */
  readonly onCreateAt?: (target: DropTarget) => void;
}

/** A message pinned where an action happened, e.g. why a drop was refused. */
export interface TimelineNotice extends DropTarget {
  readonly text: string;
}

export interface TimelineGridProps {
  readonly columns: readonly TimelineColumn[];
  /** What the columns are, for the pager: «Мастера», «Дни». */
  readonly columnsLabel: string;
  readonly density?: TimelineDensity;
  readonly onOpenBooking: (bookingId: string) => void;
  /** Present when the viewer may change bookings here. */
  readonly editing?: TimelineEditing | undefined;
  readonly notice?: TimelineNotice | null;
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
  editing,
  notice,
}: TimelineGridProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const scroller = useRef<HTMLDivElement>(null);
  const corner = useRef<HTMLDivElement>(null);
  const paging = useColumnPaging(
    scroller,
    corner,
    columns.map((column) => column.key),
  );
  const hours = visibleHours(columns);
  const {
    grid: dragGrid,
    preview: dragPreview,
    start: startDrag,
    wasDragged,
  } = useBlockDrag({
    enabled: editing !== undefined,
    stepMinutes: SNAP_MINUTES,
    hours,
    acrossColumns: editing?.acrossColumns ?? false,
    onDrop: (bookingId, target, from) => {
      editing?.onMove(bookingId, target, from);
    },
  });
  const durationOf = (blockId: string) => {
    const block = columns.flatMap((column) => column.blocks).find((item) => item.id === blockId);
    return block ? block.service.end - block.service.start : 0;
  };
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
          <div
            ref={dragGrid}
            className={clsx(styles.grid, dragPreview && styles.dragging)}
            style={gridStyle}
          >
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
                  {format.hourMark(hour)}
                </span>
              ))}
            </div>
            {columns.map((column) => (
              <div
                key={column.key}
                className={clsx(styles.column, editing?.onCreateAt && styles.creatable)}
                data-column-key={column.key}
                onClick={(event) => {
                  const onCreateAt = editing?.onCreateAt;
                  const target = event.target as HTMLElement;
                  // Free time only: the column itself or a working-hours band, not a booking.
                  // A drag that ends over free time also clicks there, which is not a request.
                  if (
                    !onCreateAt ||
                    wasDragged() ||
                    (target !== event.currentTarget && !target.hasAttribute('data-free-time'))
                  ) {
                    return;
                  }
                  const rect = event.currentTarget.getBoundingClientRect();
                  const minute =
                    hours.from * MINUTES_PER_HOUR +
                    ((event.clientY - rect.top) / rect.height) *
                      (hours.to - hours.from) *
                      MINUTES_PER_HOUR;
                  onCreateAt({
                    columnKey: column.key,
                    minute: Math.floor(minute / SNAP_MINUTES) * SNAP_MINUTES,
                  });
                }}
              >
                {column.working.map((range) => (
                  <div
                    key={`w-${String(range.start)}`}
                    className={styles.working}
                    style={place(range)}
                    aria-hidden="true"
                    data-free-time=""
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
                      className={clsx(
                        styles.block,
                        blockStatusClass[block.status],
                        density,
                        editing && block.movable && styles.draggable,
                        dragPreview?.blockId === block.id && styles.lifted,
                      )}
                      style={place(block.service)}
                      aria-label={t('schedule.bookingLabel', {
                        time: block.timeLabel,
                        client: block.client,
                        services: block.services,
                      })}
                      onPointerDown={(event) => {
                        startDrag(event, block, column.key);
                      }}
                      onClick={() => {
                        if (!wasDragged()) {
                          onOpenBooking(block.id);
                        }
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
                {dragPreview?.columnKey === column.key ? (
                  <div
                    className={styles.ghost}
                    style={place({
                      start: dragPreview.minute,
                      end: dragPreview.minute + durationOf(dragPreview.blockId),
                    })}
                    aria-hidden="true"
                  >
                    {format.wallTimeRange(
                      dragPreview.minute,
                      dragPreview.minute + durationOf(dragPreview.blockId),
                    )}
                  </div>
                ) : null}
                {notice?.columnKey === column.key ? (
                  <div
                    className={styles.notice}
                    style={place({ start: notice.minute, end: notice.minute })}
                    role="alert"
                  >
                    {notice.text}
                  </div>
                ) : null}
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
