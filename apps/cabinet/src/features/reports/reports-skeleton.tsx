import { reportMetricIds } from '@slotwise/domain';
import { Skeleton } from '@slotwise/ui';
import styles from './reports.module.css';

/** Tiles and chart cards in their final places while the figures load. */
export function ReportsSkeleton() {
  return (
    <div className={styles.content} aria-busy="true">
      <Skeleton shape="text" width="40%" />
      <div className={styles.tiles}>
        {reportMetricIds.map((metric) => (
          <div key={metric} className={styles.tileSkeleton}>
            <Skeleton shape="text" width="60%" />
            <Skeleton height="var(--font-size-2xl)" width="70%" />
            <Skeleton shape="text" width="45%" />
          </div>
        ))}
      </div>
      <div className={styles.charts}>
        {reportMetricIds.map((metric) => (
          <div key={metric} className={styles.card}>
            <div className={styles.cardHeader}>
              <Skeleton shape="text" width="30%" />
              <Skeleton height="var(--size-control-sm)" width="var(--size-illustration)" />
            </div>
            <Skeleton height="var(--size-chart-height)" />
          </div>
        ))}
      </div>
    </div>
  );
}
