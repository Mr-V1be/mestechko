import type { PublicBusiness } from '@mestechko/contracts/client';
import { IconButton, Select } from '@mestechko/ui';
import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { flowSteps, type FlowStep } from './flow-state';
import styles from './widget.module.css';

export interface FlowHeaderProps {
  readonly business: PublicBusiness;
  readonly step: FlowStep;
  readonly locationId: string;
  readonly onLocationChange: (locationId: string) => void;
  /** `null` on the first step. */
  readonly onBack: (() => void) | null;
}

/** Whose booking it is, where, and how far along the visitor is. */
export function FlowHeader({
  business,
  step,
  locationId,
  onLocationChange,
  onBack,
}: FlowHeaderProps) {
  const { t } = useTranslation();
  const location = business.locations.find((candidate) => candidate.id === locationId);
  const current = flowSteps.indexOf(step) + 1;
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        {onBack ? (
          <IconButton label={t('header.back')} icon={<ChevronLeft />} soft onClick={onBack} />
        ) : null}
        <div className={styles.headerText}>
          <p className={styles.eyebrow}>{t('header.online')}</p>
          <h1 className={styles.businessName}>{business.name}</h1>
          {location && (business.locations.length === 1 || step !== 'services') ? (
            <p className={styles.address}>
              {location.name}, {location.address}
            </p>
          ) : null}
        </div>
      </div>
      {business.locations.length > 1 && step === 'services' ? (
        <Select
          label={t('header.location')}
          value={locationId}
          options={business.locations.map((candidate) => ({
            value: candidate.id,
            label: `${candidate.name}, ${candidate.address}`,
          }))}
          onChange={onLocationChange}
        />
      ) : null}
      <div className={styles.progress}>
        <p className={styles.stepLabel}>
          {t('header.step', { current, total: flowSteps.length })} · {t(`steps.${step}`)}
        </p>
        <ol className={styles.progressBar} aria-hidden="true">
          {flowSteps.map((candidate, index) => (
            <li
              key={candidate}
              className={index < current ? styles.progressDone : styles.progressTodo}
            />
          ))}
        </ol>
      </div>
    </header>
  );
}
