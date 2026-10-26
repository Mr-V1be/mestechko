import type { DayHours } from '@slotwise/contracts/client';
import { Button, IconButton, TimeRangeField } from '@slotwise/ui';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  checkHours,
  MAX_BREAKS_PER_DAY,
  suggestedBreak,
  visibleProblem,
  type HoursProblem,
} from './hours-model';
import styles from './schedule.module.css';

/** Working hours of a day and its breaks, checked as they are typed. */
export function DayHoursEditor({
  value,
  onChange,
  attempted,
}: {
  readonly value: DayHours;
  readonly onChange: (value: DayHours) => void;
  /** The person tried to save, so empty times count as mistakes too. */
  readonly attempted: boolean;
}) {
  const { t } = useTranslation('team');
  const check = checkHours(value);
  const message = (problem: HoursProblem | null) => {
    const shown = visibleProblem(problem, attempted);
    return shown ? t(`validation.${shown}`) : null;
  };
  return (
    <div className={styles.dayHours}>
      <TimeRangeField
        label={t('editor.hours')}
        startLabel={t('editor.start')}
        endLabel={t('editor.end')}
        value={value}
        error={message(check.hours)}
        onChange={(range) => {
          onChange({ ...value, ...range });
        }}
      />
      {value.breaks.map((pause, index) => (
        <TimeRangeField
          // Breaks have no identity of their own; their order is their key.
          key={index}
          label={t('editor.break')}
          startLabel={t('editor.breakStart')}
          endLabel={t('editor.breakEnd')}
          value={pause}
          error={message(check.breaks[index] ?? null)}
          onChange={(range) => {
            onChange({
              ...value,
              breaks: value.breaks.map((candidate, at) => (at === index ? range : candidate)),
            });
          }}
          action={
            <IconButton
              label={t('editor.removeBreak')}
              icon={<X />}
              soft
              onClick={() => {
                onChange({ ...value, breaks: value.breaks.filter((_, at) => at !== index) });
              }}
            />
          }
        />
      ))}
      {value.breaks.length < MAX_BREAKS_PER_DAY ? (
        <Button
          className={styles.addBreak}
          variant="ghost"
          size="sm"
          icon={<Plus />}
          onClick={() => {
            onChange({ ...value, breaks: [...value.breaks, suggestedBreak(value)] });
          }}
        >
          {t('editor.addBreak')}
        </Button>
      ) : null}
    </div>
  );
}
