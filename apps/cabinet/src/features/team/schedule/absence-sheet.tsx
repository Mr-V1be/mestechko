import type { StaffAbsenceView } from '@mestechko/contracts/client';
import { absenceKinds, type AbsenceKind } from '@mestechko/domain';
import { Button, Select, Sheet, TextField } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage, fieldErrorsOf } from '../../common/error-message';
import { laterOf } from './dates';
import { ImpactDialog } from './impact-dialog';
import { useScheduleChange } from './schedule-change';
import styles from './schedule.module.css';

interface AbsenceDraft {
  readonly kind: AbsenceKind;
  readonly from: string;
  readonly to: string;
}

type AbsenceProblem = 'dateRequired' | 'toBeforeFrom' | 'pastDate' | 'overlapsAbsence';

/** Problems of the dates, checked where they are typed; empty dates only after saving. */
function problemsOf(
  draft: AbsenceDraft,
  absences: readonly StaffAbsenceView[],
  today: string,
): { from: AbsenceProblem | null; to: AbsenceProblem | null } {
  const to: AbsenceProblem | null =
    draft.to === ''
      ? 'dateRequired'
      : draft.from !== '' && draft.to < draft.from
        ? 'toBeforeFrom'
        : draft.to < today
          ? 'pastDate'
          : null;
  const from: AbsenceProblem | null =
    draft.from === ''
      ? 'dateRequired'
      : to === null &&
          absences.some((absence) => draft.from <= absence.to && absence.from <= draft.to)
        ? 'overlapsAbsence'
        : null;
  return { from, to };
}

/** Days away: a vacation, a sick leave or a day off, both ends included. */
export function AbsenceSheet({
  businessId,
  staffId,
  open,
  onOpenChange,
  absences,
  today,
  onSaved,
}: {
  readonly businessId: string;
  readonly staffId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly absences: readonly StaffAbsenceView[];
  readonly today: string;
  readonly onSaved: () => void;
}) {
  const { t } = useTranslation('team');
  const flow = useScheduleChange(businessId, staffId);
  const [draft, setDraft] = useState<AbsenceDraft>({ kind: 'vacation', from: '', to: '' });
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const problems = problemsOf(draft, absences, today);
  const pastFromApi = fieldErrorsOf(failure).date === 'past';
  const message = (problem: AbsenceProblem | null) =>
    problem && (problem !== 'dateRequired' || attempted) ? t(`validation.${problem}`) : null;
  const update = (next: AbsenceDraft) => {
    setDraft(next);
    setFailure(null);
  };

  const save = () => {
    setAttempted(true);
    if (problems.from || problems.to) {
      return;
    }
    flow.submit({
      change: { type: 'absence', kind: draft.kind, from: draft.from, to: draft.to },
      success: t('absences.added'),
      confirmLabel: t('absences.save'),
      onApplied: onSaved,
      onError: setFailure,
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('absences.sheetTitle')}
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
            {t('absences.save')}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Select<AbsenceKind>
          label={t('absences.kind')}
          value={draft.kind}
          options={absenceKinds.map((kind) => ({ value: kind, label: t(`absenceKinds.${kind}`) }))}
          onChange={(kind) => {
            update({ ...draft, kind });
          }}
        />
        <div className={styles.dates}>
          <TextField
            type="date"
            label={t('absences.from')}
            value={draft.from}
            error={message(problems.from)}
            onChange={(event) => {
              const from = event.currentTarget.value;
              // The last day follows the first, never earlier than today.
              update({
                ...draft,
                from,
                to: draft.to === '' || draft.to < from ? laterOf(from, today) : draft.to,
              });
            }}
          />
          <TextField
            type="date"
            label={t('absences.to')}
            value={draft.to}
            min={laterOf(draft.from, today)}
            error={pastFromApi ? t('validation.pastDate') : message(problems.to)}
            onChange={(event) => {
              update({ ...draft, to: event.currentTarget.value });
            }}
          />
        </div>
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
