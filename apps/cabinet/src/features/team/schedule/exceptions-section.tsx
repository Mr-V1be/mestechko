import { useFormat } from '@slotwise/booking-ui';
import type { DayHours, Location, StaffDayException } from '@slotwise/contracts/client';
import { Button, IconButton, ListGroup, ListItem } from '@slotwise/ui';
import { CalendarPlus, CalendarX2, Clock, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Section } from '../member/section';
import { useFormSheet } from '../use-form-sheet';
import { ExceptionSheet } from './exception-sheet';
import { ImpactDialog } from './impact-dialog';
import { useScheduleChange } from './schedule-change';
import styles from './schedule.module.css';

/** Dates ahead that differ from the regular schedule, and adding or undoing one. */
export function ExceptionsSection({
  businessId,
  staffId,
  exceptions,
  locations,
  defaultLocationId,
  defaultHours,
  today,
}: {
  readonly businessId: string;
  readonly staffId: string;
  readonly exceptions: readonly StaffDayException[];
  readonly locations: readonly Location[];
  readonly defaultLocationId: string;
  readonly defaultHours: DayHours | null;
  readonly today: string;
}) {
  const { t } = useTranslation('team');
  const format = useFormat();
  const flow = useScheduleChange(businessId, staffId);
  const sheet = useFormSheet();
  const range = (span: { start: string; end: string }) => `${span.start}–${span.end}`;
  const describe = (exception: StaffDayException) => {
    if (!exception.hours) {
      return t('exceptions.dayOff');
    }
    const location =
      locations.length > 1
        ? locations.find((candidate) => candidate.id === exception.locationId)?.name
        : undefined;
    return [
      range(exception.hours),
      ...exception.hours.breaks.map((pause) => t('schedule.break', { range: range(pause) })),
      location,
    ]
      .filter(Boolean)
      .join(' · ');
  };

  return (
    <Section
      title={t('exceptions.title')}
      action={
        <Button variant="secondary" size="sm" icon={<CalendarPlus />} onClick={sheet.show}>
          {t('exceptions.add')}
        </Button>
      }
    >
      {exceptions.length > 0 ? (
        <ListGroup>
          {exceptions.map((exception) => (
            <ListItem
              key={exception.date}
              leading={
                <span className={exception.hours ? styles.rowIcon : styles.rowIconOff}>
                  {exception.hours ? <Clock /> : <CalendarX2 />}
                </span>
              }
              title={
                <span className={styles.capitalized}>
                  {format.localDate(exception.date, 'weekdayDayMonth')}
                </span>
              }
              description={describe(exception)}
              trailing={
                <IconButton
                  label={t('exceptions.remove')}
                  icon={<Undo2 />}
                  soft
                  disabled={flow.pending}
                  onClick={() => {
                    flow.submit({
                      change: { type: 'day', date: exception.date, day: { kind: 'regular' } },
                      success: t('exceptions.removed', {
                        date: format.localDate(exception.date, 'dayMonth'),
                      }),
                      confirmLabel: t('exceptions.confirmRemove'),
                    });
                  }}
                />
              }
            />
          ))}
        </ListGroup>
      ) : (
        <p className={styles.empty}>{t('exceptions.empty')}</p>
      )}
      <ExceptionSheet
        key={sheet.key}
        businessId={businessId}
        staffId={staffId}
        open={sheet.open}
        onOpenChange={sheet.setOpen}
        locations={locations}
        defaultLocationId={defaultLocationId}
        defaultHours={defaultHours}
        today={today}
        onSaved={sheet.done}
      />
      <ImpactDialog flow={flow} />
    </Section>
  );
}
