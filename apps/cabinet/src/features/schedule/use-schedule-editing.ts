import type {
  getCabinetOverview,
  getSchedule,
  Membership,
  RouteResult,
  ScheduleAxis,
} from '@slotwise/contracts/client';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NewBookingStart } from '../booking-desk/create-booking-sheet';
import { useMoveWithUndo } from '../booking-desk/use-move-with-undo';
import type { TimelineEditing, TimelineNotice } from './timeline-grid';
import { instantAt, wallTime } from './timeline-model';
import type { DropTarget } from './use-block-drag';
import type { ScheduleView } from './use-schedule-params';

type Schedule = RouteResult<typeof getSchedule>;
type Overview = RouteResult<typeof getCabinetOverview>;

/** How long a refused drop explains itself beside the place it was dropped. */
const NOTICE_MS = 6_000;

export interface ScheduleEditingInput {
  readonly businessId: string;
  readonly membership: Membership | null;
  readonly overview: Overview;
  readonly schedule: Schedule | undefined;
  readonly view: ScheduleView;
  readonly axis: ScheduleAxis;
  readonly date: string;
  readonly locationId: string;
  /** The staff member or resource a week view shows. */
  readonly columnId: string | null;
  readonly timeZone: string;
}

/**
 * Turns gestures on the schedule into booking changes. What a column means depends on
 * the view: a staff member (day, by staff), a resource (day, by resource: time only)
 * or a day (week). Staff members with access to their own bookings stay in their column.
 */
export function useScheduleEditing(input: ScheduleEditingInput) {
  const { t } = useTranslation('desk');
  const { move } = useMoveWithUndo(input.businessId);
  const [notice, setNotice] = useState<TimelineNotice | null>(null);
  const [createStart, setCreateStart] = useState<NewBookingStart | null>(null);
  useEffect(() => {
    if (!notice) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      setNotice(null);
    }, NOTICE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  const scope = input.membership?.access.bookings ?? 'none';
  const ownStaffId = scope === 'own' ? (input.membership?.staffId ?? null) : null;
  const canEdit = scope !== 'none' && (scope !== 'own' || ownStaffId !== null);
  const byStaff = input.axis === 'staff';
  const weekStaffId = byStaff ? input.columnId : null;

  /** The staff member and day a column stands for; `null` staff keeps the booking's. */
  const placeOf = (columnKey: string): { staffId: string | null; date: string } =>
    input.view === 'week'
      ? { staffId: weekStaffId, date: columnKey }
      : { staffId: byStaff ? columnKey : null, date: input.date };

  const staffName = (staffId: string) =>
    input.overview.staff.find((member) => member.id === staffId)?.displayName ?? '';

  const onMove = (bookingId: string, target: DropTarget) => {
    const booking = input.schedule?.bookings.find((candidate) => candidate.id === bookingId);
    if (!booking) {
      return;
    }
    const place = placeOf(target.columnKey);
    setNotice(null);
    move(
      {
        bookingId,
        staffId: place.staffId ?? booking.staffId,
        start: instantAt(place.date, target.minute, input.timeZone),
        expectedVersion: booking.version,
        previous: { staffId: booking.staffId, start: booking.start },
        staffName,
        timeZone: input.timeZone,
      },
      {
        onRefused: (message) => {
          setNotice({ ...target, text: t('dropRefused', { reason: message }) });
        },
      },
    );
  };

  const startAt = (place: { staffId: string | null; date: string }, time: string | null) => {
    setCreateStart({
      locationId: input.locationId,
      staffId: ownStaffId ?? place.staffId,
      date: place.date,
      time,
    });
  };

  const editing: TimelineEditing | undefined = canEdit
    ? {
        // Another staff member is a different column only on the staff axis; a week's
        // columns are days, which anyone who may edit can move between.
        acrossColumns: input.view === 'week' || (byStaff && ownStaffId === null),
        onMove,
        onCreateAt: (target) => {
          startAt(placeOf(target.columnKey), wallTime(target.minute));
        },
      }
    : undefined;

  return {
    canEdit,
    editing,
    notice,
    createStart,
    /** «Новая запись» from the header: the shown day and, in a week, its staff member. */
    startNew: () => {
      startAt({ staffId: input.view === 'week' ? weekStaffId : null, date: input.date }, null);
    },
    closeCreate: () => {
      setCreateStart(null);
    },
  };
}
