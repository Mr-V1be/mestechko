import { useFormat } from '@slotwise/booking-ui';
import type { CabinetStaff } from '@slotwise/contracts/client';
import { Select, TextField, TimeGrid } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import { useFreeStarts } from '../../platform/api/desk-queries';
import styles from './desk.module.css';

export interface WhenValue {
  readonly staffId: string;
  readonly date: string;
  /** `HH:MM`, or empty while not chosen. */
  readonly time: string;
}

export interface WhenFieldsProps {
  readonly slug: string;
  readonly locationId: string;
  readonly timeZone: string;
  readonly serviceIds: readonly string[];
  /** Staff who provide all the chosen services. */
  readonly staff: readonly CabinetStaff[];
  readonly value: WhenValue;
  readonly onChange: (value: WhenValue) => void;
  /** Why the chosen time does not work, shown right under it. */
  readonly timeError?: string | null;
}

/**
 * Who and when: a staff member, a date and a time to the five minutes, with the
 * times clients could book with them shown as a quick choice.
 */
export function WhenFields({
  slug,
  locationId,
  timeZone,
  serviceIds,
  staff,
  value,
  onChange,
  timeError,
}: WhenFieldsProps) {
  const { t } = useTranslation('desk');
  const format = useFormat();
  const free = useFreeStarts(slug, {
    locationId,
    serviceIds,
    staffId: value.staffId || null,
    date: value.date,
  });
  const starts =
    free.data?.days[0]?.slots.map((slot) => format.instant(slot.start, timeZone, 'time')) ?? [];
  return (
    <>
      {staff.length > 0 ? (
        <Select
          label={t('when.staff')}
          value={value.staffId}
          options={staff.map((member) => ({ value: member.id, label: member.displayName }))}
          onChange={(staffId) => {
            onChange({ ...value, staffId });
          }}
        />
      ) : (
        <p className={styles.error}>{t('services.noProviders')}</p>
      )}
      <div className={styles.row}>
        <TextField
          label={t('when.date')}
          type="date"
          value={value.date}
          required
          onChange={(event) => {
            onChange({ ...value, date: event.currentTarget.value });
          }}
        />
        <TextField
          label={t('when.time')}
          type="time"
          step={300}
          value={value.time}
          required
          error={timeError ?? null}
          onChange={(event) => {
            onChange({ ...value, time: event.currentTarget.value });
          }}
        />
      </div>
      {serviceIds.length > 0 && value.staffId ? (
        starts.length > 0 ? (
          <TimeGrid
            label={t('when.free')}
            groups={[
              {
                key: 'free',
                title: t('when.free'),
                options: starts.map((label) => ({ value: label, label })),
              },
            ]}
            value={starts.includes(value.time) ? value.time : null}
            onChange={(time) => {
              onChange({ ...value, time });
            }}
          />
        ) : free.isSuccess ? (
          <p className={styles.hint}>{t('when.noFree')}</p>
        ) : null
      ) : null}
    </>
  );
}
