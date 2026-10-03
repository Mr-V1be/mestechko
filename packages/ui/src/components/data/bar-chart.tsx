import { clsx } from 'clsx';
import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import styles from './data.module.css';

export interface BarPoint {
  readonly key: string;
  /** Short label under the bar, e.g. a day number. */
  readonly label: string;
  /** Full label for the tooltip, e.g. a weekday and date. */
  readonly title: string;
  /** `null` when there is nothing to show, e.g. a share of zero working time. */
  readonly value: number | null;
}

export interface BarChartProps {
  /** What the chart shows, for assistive technology. */
  readonly label: string;
  readonly points: readonly BarPoint[];
  readonly format: (value: number) => string;
  /** Top of the scale when it is fixed, e.g. 1 for shares; otherwise from the data. */
  readonly max?: number;
  readonly emptyLabel: string;
}

/** Room for value ticks before they are measured; then the widest tick sets it. */
const INITIAL_GUTTER = 56;
const TICK_GAP = 8;
const AXIS_HEIGHT = 24;
const TOP_PADDING = 8;
const TICKS = 4;
const MIN_LABEL_SPACE = 36;
const LABEL_GAP = 12;
const BAR_GAP_SHARE = 0.28;
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

/** A round step so that ticks read 0, 2 500, 5 000… instead of 0, 2 371, 4 742… */
function niceStep(range: number, ticks: number): number {
  const raw = range / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = NICE_STEPS.find((candidate) => candidate * magnitude >= raw) ?? 10;
  return step * magnitude;
}

/** Rendered width of SVG content, kept up to date as its text changes. */
function useSvgWidth(target: RefObject<SVGGraphicsElement | null>, mounted: boolean): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = target.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.ceil(entry?.contentRect.width ?? 0));
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [target, mounted]);
  return width;
}

/**
 * Bars over days or categories with a labelled value axis. Colours, grid and text come
 * from tokens, so both themes stay readable; every bar tells its value on hover and on
 * keyboard focus. The value axis takes the room its widest tick needs, and bar labels
 * thin out to the room the longest of them needs. Pair it with a table of the same figures.
 */
export function BarChart({ label, points, format, max, emptyLabel }: BarChartProps) {
  const frame = useRef<HTMLDivElement>(null);
  const tickLabels = useRef<SVGGElement>(null);
  const labelProbe = useRef<SVGTextElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [active, setActive] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = frame.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.floor(entry?.contentRect.width ?? 0),
        height: Math.floor(entry?.contentRect.height ?? 0),
      });
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, []);

  const drawn = size.width > 0 && size.height > 0;
  // Tick texts share their right edge, so their group is as wide as the widest one.
  const tickWidth = useSvgWidth(tickLabels, drawn);
  const labelWidth = useSvgWidth(labelProbe, drawn);
  const gutter = tickWidth > 0 ? tickWidth + TICK_GAP : INITIAL_GUTTER;
  const labelSpace = Math.max(MIN_LABEL_SPACE, labelWidth + LABEL_GAP);
  const longestLabel = points.reduce(
    (longest, point) => (point.label.length > longest.length ? point.label : longest),
    '',
  );

  const values = points.flatMap((point) => (point.value === null ? [] : [point.value]));
  const dataMax = Math.max(0, ...values);
  const step = niceStep(max ?? (dataMax > 0 ? dataMax : 1), TICKS);
  const top = max ?? Math.max(step, Math.ceil(dataMax / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const { width, height: chartHeight } = size;
  const plotWidth = Math.max(0, width - gutter);
  const plotHeight = Math.max(0, chartHeight - AXIS_HEIGHT - TOP_PADDING);
  const slot = points.length > 0 ? plotWidth / points.length : 0;
  const barWidth = Math.max(1, slot * (1 - BAR_GAP_SHARE));
  const labelEvery = Math.max(1, Math.ceil(labelSpace / Math.max(slot, 1)));
  const y = (value: number) => TOP_PADDING + plotHeight - (value / top) * plotHeight;
  const activePoint = active === null ? null : points[active];

  return (
    <div ref={frame} className={styles.chart}>
      {drawn ? (
        <svg
          role="img"
          aria-label={label}
          width={width}
          height={chartHeight}
          viewBox={`0 0 ${String(width)} ${String(chartHeight)}`}
          className={styles.chartSvg}
        >
          {ticks.map((tick) => (
            <line
              key={tick}
              x1={gutter}
              x2={width}
              y1={y(tick)}
              y2={y(tick)}
              className={styles.chartGrid}
            />
          ))}
          <text
            ref={labelProbe}
            className={styles.chartLabel}
            visibility="hidden"
            aria-hidden="true"
          >
            {longestLabel}
          </text>
          <g ref={tickLabels}>
            {ticks.map((tick) => (
              <text
                key={tick}
                x={gutter - TICK_GAP}
                y={y(tick)}
                className={styles.chartTick}
                dy="0.32em"
              >
                {format(tick)}
              </text>
            ))}
          </g>
          {points.map((point, index) => {
            const x = gutter + index * slot + (slot - barWidth) / 2;
            const center = x + barWidth / 2;
            // A label without room before the right edge is left out rather than cut.
            const labelled = index % labelEvery === 0 && center + labelSpace / 2 <= width;
            const height = point.value === null ? 0 : (point.value / top) * plotHeight;
            return (
              <g key={point.key}>
                {point.value === null ? null : (
                  <rect
                    x={x}
                    y={y(point.value)}
                    width={barWidth}
                    height={Math.max(height, point.value > 0 ? 1 : 0)}
                    rx={Math.min(4, barWidth / 3)}
                    className={clsx(styles.chartBar, active === index && styles.chartBarActive)}
                  />
                )}
                {labelled ? (
                  <text
                    x={center}
                    y={chartHeight - 6}
                    className={styles.chartLabel}
                    textAnchor="middle"
                  >
                    {point.label}
                  </text>
                ) : null}
                <rect
                  x={gutter + index * slot}
                  y={TOP_PADDING}
                  width={slot}
                  height={plotHeight}
                  className={styles.chartHit}
                  tabIndex={0}
                  role="presentation"
                  aria-label={`${point.title}: ${point.value === null ? emptyLabel : format(point.value)}`}
                  onMouseEnter={() => {
                    setActive(index);
                  }}
                  onMouseLeave={() => {
                    setActive(null);
                  }}
                  onFocus={() => {
                    setActive(index);
                  }}
                  onBlur={() => {
                    setActive(null);
                  }}
                />
              </g>
            );
          })}
        </svg>
      ) : null}
      {activePoint && active !== null ? (
        <div
          className={styles.chartTooltip}
          style={{
            left: `${String(Math.min(width - 8, Math.max(8, gutter + (active + 0.5) * slot)))}px`,
          }}
          aria-hidden="true"
        >
          <span className={styles.chartTooltipTitle}>{activePoint.title}</span>
          <span className={styles.chartTooltipValue}>
            {activePoint.value === null ? emptyLabel : format(activePoint.value)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
