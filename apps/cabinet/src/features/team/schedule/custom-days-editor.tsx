import { useFormat } from '@mestechko/booking-ui';
import type { DayHours } from '@mestechko/contracts/client';
import { NumberField, SegmentedControl, Switch } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { weekdayDate } from './dates';
import { DayHoursEditor } from './day-hours-editor';
import { DEFAULT_HOURS } from './hours-model';
import { cycleLimits, resizeCycle, type PatternDraft } from './pattern-model';
import styles from './schedule.module.css';

type Day = DayHours | null;

/** A day switched on takes the hours of the nearest working day before it. */
function hoursToCopy(days: readonly Day[], index: number): DayHours {
  return (
    days.slice(0, index).findLast((day) => day !== null) ??
    days.find((day) => day !== null) ??
    DEFAULT_HOURS
  );
}

/** A schedule set day by day: every week the same, or a cycle of any length. */
export function CustomDaysEditor({
  draft,
  onChange,
  attempted,
}: {
  readonly draft: PatternDraft;
  readonly onChange: (draft: PatternDraft) => void;
  readonly attempted: boolean;
}) {
  const { t } = useTranslation('team');
  const format = useFormat();
  const [lengthError, setLengthError] = useState(false);
  const weekly = draft.customKind === 'weekly';
  const days = weekly ? draft.customWeek : draft.customCycle;
  const setDays = (next: readonly Day[]) => {
    onChange(weekly ? { ...draft, customWeek: next } : { ...draft, customCycle: next });
  };
  const dayName = (index: number) =>
    weekly
      ? format.localDate(weekdayDate(index + 1), 'weekdayLong')
      : t('editor.cycleDay', { n: index + 1 });

  return (
    <div className={styles.customDays}>
      <SegmentedControl
        label={t('editor.shape')}
        block
        value={draft.customKind}
        segments={[
          { value: 'weekly', label: t('editor.week') },
          { value: 'cycle', label: t('editor.cycle') },
        ]}
        onChange={(customKind) => {
          onChange({ ...draft, customKind });
        }}
      />
      {weekly ? null : (
        <NumberField
          label={t('editor.cycleLength')}
          value={draft.customCycle.length}
          min={cycleLimits.min}
          max={cycleLimits.max}
          error={lengthError ? t('validation.cycleLength', cycleLimits) : null}
          onChange={(length) => {
            const fits =
              length !== null &&
              Number.isInteger(length) &&
              length >= cycleLimits.min &&
              length <= cycleLimits.max;
            setLengthError(!fits);
            // Out-of-range input is not applied, so typing «10» never drops days at «1».
            if (fits) {
              setDays(resizeCycle(draft.customCycle, length));
            }
          }}
        />
      )}
      <ol className={styles.dayEditors}>
        {days.map((day, index) => (
          // A day is its position in the week or cycle.
          <li key={index} className={styles.dayEditor}>
            <Switch
              label={<span className={styles.capitalized}>{dayName(index)}</span>}
              description={day ? undefined : t('schedule.dayOff')}
              checked={day !== null}
              onCheckedChange={(works) => {
                setDays(
                  days.map((candidate, at) =>
                    at === index ? (works ? hoursToCopy(days, index) : null) : candidate,
                  ),
                );
              }}
            />
            {day ? (
              <DayHoursEditor
                value={day}
                attempted={attempted}
                onChange={(hours) => {
                  setDays(days.map((candidate, at) => (at === index ? hours : candidate)));
                }}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
