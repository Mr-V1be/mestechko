import { Skeleton } from '@mestechko/ui';
import { PageContainer } from '../../common/page-header';
import styles from './card.module.css';

const VISIT_ROWS = 4;

/** The card's layout in outline while it loads, so nothing jumps when it arrives. */
export function CardSkeleton() {
  return (
    <PageContainer>
      <div className={styles.header} aria-busy="true">
        <div className={styles.back}>
          <Skeleton shape="circle" width="var(--size-control-md)" height="var(--size-control-md)" />
        </div>
        <div className={styles.identity}>
          <Skeleton shape="circle" width="var(--size-avatar-lg)" height="var(--size-avatar-lg)" />
          <div className={styles.identityText}>
            <Skeleton shape="text" width="60%" height="var(--font-size-2xl)" />
            <Skeleton shape="text" width="35%" />
          </div>
        </div>
        <div className={styles.headerTags}>
          <Skeleton shape="text" width="30%" height="var(--size-control-sm)" />
        </div>
      </div>
      <div className={styles.layout} aria-hidden="true">
        <div className={styles.overview}>
          <Skeleton height="calc(var(--size-control-lg) * 2 + var(--space-6))" />
          <Skeleton height="calc(var(--size-control-lg) * 3)" />
        </div>
        <div className={styles.main}>
          <div className={styles.stack}>
            {Array.from({ length: VISIT_ROWS }, (_, index) => (
              <Skeleton key={index} height="calc(var(--size-control-lg) + var(--space-2))" />
            ))}
          </div>
          <Skeleton height="calc(var(--size-control-lg) * 3)" />
        </div>
        <div className={styles.loyalty}>
          <Skeleton height="calc(var(--size-control-lg) * 4)" />
        </div>
      </div>
    </PageContainer>
  );
}
