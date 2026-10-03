import type { DayHours, Location } from '@mestechko/contracts/client';
import { Button, SegmentedControl, Select, Sheet, TextField } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage, fieldErrorsOf } from '../../common/error-message';
import { daysBetween } from './dates';
import { DayHoursEditor } from './day-hours-editor';
import { DEFAULT_HOURS, hoursAreValid } from './hours-model';
import { ImpactDialog } from './impact-dialog';
import { useScheduleChange } from './schedule-change';
import styles from './schedule.module.css';

const dayModes = ['work', 'off'] as const;
type DayMode = (typeof dayModes)[number];

interface ExceptionDraft {
  readonly mode: DayMode;
  readonly date: string;
  readonly hours: DayHours;
  readonly locationId: string;
}

/** One date unlike the regular schedule: other hours, another location, or a day off. */
export function ExceptionSheet({
  businessId,
  staffId,
  open,
  onOpenChange,
  locations,
  defaultLocationId,
  defaultHours,
  today,
  onSaved,
}: {
  readonly businessId: string;
  readonly staffId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly locations: readonly Location[];
  readonly defaultLocationId: string;
  readonly defaultHours: DayHours | null;
  readonly today: string;
  readonly onSaved: () => void;
}) {
  const { t } = useTranslation('team');
  const flow = useScheduleChange(businessId, staffId);
  const [draft, setDraft] = useState<ExceptionDraft>({
    mode: 'work',
    date: '',
    hours: defaultHours ?? DEFAULT_HOURS,
    locationId: defaultLocationId,
  });
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const pastFromApi = fieldErrorsOf(failure).date === 'past';
  const past = draft.date !== '' && daysBetween(today, draft.date) < 0;
  const dateError =
    attempted && draft.date === ''
      ? t('validation.dateRequired')
      : past || pastFromApi
        ? t('validation.pastDate')
        : null;
  const update = (next: ExceptionDraft) => {
    setDraft(next);
    setFailure(null);
  };

  const save = () => {
    setAttempted(true);
    if (draft.date === '' || past || (draft.mode === 'work' && !hoursAreValid(draft.hours))) {
      return;
    }
    flow.submit({
      change: {
        type: 'day',
        date: draft.date,
        day:
          draft.mode === 'off'
            ? { kind: 'off' }
            : { kind: 'work', locationId: draft.locationId, hours: draft.hours },
      },
      success: t('exceptions.saved'),
      confirmLabel: t('exceptions.save'),
      onApplied: onSaved,
      onError: setFailure,
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('exceptions.sheetTitle')}
      closeLabel={t('common:actions.close')}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => {
              onOpenChange(false);
            }}
          >
            {t('common:actions.cancel')}
          </Button>
          <Button className={styles.grow} loading={flow.pending} onClick={save}>
            {t('exceptions.save')}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <TextField
          type="date"
          label={t('exceptions.date')}
          value={draft.date}
          min={today}
          error={dateError}
          onChange={(event) => {
            update({ ...draft, date: event.currentTarget.value });
          }}
        />
        <SegmentedControl
          label={t('exceptions.mode')}
          block
          value={draft.mode}
          segments={dayModes.map((mode) => ({ value: mode, label: t(`exceptions.${mode}`) }))}
          onChange={(mode) => {
            update({ ...draft, mode });
          }}
        />
        {draft.mode === 'work' ? (
          <>
            <DayHoursEditor
              value={draft.hours}
              attempted={attempted}
              onChange={(hours) => {
                update({ ...draft, hours });
              }}
            />
            {locations.length > 1 ? (
              <Select
                label={t('editor.location')}
                value={draft.locationId}
                options={locations.map((location) => ({
                  value: location.id,
                  label: location.name,
                }))}
                onChange={(locationId) => {
                  update({ ...draft, locationId });
                }}
              />
            ) : null}
          </>
        ) : null}
        {failure && !pastFromApi ? (
          <p className={styles.formError} role="alert">
            {errorMessage(t, failure)}
          </p>
        ) : null}
      </div>
      <ImpactDialog flow={flow} />
    </Sheet>
  );
}
