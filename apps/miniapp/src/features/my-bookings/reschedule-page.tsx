import { useFormat } from '@mestechko/booking-ui';
import { StatePanel, useToast } from '@mestechko/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { useRescheduleBooking, useRescheduleDays } from '../../platform/api/lifecycle-queries';
import { useClientBooking } from '../../platform/api/queries';
import { useMainButton } from '../../platform/telegram/sdk-buttons';
import { haptics } from '../../platform/telegram/telegram-host';
import { errorMessage, hasCode } from '../../shared/error-message';
import { addDays, daysBetween, localDateOf, todayIn } from '../../shared/local-date';
import { useCurrentBusiness } from '../business/business-context';
import { SlotPicker, WEEK_DAYS } from '../booking/slot-picker';
import { Page } from '../layout/page';
import { ListSkeleton, QueryErrorState } from '../layout/states';
import styles from './bookings.module.css';

/** Moves a booking: the same services and staff member, another free start. */
export function ReschedulePage() {
  const { t } = useTranslation();
  const format = useFormat();
  const toast = useToast();
  const navigate = useNavigate();
  const business = useCurrentBusiness();
  const { bookingId = '' } = useParams();
  const booking = useClientBooking(business.slug, bookingId);
  const timeZone = booking.data?.location.timeZone ?? 'UTC';
  const today = todayIn(timeZone);
  const lastDay = addDays(today, business.booking.horizonDays);
  const [week, setWeek] = useState<string | null>(null);
  const currentDate = booking.data ? localDateOf(booking.data.start, timeZone) : today;
  // The week of the current visit opens first.
  const offset = Math.max(0, daysBetween(today, currentDate));
  const weekStart = week ?? addDays(today, offset - (offset % WEEK_DAYS));
  const options = useRescheduleDays(
    business.slug,
    bookingId,
    weekStart,
    addDays(weekStart, WEEK_DAYS - 1),
  );
  const reschedule = useRescheduleBooking(business.slug, bookingId);
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const days = options.isPlaceholderData ? undefined : options.data?.days;
  const openDays = days?.filter((day) => day.slots.length > 0).map((day) => day.date) ?? [];
  const selectedDate =
    date && openDays.includes(date)
      ? date
      : openDays.includes(currentDate)
        ? currentDate
        : (openDays[0] ?? null);
  const bookingPath = `/b/${encodeURIComponent(business.slug)}/bookings/${bookingId}`;

  useMainButton({
    text: start
      ? t('reschedule.submit', {
          when: `${format.instant(start, timeZone, 'weekdayDayMonth')}, ${format.instant(start, timeZone, 'time')}`,
        })
      : '',
    visible: start !== null && start !== booking.data?.start,
    loading: reschedule.isPending,
    onClick: () => {
      if (!start) {
        return;
      }
      reschedule.mutate(start, {
        onSuccess: () => {
          haptics.success();
          toast.show({ title: t('booking.rescheduled') });
          void navigate(bookingPath, { replace: true });
        },
        onError: (error) => {
          haptics.error();
          toast.show({ title: errorMessage(t, error), tone: 'error' });
          if (hasCode(error, 'slot_unavailable')) {
            setStart(null);
            void options.refetch();
          }
        },
      });
    },
  });

  const data = booking.data;
  return (
    <Page
      title={t('reschedule.title')}
      lead={
        data
          ? t('reschedule.current', {
              when: `${format.instant(data.start, timeZone, 'weekdayDayMonth')}, ${format.instant(data.start, timeZone, 'time')}`,
            })
          : undefined
      }
      backTo={bookingPath}
    >
      {booking.isPending ? <ListSkeleton rows={3} /> : null}
      {booking.isError ? (
        <QueryErrorState error={booking.error} onRetry={() => void booking.refetch()} />
      ) : null}
      {data && !data.actions.reschedule ? (
        <StatePanel
          title={t('reschedule.closedTitle')}
          description={t('reschedule.closedDescription')}
        />
      ) : null}
      {data?.actions.reschedule ? (
        <>
          <p className={styles.note}>
            {`${data.services.map((service) => service.name).join(', ')} · ${data.staff.displayName}. ${t('reschedule.sameTerms')}`}
          </p>
          <SlotPicker
            timeZone={timeZone}
            today={today}
            lastDay={lastDay}
            weekStart={weekStart}
            onWeekChange={(next) => {
              setWeek(next);
              setDate(null);
              setStart(null);
            }}
            days={days}
            error={options.isError ? options.error : null}
            onRetry={() => void options.refetch()}
            selectedDate={selectedDate}
            onDateChange={(next) => {
              setDate(next);
              setStart(null);
            }}
            selectedStart={start ?? (selectedDate === currentDate ? data.start : null)}
            onStartChange={setStart}
          />
        </>
      ) : null}
    </Page>
  );
}
