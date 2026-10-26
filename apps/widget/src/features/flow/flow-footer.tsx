import { useFormat } from '@slotwise/booking-ui';
import { Button } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import type { DraftPrice } from './flow-state';
import styles from './widget.module.css';

export interface FlowFooterProps {
  readonly price: DraftPrice | null;
  readonly servicesCount: number;
  readonly durationMinutes: number;
  readonly label: string;
  readonly enabled: boolean;
  readonly loading: boolean;
  readonly onNext: () => void;
}

/** The booking so far and the one step forward; stays in view in a popup. */
export function FlowFooter({
  price,
  servicesCount,
  durationMinutes,
  label,
  enabled,
  loading,
  onNext,
}: FlowFooterProps) {
  const { t } = useTranslation();
  const format = useFormat();
  return (
    <footer className={styles.footer}>
      {servicesCount > 0 && price ? (
        <p className={styles.summary} role="status">
          <span className={styles.summaryStrong}>
            {price.kind === 'exact'
              ? format.money(price.total)
              : t('services.priceFrom', { price: format.money(price.min) })}
          </span>
          <span className={styles.summaryHint}>
            {t('summary.services', { count: servicesCount })} · {format.duration(durationMinutes)}
          </span>
        </p>
      ) : (
        <span />
      )}
      <Button disabled={!enabled} loading={loading} onClick={onNext}>
        {label}
      </Button>
    </footer>
  );
}
