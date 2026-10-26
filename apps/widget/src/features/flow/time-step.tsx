import { addDays, localDateOf, SlotPicker, todayIn, WEEK_DAYS } from '@slotwise/booking-ui';
import { Button, StatePanel } from '@slotwise/ui';
import { useTranslation } from 'react-i18next';
import { useAvailability } from '../../platform/api/queries';

export interface TimeStepProps {
  readonly slug: string;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  readonly staffId: string | null;
  readonly timeZone: string;
  readonly horizonDays: number;
  readonly weekStart: string | null;
  readonly date: string | null;
  readonly start: string | null;
  readonly onChange: (patch: {
    readonly weekStart?: string;
    readonly date?: string | null;
    readonly start?: string | null;
  }) => void;
}

/** A day of the week, then a free start on it. */
export function TimeStep(props: TimeStepProps) {
  const { t } = useTranslation();
  const today = todayIn(props.timeZone);
  const lastDay = addDays(today, props.horizonDays);
  const weekStart = props.weekStart ?? today;
  const availability = useAvailability(props.slug, {
    locationId: props.locationId,
    serviceIds: props.serviceIds,
    staffId: props.staffId,
    from: weekStart,
    to: addDays(weekStart, WEEK_DAYS - 1),
  });
  const days = availability.isPlaceholderData ? undefined : availability.data?.days;
  // Until the visitor picks a day, the first one with free time is shown.
  const date =
    props.date ??
    (props.start ? localDateOf(props.start, props.timeZone) : null) ??
    days?.find((day) => day.slots.length > 0)?.date ??
    null;
  return (
    <SlotPicker
      timeZone={props.timeZone}
      today={today}
      lastDay={lastDay}
      weekStart={weekStart}
      onWeekChange={(next) => {
        props.onChange({ weekStart: next, date: null, start: null });
      }}
      days={days}
      failure={
        availability.isError ? (
          <StatePanel
            compact
            role="alert"
            title={t('common:errors.loadFailed')}
            action={
              <Button variant="secondary" onClick={() => void availability.refetch()}>
                {t('common:actions.retry')}
              </Button>
            }
          />
        ) : undefined
      }
      selectedDate={date}
      onDateChange={(next) => {
        props.onChange({ date: next, start: null });
      }}
      selectedStart={props.start}
      onStartChange={(start) => {
        props.onChange({ start });
      }}
    />
  );
}
