import {
  addDays,
  daysBetween,
  localDateOf,
  SlotPicker,
  todayIn,
  WEEK_DAYS,
} from '@slotwise/booking-ui';
import { Button } from '@slotwise/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAvailability } from '../../platform/api/queries';
import { useMainButton } from '../../platform/telegram/sdk-buttons';
import { haptics } from '../../platform/telegram/telegram-host';
import { useCurrentBusiness, useLocation } from '../business/business-context';
import { Page } from '../layout/page';
import { QueryErrorState } from '../layout/states';
import { WaitlistSheet } from '../waitlist/waitlist-sheet';
import { BookingSummary, BookingSummaryBar } from './booking-summary';
import { ANY_STAFF, useBookingSelection } from './selection';
import waitlistStyles from '../waitlist/waitlist.module.css';

/** Pick a day of the week, then a free start time: the slot. */
export function TimePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const business = useCurrentBusiness();
  const { selection, pathTo, update } = useBookingSelection();
  const location = useLocation(selection.locationId);
  const timeZone = location?.timeZone ?? 'UTC';
  const today = todayIn(timeZone);
  const lastDay = addDays(today, business.booking.horizonDays);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [weekStart, setWeekStart] = useState(() => {
    const offset = selection.date ? Math.max(0, daysBetween(today, selection.date)) : 0;
    return addDays(today, offset - (offset % WEEK_DAYS));
  });
  const weekEnd = addDays(weekStart, WEEK_DAYS - 1);
  const availability = useAvailability(selection.slug, {
    locationId: selection.locationId,
    serviceIds: selection.serviceIds,
    staffId: selection.staff === ANY_STAFF ? null : selection.staff,
    from: weekStart,
    to: weekEnd,
  });
  const days = availability.isPlaceholderData ? undefined : availability.data?.days;
  const firstOpen = days?.find((day) => day.slots.length > 0)?.date ?? null;
  const selectedDate =
    selection.date && days?.some((day) => day.date === selection.date) ? selection.date : firstOpen;

  useEffect(() => {
    if (days && selectedDate !== selection.date) {
      // A start already chosen on that date survives the date catching up in the address.
      const keepStart =
        selection.start !== null &&
        selectedDate !== null &&
        localDateOf(selection.start, timeZone) === selectedDate;
      update(keepStart ? { date: selectedDate } : { date: selectedDate, start: null });
    }
  }, [days, selectedDate, selection.date, selection.start, timeZone, update]);

  useMainButton({
    text: t('time.continue'),
    visible: selection.start !== null,
    onClick: () => {
      void navigate(pathTo('confirm'));
    },
  });

  if (selection.serviceIds.length === 0 || !selection.staff) {
    return (
      <Navigate to={pathTo(selection.serviceIds.length === 0 ? 'services' : 'staff')} replace />
    );
  }
  const changeWeek = (start: string) => {
    setWeekStart(start);
    update({ date: null, start: null });
  };
  const staffId = selection.staff === ANY_STAFF ? null : selection.staff;

  return (
    <Page
      title={t('time.title')}
      backTo={pathTo('staff', { date: null, start: null })}
      aside={<BookingSummary selection={selection} />}
      footer={<BookingSummaryBar selection={selection} />}
    >
      <SlotPicker
        timeZone={timeZone}
        today={today}
        lastDay={lastDay}
        weekStart={weekStart}
        onWeekChange={changeWeek}
        days={days}
        failure={
          availability.isError ? (
            <QueryErrorState
              error={availability.error}
              onRetry={() => void availability.refetch()}
            />
          ) : undefined
        }
        onPick={() => {
          haptics.selection();
        }}
        selectedDate={selectedDate}
        onDateChange={(date) => {
          update({ date, start: null });
        }}
        selectedStart={selection.start}
        onStartChange={(start) => {
          update({ start });
        }}
        fallback={
          <p className={waitlistStyles.hint}>
            {t('time.waitlistHint')}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setWaitlistOpen(true);
              }}
            >
              {t('time.waitlistJoin')}
            </Button>
          </p>
        }
      />
      <WaitlistSheet
        key={weekStart}
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        wish={{
          locationId: selection.locationId,
          serviceIds: selection.serviceIds,
          staffId,
          date: selectedDate ?? weekStart,
          weekStart,
          today,
        }}
      />
    </Page>
  );
}
