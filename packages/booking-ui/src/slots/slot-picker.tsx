import type { AvailableDay } from '@slotwise/contracts/client';
import { dayPartIds, dayPartOfMinute } from '@slotwise/domain';
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
} from '@slotwise/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormat } from '../use-format';
import { addDays, localMinuteOf } from './local-date';
import styles from './slot-picker.module.css';

export const WEEK_DAYS = 7;

function groupSlots(
  day: AvailableDay | undefined,
  timeZone: string,
  format: ReturnType<typeof useFormat>,
  title: (key: string) => string,
): TimeGridGroup[] {
  const groups = new Map<string, TimeGridGroup['options'][number][]>();
  for (const slot of day?.slots ?? []) {
    const part = dayPartOfMinute(localMinuteOf(slot.start, timeZone));
    groups.set(part, [
      ...(groups.get(part) ?? []),
      { value: slot.start, label: format.instant(slot.start, timeZone, 'time') },
    ]);
  }
  return dayPartIds
    .filter((part) => groups.has(part))
    .map((part) => ({ key: part, title: title(part), options: groups.get(part) ?? [] }));
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

export interface SlotPickerProps {
  readonly timeZone: string;
  readonly today: string;
  readonly lastDay: string;
  readonly weekStart: string;
  readonly onWeekChange: (weekStart: string) => void;
  /** Free starts of the week; `undefined` while they load. */
  readonly days: readonly AvailableDay[] | undefined;
  /** Shown instead of the free starts when they failed to load (what happened + retry). */
  readonly failure?: ReactNode;
  /** A choice was made: a tap on a day or a time, e.g. for haptic feedback. */
  readonly onPick?: () => void;
  readonly selectedDate: string | null;
  readonly onDateChange: (date: string) => void;
  readonly selectedStart: string | null;
  readonly onStartChange: (start: string) => void;
  /** What to offer when the wanted time is not there, e.g. the waitlist. */
  readonly fallback?: ReactNode;
}

/** A week of days and the free starts of the chosen one: the slot to pick. */
export function SlotPicker({
  timeZone,
  today,
  lastDay,
  weekStart,
  onWeekChange,
  days,
  failure,
  onPick,
  selectedDate,
  onDateChange,
  selectedStart,
  onStartChange,
  fallback,
}: SlotPickerProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const weekEnd = addDays(weekStart, WEEK_DAYS - 1);
  const firstOpen = days?.find((day) => day.slots.length > 0)?.date ?? null;
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
  const groups = groupSlots(
    days?.find((day) => day.date === selectedDate),
    timeZone,
    format,
    (key) => t(`common:dayParts.${key}`),
  );

  return (
    <>
      <section className={styles.picker}>
        <div className={styles.weekHeader}>
          <p className={styles.month}>{format.localDate(selectedDate ?? weekStart, 'monthYear')}</p>
          <div className={styles.weekNav}>
            <IconButton
              label={t('booking:picker.previousWeek')}
              icon={<ChevronLeft />}
              disabled={weekStart <= today}
              onClick={() => {
                onWeekChange(addDays(weekStart, -WEEK_DAYS));
              }}
            />
            <IconButton
              label={t('booking:picker.nextWeek')}
              icon={<ChevronRight />}
              disabled={weekEnd >= lastDay}
              onClick={() => {
                onWeekChange(addDays(weekStart, WEEK_DAYS));
              }}
            />
          </div>
        </div>
        <DateStrip
          label={t('booking:picker.daysLabel')}
          days={stripDays}
          value={selectedDate}
          onChange={(date) => {
            onPick?.();
            onDateChange(date);
          }}
        />
      </section>
      {failure ?? null}
      {!days && !failure ? <SlotsSkeleton /> : null}
      {days && !firstOpen ? (
        <StatePanel
          compact
          illustration={<EmptyIllustration />}
          title={t('booking:picker.weekFullTitle')}
          description={t('booking:picker.weekFullDescription')}
          action={
            weekEnd < lastDay ? (
              <Button
                variant="secondary"
                onClick={() => {
                  onWeekChange(addDays(weekStart, WEEK_DAYS));
                }}
              >
                {t('booking:picker.nextWeek')}
              </Button>
            ) : undefined
          }
        />
      ) : null}
      {days && firstOpen && groups.length === 0 ? (
        <StatePanel
          compact
          title={t('booking:picker.dayFullTitle')}
          description={t('booking:picker.dayFullDescription')}
        />
      ) : null}
      {groups.length > 0 ? (
        <TimeGrid
          label={t('booking:picker.slotsLabel')}
          groups={groups}
          value={selectedStart}
          onChange={(start) => {
            onPick?.();
            onStartChange(start);
          }}
        />
      ) : null}
      {days ? fallback : null}
    </>
  );
}
