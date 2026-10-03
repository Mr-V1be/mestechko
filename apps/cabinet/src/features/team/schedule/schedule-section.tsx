import { useFormat } from '@mestechko/booking-ui';
import type { Location, StaffAssignmentView } from '@mestechko/contracts/client';
import { Badge, Button, StatePanel } from '@mestechko/ui';
import { CalendarCog } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Section } from '../member/section';
import { laterOf } from './dates';
import { patternChoiceOf } from './pattern-model';
import { WeekView } from './week-view';
import styles from './schedule.module.css';

function AssignmentBlock({
  assignment,
  locations,
  today,
  labelled,
}: {
  readonly assignment: StaffAssignmentView;
  readonly locations: readonly Location[];
  readonly today: string;
  /** Several schedules follow each other, so each says which one it is. */
  readonly labelled: boolean;
}) {
  const { t } = useTranslation('team');
  const format = useFormat();
  const current = assignment.validFrom <= today;
  const location =
    locations.length > 1
      ? locations.find((candidate) => candidate.id === assignment.locationId)?.name
      : undefined;
  const from = format.localDate(assignment.validFrom, 'dayMonth');
  const period = assignment.validUntil
    ? t('schedule.range', {
        from,
        to: format.localDate(assignment.validUntil, 'dayMonth'),
      })
    : t('schedule.from', { date: from });
  return (
    <article className={styles.assignment}>
      <header className={styles.assignmentHeader}>
        {labelled ? (
          <Badge tone={current ? 'neutral' : 'accent'}>
            {current ? t('schedule.now') : t('schedule.next')}
          </Badge>
        ) : null}
        <h3 className={styles.assignmentTitle}>
          {t(`schedule.kinds.${patternChoiceOf(assignment.pattern)}`)}
        </h3>
        <span className={styles.assignmentMeta}>
          {[location, period].filter(Boolean).join(' · ')}
        </span>
      </header>
      <WeekView pattern={assignment.pattern} from={laterOf(today, assignment.validFrom)} />
    </article>
  );
}

/** The regular schedule: what applies now and what is planned to follow. */
export function ScheduleSection({
  assignments,
  locations,
  today,
  onEdit,
}: {
  readonly assignments: readonly StaffAssignmentView[];
  readonly locations: readonly Location[];
  readonly today: string;
  readonly onEdit: () => void;
}) {
  const { t } = useTranslation('team');
  const edit = (
    <Button icon={<CalendarCog />} onClick={onEdit}>
      {assignments.length > 0 ? t('schedule.change') : t('schedule.set')}
    </Button>
  );
  return (
    <Section title={t('schedule.title')} action={assignments.length > 0 ? edit : undefined}>
      {assignments.length > 0 ? (
        <div className={styles.panel}>
          {assignments.map((assignment) => (
            <AssignmentBlock
              key={assignment.id}
              assignment={assignment}
              locations={locations}
              today={today}
              labelled={assignments.length > 1}
            />
          ))}
        </div>
      ) : (
        <div className={styles.panel}>
          <StatePanel
            compact
            title={t('schedule.noneTitle')}
            description={t('schedule.noneDescription')}
            action={edit}
          />
        </div>
      )}
    </Section>
  );
}
