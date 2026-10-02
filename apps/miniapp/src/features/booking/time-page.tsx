import { useFormat } from '@mestechko/booking-ui';
import type { AvailableDay } from '@mestechko/contracts/client';
import {
  Button,
  DateStrip,
  EmptyIllustration,
  IconButton,
  Skeleton,
  StatePanel,
  TimeGrid,
  type DateStripDay,
  type TimeGridGroup,
} from '@mestechko/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { useAvailability } from '../../platform/api/queries';
import { haptics } from '../../platform/telegram/telegram-host';
import { useMainButton } from '../../platform/telegram/sdk-buttons';
import {
  addDays,
  daysBetween,
  dayPartOf,
  dayParts,
  localHourOf,
  todayIn,
} from '../../shared/local-date';
import { useCurrentBusiness, useLocation } from '../business/business-context';
import { Page } from '../layout/page';
import { QueryErrorState } from '../layout/states';
import { BookingSummary, BookingSummaryBar } from './booking-summary';
import { ANY_STAFF, useBookingSelection } from './selection';
import styles from './booking.module.css';

const WEEK_DAYS = 7;

function groupSlots(
  day: AvailableDay | undefined,
  timeZone: string,
  format: ReturnType<typeof useFormat>,
  title: (key: string) => string,
): TimeGridGroup[] {
  const groups = new Map<string, TimeGridGroup['options'][number][]>();
  for (const slot of day?.slots ?? []) {
    const part = dayPartOf(localHourOf(slot.start, timeZone));
    groups.set(part, [
      ...(groups.get(part) ?? []),
      { value: slot.start, label: format.instant(slot.start, timeZone, 'time') },
    ]);
  }
  return dayParts
    .filter((part) => groups.has(part.key))
    .map((part) => ({
      key: part.key,
      title: title(part.key),
      options: groups.get(part.key) ?? [],
    }));
}

function SlotsSkeleton() {
  return (
    <div className={styles.slotsSkeleton} aria-busy="true">
      {Array.from({ length: 12 }, (_, index) => (
        <Skeleton key={index} height="var(--size-control-md)" />
      ))}
    </div>
  );
}

/** Pick a day of the week, then a free start time: the "местечко". */
export function TimePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const format = useFormat();
  const business = useCurrentBusiness();
  const { selection, pathTo, update } = useBookingSelection();
  const location = useLocation(selection.locationId);
  const timeZone = location?.timeZone ?? 'UTC';
  const today = todayIn(timeZone);
  const lastDay = addDays(today, business.booking.horizonDays);
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
      update({ date: selectedDate, start: null });
    }
  }, [days, selectedDate, selection.date, update]);

  useMainButton({
    text: t('time.continue'),
    visible: selection.start !== null,
    onClick: () => {
      void navigate(pathTo('confirm'));
    },
  });

  const stripDays = useMemo<DateStripDay[]>(
    () =>
      Array.from({ length: WEEK_DAYS }, (_, index) => {
        const date = addDays(weekStart, index);
        const slots = days?.find((day) => day.date === date)?.slots.length ?? 0;
        return {
          value: date,
          weekday: format.localDate(date, 'weekdayShort'),
          dayNumber: format.localDate(date, 'dayNumber'),
          accessibleLabel: format.localDate(date, 'weekdayDayMonth'),
          disabled: slots === 0,
          marked: slots > 0,
          today: date === today,
        };
      }),
    [weekStart, days, format, today],
  );

  if (selection.serviceIds.length === 0 || !selection.staff) {
    return (
      <Navigate to={pathTo(selection.serviceIds.length === 0 ? 'services' : 'staff')} replace />
    );
  }
  const selectedDay = days?.find((day) => day.date === selectedDate);
  const groups = groupSlots(selectedDay, timeZone, format, (key) => t(`common:dayParts.${key}`));
  const shiftWeek = (weeks: number) => {
    setWeekStart(addDays(weekStart, weeks * WEEK_DAYS));
    update({ date: null, start: null });
  };

  return (
    <Page
      title={t('time.title')}
      backTo={pathTo('staff', { date: null, start: null })}
      aside={<BookingSummary selection={selection} />}
      footer={<BookingSummaryBar selection={selection} />}
    >
      <section className={styles.picker}>
        <div className={styles.weekHeader}>
          <p className={styles.month}>{format.localDate(selectedDate ?? weekStart, 'monthYear')}</p>
          <div className={styles.weekNav}>
            <IconButton
              label={t('time.previousWeek')}
              icon={<ChevronLeft />}
              disabled={weekStart <= today}
              onClick={() => {
                shiftWeek(-1);
              }}
            />
            <IconButton
              label={t('time.nextWeek')}
              icon={<ChevronRight />}
              disabled={weekEnd >= lastDay}
              onClick={() => {
                shiftWeek(1);
              }}
            />
          </div>
        </div>
        <DateStrip
          label={t('time.daysLabel')}
          days={stripDays}
          value={selectedDate}
          onChange={(date) => {
            haptics.selection();
            update({ date, start: null });
          }}
        />
      </section>
      {availability.isError ? (
        <QueryErrorState error={availability.error} onRetry={() => void availability.refetch()} />
      ) : null}
      {!days && !availability.isError ? <SlotsSkeleton /> : null}
      {days && !firstOpen ? (
        <StatePanel
          compact
          illustration={<EmptyIllustration />}
          title={t('time.weekFullTitle')}
          description={t('time.weekFullDescription')}
          action={
            weekEnd < lastDay ? (
              <Button
                variant="secondary"
                onClick={() => {
                  shiftWeek(1);
                }}
              >
                {t('time.nextWeek')}
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {days && firstOpen && groups.length === 0 ? (
        <StatePanel
          compact
          title={t('time.dayFullTitle')}
          description={t('time.dayFullDescription')}
        />
      ) : null}
      {groups.length > 0 ? (
        <TimeGrid
          label={t('time.slotsLabel')}
          groups={groups}
          value={selection.start}
          onChange={(start) => {
            haptics.selection();
            update({ start });
          }}
        />
      ) : null}
    </Page>
  );
}
