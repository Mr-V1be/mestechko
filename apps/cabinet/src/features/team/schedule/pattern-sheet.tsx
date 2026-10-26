import { useFormat } from '@slotwise/booking-ui';
import type { Location } from '@slotwise/contracts/client';
import { Button, Checkbox, ListGroup, ListItem, Select, Sheet, TextField } from '@slotwise/ui';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorMessage, fieldErrorsOf } from '../../common/error-message';
import { CustomDaysEditor } from './custom-days-editor';
import { isoWeekdays, weekdayDate } from './dates';
import { DayHoursEditor } from './day-hours-editor';
import { ImpactDialog } from './impact-dialog';
import {
  CUSTOM,
  draftPattern,
  draftProblems,
  patternChange,
  patternChoices,
  templateShapes,
  type PatternChoice,
  type PatternDraft,
} from './pattern-model';
import { useScheduleChange } from './schedule-change';
import { WeekView } from './week-view';
import styles from './schedule.module.css';

function WeekdayChoice({
  weekdays,
  error,
  onChange,
}: {
  readonly weekdays: readonly number[];
  readonly error: string | null;
  readonly onChange: (weekdays: number[]) => void;
}) {
  const { t } = useTranslation('team');
  const format = useFormat();
  const idPrefix = useId();
  return (
    <div className={styles.field} role="group" aria-labelledby={`${idPrefix}-label`}>
      <span id={`${idPrefix}-label`} className={styles.fieldLabel}>
        {t('editor.weekdays')}
      </span>
      <ListGroup className={styles.choiceList}>
        {isoWeekdays.map((weekday) => {
          const id = `${idPrefix}-${String(weekday)}`;
          const checked = weekdays.includes(weekday);
          return (
            <ListItem
              key={weekday}
              controlId={id}
              leading={
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(next) => {
                    onChange(
                      next
                        ? [...weekdays, weekday]
                        : weekdays.filter((candidate) => candidate !== weekday),
                    );
                  }}
                />
              }
              title={
                <span className={styles.capitalized}>
                  {format.localDate(weekdayDate(weekday), 'weekdayLong')}
                </span>
              }
            />
          );
        })}
      </ListGroup>
      {error ? (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Choosing a new regular schedule: a template with its hours, or every day by hand. */
export function PatternSheet({
  businessId,
  staffId,
  open,
  onOpenChange,
  initialDraft,
  first,
  locations,
  today,
  onSaved,
}: {
  readonly businessId: string;
  readonly staffId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly initialDraft: PatternDraft;
  /** The person has no schedule yet, so this sets the first one. */
  readonly first: boolean;
  readonly locations: readonly Location[];
  readonly today: string;
  readonly onSaved: () => void;
}) {
  const { t } = useTranslation('team');
  const flow = useScheduleChange(businessId, staffId);
  const [draft, setDraft] = useState(initialDraft);
  const [attempted, setAttempted] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const problems = draftProblems(draft, today);
  const shown = (problem: (typeof problems)[number]) => attempted && problems.includes(problem);
  const custom = draft.choice === CUSTOM;
  const cycle = custom
    ? draft.customKind === 'cycle'
    : templateShapes[draft.choice].kind === 'cycle';
  const pastFromApi = fieldErrorsOf(failure).date === 'past';
  const dateError = shown('dateRequired')
    ? t('validation.dateRequired')
    : shown('pastDate') || pastFromApi
      ? t('validation.pastDate')
      : null;
  const update = (next: PatternDraft) => {
    setDraft(next);
    setFailure(null);
  };

  const save = () => {
    setAttempted(true);
    if (problems.length > 0) {
      return;
    }
    flow.submit({
      change: patternChange(draft),
      success: t('editor.saved'),
      confirmLabel: t('editor.save'),
      onApplied: onSaved,
      onError: setFailure,
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={first ? t('schedule.set') : t('editor.title')}
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
            {t('editor.save')}
          </Button>
        </>
      }
    >
      <div className={styles.form}>
        <Select<PatternChoice>
          label={t('editor.template')}
          value={draft.choice}
          options={patternChoices.map((choice) => ({
            value: choice,
            label: t(`editor.templates.${choice}`),
          }))}
          onChange={(choice) => {
            update({ ...draft, choice });
          }}
        />
        {custom ? (
          <CustomDaysEditor draft={draft} onChange={update} attempted={attempted} />
        ) : (
          <>
            <DayHoursEditor
              value={draft.hours}
              attempted={attempted}
              onChange={(hours) => {
                update({ ...draft, hours });
              }}
            />
            {templateShapes[draft.choice].choosesWeekdays ? (
              <WeekdayChoice
                weekdays={draft.weekdays}
                error={shown('noWeekdays') ? t('validation.noWeekdays') : null}
                onChange={(weekdays) => {
                  update({ ...draft, weekdays });
                }}
              />
            ) : null}
          </>
        )}
        {custom && shown('noWorkDays') ? (
          <p className={styles.formError} role="alert">
            {t('validation.noWorkDays')}
          </p>
        ) : null}
        <TextField
          type="date"
          label={
            cycle
              ? custom
                ? t('editor.cycleStart')
                : t('editor.firstWorkDay')
              : t('editor.validFrom')
          }
          value={draft.startDate}
          min={today}
          error={dateError}
          onChange={(event) => {
            update({ ...draft, startDate: event.currentTarget.value });
          }}
        />
        {locations.length > 1 ? (
          <Select
            label={t('editor.location')}
            value={draft.locationId}
            options={locations.map((location) => ({ value: location.id, label: location.name }))}
            onChange={(locationId) => {
              update({ ...draft, locationId });
            }}
          />
        ) : null}
        {draft.startDate ? (
          <section className={styles.preview} aria-label={t('editor.preview')}>
            <h3 className={styles.previewTitle}>{t('editor.preview')}</h3>
            <WeekView pattern={draftPattern(draft)} from={draft.startDate} />
          </section>
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
