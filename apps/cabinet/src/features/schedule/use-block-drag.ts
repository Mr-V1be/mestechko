import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { TimelineBlock } from './timeline-model';

const MINUTES_PER_HOUR = 60;
/** Pointer travel before a press becomes a drag, so a click still opens the booking. */
const DRAG_THRESHOLD_PX = 5;

export interface DropTarget {
  readonly columnKey: string;
  readonly minute: number;
}

export interface DragPreview extends DropTarget {
  readonly blockId: string;
  readonly duration: number;
}

interface Gesture {
  readonly block: TimelineBlock;
  readonly originColumn: string;
  readonly startX: number;
  readonly startY: number;
  /** Minutes between the block's start and where it was grabbed. */
  readonly grabOffset: number;
  readonly columns: readonly { readonly key: string; readonly rect: DOMRect }[];
  moved: boolean;
}

export interface BlockDragOptions {
  readonly enabled: boolean;
  readonly stepMinutes: number;
  readonly hours: { readonly from: number; readonly to: number };
  /** Whether a block may land in another column (another staff member or day). */
  readonly acrossColumns: boolean;
  readonly onDrop: (blockId: string, target: DropTarget, from: DropTarget) => void;
}

function minuteAt(y: number, rect: DOMRect, hours: BlockDragOptions['hours']): number {
  const span = (hours.to - hours.from) * MINUTES_PER_HOUR;
  return hours.from * MINUTES_PER_HOUR + ((y - rect.top) / rect.height) * span;
}

/**
 * Drags booking blocks with a mouse or pen across time and columns, snapping to the
 * grid; touch keeps scrolling and tapping. Escape cancels a drag in progress.
 */
export function useBlockDrag(options: BlockDragOptions) {
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const suppressClick = useRef(false);
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    const targetOf = (event: PointerEvent, current: Gesture): DropTarget => {
      const { hours, stepMinutes, acrossColumns } = latest.current;
      const column =
        (acrossColumns
          ? current.columns.find(
              (candidate) =>
                event.clientX >= candidate.rect.left && event.clientX < candidate.rect.right,
            )
          : undefined) ??
        current.columns.find((candidate) => candidate.key === current.originColumn);
      const rect = column?.rect ?? current.columns[0]?.rect;
      const duration = current.block.service.end - current.block.service.start;
      const raw = rect ? minuteAt(event.clientY, rect, hours) - current.grabOffset : 0;
      const snapped = Math.round(raw / stepMinutes) * stepMinutes;
      const minute = Math.min(
        Math.max(snapped, hours.from * MINUTES_PER_HOUR),
        hours.to * MINUTES_PER_HOUR - duration,
      );
      return { columnKey: column?.key ?? current.originColumn, minute };
    };
    const move = (event: PointerEvent) => {
      const current = gesture.current;
      if (!current) {
        return;
      }
      if (
        !current.moved &&
        Math.hypot(event.clientX - current.startX, event.clientY - current.startY) <
          DRAG_THRESHOLD_PX
      ) {
        return;
      }
      current.moved = true;
      setPreview({
        ...targetOf(event, current),
        blockId: current.block.id,
        duration: current.block.service.end - current.block.service.start,
      });
    };
    const end = (event: PointerEvent) => {
      const current = gesture.current;
      gesture.current = null;
      setPreview(null);
      if (!current?.moved) {
        return;
      }
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
      const target = targetOf(event, current);
      const from = { columnKey: current.originColumn, minute: current.block.service.start };
      if (target.columnKey !== from.columnKey || target.minute !== from.minute) {
        latest.current.onDrop(current.block.id, target, from);
      }
    };
    const cancel = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && gesture.current) {
        gesture.current = null;
        setPreview(null);
      }
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('keydown', cancel);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('keydown', cancel);
    };
  }, []);

  const start = (event: ReactPointerEvent, block: TimelineBlock, columnKey: string) => {
    if (!options.enabled || event.pointerType === 'touch' || event.button !== 0 || !block.movable) {
      return;
    }
    const columns = [
      ...(grid.current?.querySelectorAll<HTMLElement>('[data-column-key]') ?? []),
    ].map((element) => ({
      key: element.dataset.columnKey ?? '',
      rect: element.getBoundingClientRect(),
    }));
    const origin = columns.find((column) => column.key === columnKey);
    if (!origin) {
      return;
    }
    event.preventDefault();
    gesture.current = {
      block,
      originColumn: columnKey,
      startX: event.clientX,
      startY: event.clientY,
      grabOffset: minuteAt(event.clientY, origin.rect, options.hours) - block.service.start,
      columns,
      moved: false,
    };
  };

  return {
    grid,
    preview,
    start,
    /** A drag ended on this press: the click it makes must not open the booking. */
    wasDragged: () => suppressClick.current,
  };
}
