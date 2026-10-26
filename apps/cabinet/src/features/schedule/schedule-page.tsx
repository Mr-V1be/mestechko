import { useFormat, useVocabulary } from '@slotwise/booking-ui';
import { scheduleAxes, type Membership, type ScheduleAxis } from '@slotwise/contracts/client';
import {
  Button,
  EmptyIllustration,
  IconButton,
  SegmentedControl,
  Select,
  Skeleton,
  StatePanel,
  breakpoints,
  useMediaQuery,
} from '@slotwise/ui';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router';
import { useOverview, useSchedule } from '../../platform/api/queries';
import { canOpen, useActiveMembership } from '../../platform/session/active-business';
import { useSession } from '../../platform/session/session-context';
import { BookingDetailsSheet } from '../booking-details/booking-details-sheet';
import { CreateBookingSheet } from '../booking-desk/create-booking-sheet';
import { PageContainer, PageHeader } from '../common/page-header';
import { NoAccessState, QueryErrorState } from '../common/states';
import { AgendaList } from './agenda-list';
import { dayColumns, weekColumns } from './schedule-columns';
import { addDays, weekStart } from './timeline-model';
import { TimelineGrid } from './timeline-grid';
import { useScheduleEditing } from './use-schedule-editing';
import {
  DEFAULT_AXIS,
  DEFAULT_VIEW,
  scheduleViews,
  useScheduleParams,
} from './use-schedule-params';
import styles from './schedule.module.css';

const WEEK_DAYS = 7;

const axisLabels: Record<ScheduleAxis, (vocabulary: ReturnType<typeof useVocabulary>) => string> = {
  staff: (vocabulary) => vocabulary.staffMany,
  resource: (vocabulary) => vocabulary.resourceMany,
};

function ScheduleSkeleton() {
  return <Skeleton height="calc(var(--size-hour) * 6)" />;
}

export function SchedulePage() {
  const { t } = useTranslation();
  const { businessId = '' } = useParams();
  const me = useSession();
  const membership = useActiveMembership(me);
  const overview = useOverview(businessId);
  if (membership && !canOpen(membership, 'schedule')) {
    return (
      <PageContainer>
        <NoAccessState />
      </PageContainer>
    );
  }
  return (
    <PageContainer>
      {overview.isError ? (
        <QueryErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : null}
      {overview.isPending ? (
        <>
          <PageHeader title={t('schedule.title')} />
          <ScheduleSkeleton />
        </>
      ) : null}
      {overview.data ? (
        <ScheduleBoard businessId={businessId} membership={membership} overview={overview.data} />
      ) : null}
    </PageContainer>
  );
}

function ScheduleBoard({
  businessId,
  membership,
  overview,
}: {
  readonly businessId: string;
  readonly membership: Membership | null;
  readonly overview: NonNullable<ReturnType<typeof useOverview>['data']>;
}) {
  const { t } = useTranslation();
  const format = useFormat();
  const wide = useMediaQuery(breakpoints.tablet);
  const vocabulary = useVocabulary(overview.business.vertical);
  const firstLocation = overview.locations[0];
  const timeZone = firstLocation?.timeZone ?? 'UTC';
  const state = useScheduleParams(firstLocation?.id ?? '', timeZone);
  const location =
    overview.locations.find((candidate) => candidate.id === state.locationId) ?? firstLocation;
  const [openBooking, setOpenBooking] = useState<string | null>(null);
  const from = state.view === 'week' ? weekStart(state.date) : state.date;
  const to = state.view === 'week' ? addDays(from, WEEK_DAYS - 1) : state.date;
  const schedule = useSchedule(businessId, {
    locationId: location?.id ?? '',
    from,
    to,
    axis: state.axis,
  });
  const now = new Date();
  const data = schedule.data;
  const singleColumn = state.view === 'week' || !wide;
  const columnId =
    data?.columns.find((column) => column.id === state.column)?.id ?? data?.columns[0]?.id ?? null;
  const step = state.view === 'week' ? WEEK_DAYS : 1;
  const desk = useScheduleEditing({
    businessId,
    membership,
    overview,
    schedule: data,
    view: state.view,
    axis: state.axis,
    date: state.date,
    locationId: location?.id ?? '',
    columnId,
    timeZone,
  });

  const dateLabel =
    state.view === 'week'
      ? `${format.localDate(from, 'dayMonth')} — ${format.localDate(to, 'dayMonth')}`
      : format.localDate(state.date, 'weekdayDayMonth');

  const columns = data
    ? state.view === 'week'
      ? columnId
        ? weekColumns(data, from, columnId, format, now)
        : []
      : dayColumns(
          data,
          state.date,
          overview.business.vertical,
          format,
          now,
          singleColumn ? columnId : null,
        )
    : [];

  return (
    <>
      <PageHeader
        title={t('schedule.title')}
        actions={
          <div className={styles.dateNav}>
            <IconButton
              label={t('schedule.previous')}
              icon={<ChevronLeft />}
              onClick={() => {
                state.set({ date: addDays(state.date, -step) });
              }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                state.set({ date: null });
              }}
            >
              {t('schedule.today')}
            </Button>
            <IconButton
              label={t('schedule.next')}
              icon={<ChevronRight />}
              onClick={() => {
                state.set({ date: addDays(state.date, step) });
              }}
            />
          </div>
        }
      />
      <div className={styles.titleRow}>
        <p className={styles.dateLabel}>{dateLabel}</p>
        {desk.canEdit && location ? (
          <Button size="sm" icon={<Plus />} onClick={desk.startNew}>
            {t('desk:newBooking')}
          </Button>
        ) : null}
      </div>
      <div className={styles.controls}>
        <SegmentedControl
          label={t('schedule.view')}
          value={state.view}
          segments={scheduleViews.map((value) => ({ value, label: t(`schedule.${value}`) }))}
          onChange={(value) => {
            state.set({ view: value === DEFAULT_VIEW ? null : value });
          }}
        />
        <SegmentedControl
          label={t('schedule.axis')}
          value={state.axis}
          segments={scheduleAxes.map((value) => ({ value, label: axisLabels[value](vocabulary) }))}
          onChange={(value) => {
            state.set({ axis: value === DEFAULT_AXIS ? null : value, column: null });
          }}
        />
        {overview.locations.length > 1 ? (
          <Select
            className={styles.select}
            label={t('schedule.location')}
            hideLabel
            value={location?.id ?? ''}
            options={overview.locations.map((candidate) => ({
              value: candidate.id,
              label: candidate.name,
            }))}
            onChange={(value) => {
              state.set({ location: value, column: null });
            }}
          />
        ) : null}
        {singleColumn && data && columnId ? (
          <Select
            className={styles.select}
            label={t('schedule.column')}
            hideLabel
            value={columnId}
            options={data.columns.map((column) => ({ value: column.id, label: column.title }))}
            onChange={(value) => {
              state.set({ column: value });
            }}
          />
        ) : null}
      </div>
      {schedule.isError ? (
        <QueryErrorState error={schedule.error} onRetry={() => void schedule.refetch()} />
      ) : null}
      {schedule.isPending ? <ScheduleSkeleton /> : null}
      {data?.columns.length === 0 ? (
        <StatePanel
          illustration={<EmptyIllustration />}
          title={t('schedule.noColumnsTitle')}
          description={t('schedule.noColumnsDescription')}
        />
      ) : null}
      {data && columnId && state.view === 'week' && !wide ? (
        <AgendaList
          schedule={data}
          weekStart={from}
          columnId={columnId}
          onOpenBooking={setOpenBooking}
        />
      ) : null}
      {data && columns.length > 0 && (state.view === 'day' || wide) ? (
        <TimelineGrid
          columns={columns}
          columnsLabel={
            state.view === 'week' ? t('schedule.days') : axisLabels[state.axis](vocabulary)
          }
          density={state.view === 'week' ? 'compact' : 'regular'}
          onOpenBooking={setOpenBooking}
          editing={desk.editing}
          notice={desk.notice}
        />
      ) : null}
      <BookingDetailsSheet
        businessId={businessId}
        bookingId={openBooking}
        onClose={() => {
          setOpenBooking(null);
        }}
      />
      <CreateBookingSheet
        businessId={businessId}
        overview={overview}
        start={desk.createStart}
        canSearchClients={membership !== null && canOpen(membership, 'clients')}
        onClose={desk.closeCreate}
        onCreated={(bookingId) => {
          desk.closeCreate();
          setOpenBooking(bookingId);
        }}
      />
    </>
  );
}
