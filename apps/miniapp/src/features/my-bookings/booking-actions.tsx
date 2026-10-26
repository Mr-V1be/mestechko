import { errorMessage, useFormat } from '@slotwise/booking-ui';
import type { ClientBooking } from '@slotwise/contracts/client';
import { Button, Sheet, useToast } from '@slotwise/ui';
import { CalendarClock, CircleCheck, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useCancelBooking } from '../../platform/api/lifecycle-queries';
import { haptics } from '../../platform/telegram/telegram-host';
import styles from './bookings.module.css';

const MS_PER_MINUTE = 60_000;

/** When online changes close, or why they already have. */
function ChangeWindow({ booking }: { readonly booking: ClientBooking }) {
  const { t } = useTranslation();
  const format = useFormat();
  if (!booking.changeDeadline) {
    return null;
  }
  const timeZone = booking.location.timeZone;
  if (booking.actions.reschedule || booking.actions.cancel) {
    return (
      <p className={styles.note}>
        {t('booking.deadline', {
          when: `${format.instant(booking.changeDeadline, timeZone, 'weekdayDayMonth')}, ${format.instant(booking.changeDeadline, timeZone, 'time')}`,
        })}
      </p>
    );
  }
  const minutes = (Date.parse(booking.start) - Date.parse(booking.changeDeadline)) / MS_PER_MINUTE;
  return (
    <p className={styles.note}>
      {t('booking.changesClosed', { duration: format.duration(minutes) })}
    </p>
  );
}

/** What the client can do with an upcoming booking: move it or cancel it. */
export function BookingActions({
  slug,
  booking,
}: {
  readonly slug: string;
  readonly booking: ClientBooking;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const cancel = useCancelBooking(slug);
  const [confirming, setConfirming] = useState(false);
  const timeZone = booking.location.timeZone;
  if (booking.status !== 'confirmed') {
    return null;
  }
  return (
    <section className={styles.actions}>
      {booking.attendanceConfirmed ? (
        <p className={styles.confirmed}>
          <CircleCheck aria-hidden="true" />
          {t('booking.attendanceConfirmed')}
        </p>
      ) : null}
      <ChangeWindow booking={booking} />
      {booking.actions.reschedule || booking.actions.cancel ? (
        <div className={styles.actionRow}>
          {booking.actions.reschedule ? (
            <Button
              variant="secondary"
              icon={<CalendarClock />}
              onClick={() => {
                void navigate(`/b/${encodeURIComponent(slug)}/bookings/${booking.id}/reschedule`);
              }}
            >
              {t('booking.reschedule')}
            </Button>
          ) : null}
          {booking.actions.cancel ? (
            <Button
              variant="secondary"
              icon={<X />}
              onClick={() => {
                setConfirming(true);
              }}
            >
              {t('booking.cancel')}
            </Button>
          ) : null}
        </div>
      ) : null}
      <Sheet
        open={confirming}
        onOpenChange={setConfirming}
        title={t('booking.cancelTitle')}
        description={`${format.instant(booking.start, timeZone, 'weekdayDayMonth')}, ${format.instant(booking.start, timeZone, 'time')} · ${booking.services.map((service) => service.name).join(', ')}`}
        closeLabel={t('common:actions.close')}
        footer={
          <div className={styles.sheetActions}>
            <Button
              variant="danger"
              block
              loading={cancel.isPending}
              onClick={() => {
                cancel.mutate(booking.id, {
                  onSuccess: () => {
                    haptics.success();
                    setConfirming(false);
                    toast.show({ title: t('booking.cancelled') });
                  },
                  onError: (error) => {
                    haptics.error();
                    toast.show({ title: errorMessage(t, error), tone: 'error' });
                  },
                });
              }}
            >
              {t('booking.cancelConfirm')}
            </Button>
            <Button
              variant="secondary"
              block
              onClick={() => {
                setConfirming(false);
              }}
            >
              {t('booking.keep')}
            </Button>
          </div>
        }
      >
        <p className={styles.note}>{t('booking.cancelConsequence')}</p>
      </Sheet>
    </section>
  );
}
