import { useFormat } from '@slotwise/booking-ui';
import type { StaffAbsenceView } from '@slotwise/contracts/client';
import { Badge, Button, IconButton, ListGroup, ListItem } from '@slotwise/ui';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { absenceIcons } from '../absence-label';
import { Section } from '../member/section';
import { useFormSheet } from '../use-form-sheet';
import { AbsenceSheet } from './absence-sheet';
import { ImpactDialog } from './impact-dialog';
import { useScheduleChange } from './schedule-change';
import styles from './schedule.module.css';

/** Vacations, sick leaves and days off ahead. */
export function AbsencesSection({
  businessId,
  staffId,
  absences,
  today,
}: {
  readonly businessId: string;
  readonly staffId: string;
  readonly absences: readonly StaffAbsenceView[];
  readonly today: string;
}) {
  const { t } = useTranslation('team');
  const format = useFormat();
  const flow = useScheduleChange(businessId, staffId);
  const sheet = useFormSheet();

  return (
    <Section
      title={t('absences.title')}
      action={
        <Button variant="secondary" size="sm" icon={<CalendarPlus />} onClick={sheet.show}>
          {t('absences.add')}
        </Button>
      }
    >
      {absences.length > 0 ? (
        <ListGroup>
          {absences.map((absence) => {
            const Icon = absenceIcons[absence.kind];
            return (
              <ListItem
                key={absence.id}
                leading={
                  <span className={styles.rowIconOff}>
                    <Icon />
                  </span>
                }
                title={t(`absenceKinds.${absence.kind}`)}
                description={format.localDateRange(absence.from, absence.to, 'dayMonth')}
                meta={
                  absence.from <= today ? (
                    <Badge tone="accent">{t('schedule.now')}</Badge>
                  ) : undefined
                }
                trailing={
                  <IconButton
                    label={t('absences.remove')}
                    icon={<Trash2 />}
                    soft
                    disabled={flow.pending}
                    onClick={() => {
                      flow.submit({
                        change: { type: 'absence_removal', absenceId: absence.id },
                        success: t('absences.removed'),
                        confirmLabel: t('absences.confirmRemove'),
                      });
                    }}
                  />
                }
              />
            );
          })}
        </ListGroup>
      ) : (
        <p className={styles.empty}>{t('absences.empty')}</p>
      )}
      <AbsenceSheet
        key={sheet.key}
        businessId={businessId}
        staffId={staffId}
        open={sheet.open}
        onOpenChange={sheet.setOpen}
        absences={absences}
        today={today}
        onSaved={sheet.done}
      />
      <ImpactDialog flow={flow} />
    </Section>
  );
}
