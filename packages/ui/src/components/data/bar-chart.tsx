import { clsx } from 'clsx';
import { useLayoutEffect, useRef, useState } from 'react';
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

const GUTTER = 56;
const AXIS_HEIGHT = 24;
const TOP_PADDING = 8;
const TICKS = 4;
const MIN_LABEL_SPACE = 36;
const BAR_GAP_SHARE = 0.28;
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

/** A round step so that ticks read 0, 2 500, 5 000… instead of 0, 2 371, 4 742… */
function niceStep(range: number, ticks: number): number {
  const raw = range / ticks;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = NICE_STEPS.find((candidate) => candidate * magnitude >= raw) ?? 10;
  return step * magnitude;
}

/**
 * Bars over days or categories with a labelled value axis. Colours, grid and text come
 * from tokens, so both themes stay readable; every bar tells its value on hover and on
 * keyboard focus. Pair it with a table of the same figures.
 */
export function BarChart({ label, points, format, max, emptyLabel }: BarChartProps) {
  const frame = useRef<HTMLDivElement>(null);
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

  const values = points.flatMap((point) => (point.value === null ? [] : [point.value]));
  const dataMax = Math.max(0, ...values);
  const step = niceStep(max ?? (dataMax > 0 ? dataMax : 1), TICKS);
  const top = max ?? Math.max(step, Math.ceil(dataMax / step) * step);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const { width, height: chartHeight } = size;
  const plotWidth = Math.max(0, width - GUTTER);
  const plotHeight = Math.max(0, chartHeight - AXIS_HEIGHT - TOP_PADDING);
  const slot = points.length > 0 ? plotWidth / points.length : 0;
  const barWidth = Math.max(1, slot * (1 - BAR_GAP_SHARE));
  const labelEvery = Math.max(1, Math.ceil(MIN_LABEL_SPACE / Math.max(slot, 1)));
  const y = (value: number) => TOP_PADDING + plotHeight - (value / top) * plotHeight;
  const activePoint = active === null ? null : points[active];

  return (
    <div ref={frame} className={styles.chart}>
      {width > 0 && chartHeight > 0 ? (
        <svg
          role="img"
          aria-label={label}
          width={width}
          height={chartHeight}
          viewBox={`0 0 ${String(width)} ${String(chartHeight)}`}
          className={styles.chartSvg}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={GUTTER} x2={width} y1={y(tick)} y2={y(tick)} className={styles.chartGrid} />
              <text x={GUTTER - 8} y={y(tick)} className={styles.chartTick} dy="0.32em">
                {format(tick)}
              </text>
            </g>
          ))}
          {points.map((point, index) => {
            const x = GUTTER + index * slot + (slot - barWidth) / 2;
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
                {index % labelEvery === 0 ? (
                  <text
                    x={x + barWidth / 2}
                    y={chartHeight - 6}
                    className={styles.chartLabel}
                    textAnchor="middle"
                  >
                    {point.label}
                  </text>
                ) : null}
                <rect
                  x={GUTTER + index * slot}
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
            left: `${String(Math.min(width - 8, Math.max(8, GUTTER + (active + 0.5) * slot)))}px`,
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
