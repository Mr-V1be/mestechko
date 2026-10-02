import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

/** Custom property registered in timeline.module.css so it resolves to pixels. */
const COLUMN_MIN_PROPERTY = '--timeline-column-min';
/** Sub-pixel slack when comparing scroll positions. */
const EDGE_EPSILON = 1;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

export interface ColumnPaging {
  /** Width that makes a whole number of columns fill the view; null when all fit. */
  readonly columnWidth: number | null;
  /** First and last fully visible columns, 1-based. */
  readonly first: number;
  readonly last: number;
  readonly canBack: boolean;
  readonly canForward: boolean;
  readonly page: (direction: -1 | 1) => void;
}

interface Geometry {
  readonly perView: number;
  readonly columnWidth: number | null;
}

interface Position {
  readonly first: number;
  readonly canBack: boolean;
  readonly canForward: boolean;
}

const START: Position = { first: 0, canBack: false, canForward: false };

/**
 * Fits a whole number of columns into the scroller and pages through the rest, so a
 * timeline never ends in a sliced column: the view always shows complete columns,
 * snaps to them and reports which edges still have more.
 */
export function useColumnPaging(
  scroller: RefObject<HTMLElement | null>,
  axis: RefObject<HTMLElement | null>,
  columnKeys: readonly string[],
): ColumnPaging {
  const count = columnKeys.length;
  // Another set of columns (other week, other axis) starts from its first column.
  const identity = columnKeys.join('|');
  useLayoutEffect(() => {
    scroller.current?.scrollTo({ left: 0 });
  }, [scroller, identity]);

  const [geometry, setGeometry] = useState<Geometry>({ perView: count, columnWidth: null });
  const [position, setPosition] = useState<Position>(START);

  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) {
      return undefined;
    }
    const measure = () => {
      const minimum = Number.parseFloat(
        getComputedStyle(element).getPropertyValue(COLUMN_MIN_PROPERTY),
      );
      const available = element.clientWidth - (axis.current?.offsetWidth ?? 0);
      if (!(minimum > 0) || available <= 0) {
        return;
      }
      const perView = Math.max(1, Math.min(count, Math.floor(available / minimum)));
      setGeometry({ perView, columnWidth: perView < count ? available / perView : null });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [scroller, axis, count]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) {
      return undefined;
    }
    let frame = 0;
    const track = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const width = geometry.columnWidth;
        setPosition({
          first: width ? Math.round(element.scrollLeft / width) : 0,
          canBack: element.scrollLeft > EDGE_EPSILON,
          canForward: element.scrollLeft + element.clientWidth < element.scrollWidth - EDGE_EPSILON,
        });
      });
    };
    track();
    element.addEventListener('scroll', track, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      element.removeEventListener('scroll', track);
    };
  }, [scroller, geometry.columnWidth]);

  const page = (direction: -1 | 1) => {
    const element = scroller.current;
    if (!element || geometry.columnWidth === null) {
      return;
    }
    element.scrollBy({
      left: direction * geometry.perView * geometry.columnWidth,
      behavior: window.matchMedia(REDUCED_MOTION).matches ? 'auto' : 'smooth',
    });
  };

  const first = Math.min(position.first, Math.max(0, count - geometry.perView));
  return {
    columnWidth: geometry.columnWidth,
    first: first + 1,
    last: Math.min(count, first + geometry.perView),
    canBack: geometry.columnWidth !== null && position.canBack,
    canForward: geometry.columnWidth !== null && position.canForward,
    page,
  };
}
