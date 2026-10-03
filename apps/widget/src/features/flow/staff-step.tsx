import { apiAssetUrl, useFormat, useVocabulary } from '@mestechko/booking-ui';
import type { StaffOption, VerticalSummary } from '@mestechko/contracts/client';
import { Avatar, ListGroup, ListItem } from '@mestechko/ui';
import { ChevronRight, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { appConfig } from '../../app/config';
import { ANY_STAFF } from './flow-state';
import styles from './widget.module.css';

export interface StaffStepProps {
  readonly vertical: VerticalSummary;
  readonly timeZone: string;
  readonly staff: readonly StaffOption[];
  readonly anyNextSlot: string | null;
  readonly value: string | null;
  readonly onChoose: (staff: string) => void;
}

/** Who does the visit, with their price and nearest free time; or whoever is free. */
export function StaffStep({
  vertical,
  timeZone,
  staff,
  anyNextSlot,
  value,
  onChoose,
}: StaffStepProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const vocabulary = useVocabulary(vertical);
  const nearest = (instant: string | null) =>
    instant
      ? t('staff.nearest', {
          when: `${format.instant(instant, timeZone, 'weekdayDayMonth')}, ${format.instant(instant, timeZone, 'time')}`,
        })
      : t('staff.noFree');
  return (
    <ListGroup>
      <ListItem
        selected={value === ANY_STAFF}
        leading={
          <span className={styles.anyIcon}>
            <Users aria-hidden="true" />
          </span>
        }
        title={vocabulary.staffAny}
        description={anyNextSlot ? t('staff.anyDescription') : t('staff.noFree')}
        trailing={<ChevronRight aria-hidden="true" />}
        onClick={() => {
          onChoose(ANY_STAFF);
        }}
      />
      {staff.map((option) => (
        <ListItem
          key={option.id}
          selected={value === option.id}
          leading={
            <Avatar
              name={option.displayName}
              src={apiAssetUrl(appConfig.apiBaseUrl, option.avatarUrl)}
            />
          }
          title={option.displayName}
          description={[option.title, nearest(option.nextSlot)].filter(Boolean).join(' · ')}
          meta={format.money(option.total)}
          onClick={() => {
            onChoose(option.id);
          }}
        />
      ))}
    </ListGroup>
  );
}
