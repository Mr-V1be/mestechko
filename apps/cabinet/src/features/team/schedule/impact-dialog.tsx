import { useFormat } from '@mestechko/booking-ui';
import { ConfirmDialog, ListGroup, ListItem } from '@mestechko/ui';
import { useTranslation } from 'react-i18next';
import type { ScheduleChangeFlow } from './schedule-change';
import styles from './schedule.module.css';

/** Asks before a schedule change leaves visits outside working time, listing them. */
export function ImpactDialog({ flow }: { readonly flow: ScheduleChangeFlow }) {
  const { t } = useTranslation('team');
  const format = useFormat();
  const { confirmation } = flow;
  if (!confirmation) {
    return null;
  }
  const count = confirmation.affected.length;
  const consequence =
    count === 0
      ? t('impact.noneDescription')
      : confirmation.changed
        ? t('impact.changed')
        : t('impact.consequence');
  return (
    <ConfirmDialog
      open={flow.open}
      onOpenChange={(open) => {
        if (!open) {
          flow.dismiss();
        }
      }}
      title={count === 0 ? t('impact.noneTitle') : t('impact.title', { count })}
      consequence={consequence}
      confirmLabel={confirmation.request.confirmLabel}
      cancelLabel={t('common:actions.cancel')}
      closeLabel={t('common:actions.close')}
      pending={flow.applying}
      onConfirm={flow.confirm}
    >
      {count > 0 ? (
        <ListGroup className={styles.choiceList}>
          {confirmation.affected.map((visit) => (
            <ListItem
              key={visit.bookingId}
              title={t('impact.visit', {
                date: format.instant(visit.start, visit.timeZone, 'weekdayDayMonth'),
                time: `${format.instant(visit.start, visit.timeZone, 'time')}–${format.instant(visit.end, visit.timeZone, 'time')}`,
              })}
              description={[visit.clientName, ...visit.serviceNames].join(' · ')}
            />
          ))}
        </ListGroup>
      ) : null}
    </ConfirmDialog>
  );
}
