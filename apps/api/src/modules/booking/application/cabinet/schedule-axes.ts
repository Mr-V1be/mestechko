import type { ScheduleAxis, ScheduleBooking, ScheduleColumn } from '@mestechko/contracts';
import { bookingStatuses, normalizeIntervals, type InstantInterval } from '@mestechko/domain';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { ResourceView, StaffView } from '../../../catalog/application/catalog-reader.js';
import type { ScheduleItemView } from './ports.js';

export interface DayHours {
  readonly date: string;
  readonly intervals: readonly InstantInterval[];
}

/** Everything a schedule axis needs to lay out its columns. */
export interface ScheduleMaterial {
  readonly staff: readonly StaffView[];
  readonly resources: readonly ResourceView[];
  readonly staffHours: ReadonlyMap<string, readonly DayHours[]>;
  readonly items: readonly ScheduleItemView[];
  readonly avatars: AvatarUrls;
  readonly resourceTerm: (resource: ResourceView) => string;
}

export interface ScheduleLayout {
  readonly columns: ScheduleColumn[];
  readonly workingHours: { columnId: string; date: string; intervals: InstantInterval[] }[];
  readonly bookings: ScheduleBooking[];
}

interface AxisStrategy {
  layout(material: ScheduleMaterial): ScheduleLayout;
}

const iso = (epoch: number | Date): string => new Date(epoch).toISOString();

function blockOf(columnId: string, items: readonly ScheduleItemView[]): ScheduleBooking | null {
  const first = items[0];
  if (!first) {
    return null;
  }
  return {
    id: first.bookingId,
    version: first.version,
    columnId,
    staffId: first.staffId,
    status: first.status,
    hold: first.hold
      ? { reason: first.hold.reason, expiresAt: first.hold.expiresAt.toISOString() }
      : null,
    movable: bookingStatuses[first.status].movable,
    start: iso(Math.min(...items.map((item) => item.startsAt.getTime()))),
    end: iso(Math.max(...items.map((item) => item.endsAt.getTime()))),
    occupied: {
      start: iso(Math.min(...items.map((item) => item.occupied.start))),
      end: iso(Math.max(...items.map((item) => item.occupied.end))),
    },
    clientName: first.clientName,
    serviceNames: items.map((item) => item.serviceName),
    staffName: first.staffName,
  };
}

/** Location opening hours of a day: the union of everybody's working time. */
function openingHours(staffHours: ReadonlyMap<string, readonly DayHours[]>): DayHours[] {
  const byDate = new Map<string, InstantInterval[]>();
  for (const days of staffHours.values()) {
    for (const day of days) {
      byDate.set(day.date, [...(byDate.get(day.date) ?? []), ...day.intervals]);
    }
  }
  return [...byDate.entries()].map(([date, intervals]) => ({
    date,
    intervals: normalizeIntervals(intervals),
  }));
}

const staffAxis: AxisStrategy = {
  layout: ({ staff, staffHours, items, avatars }) => {
    const byBooking = Map.groupBy(items, (item) => item.bookingId);
    return {
      columns: staff.map((member) => ({
        id: member.id,
        kind: 'staff',
        title: member.displayName,
        subtitle: member.title,
        avatarUrl: avatars.forSeed(member.avatarSeed),
        typeTerm: null,
      })),
      workingHours: staff.flatMap((member) =>
        (staffHours.get(member.id) ?? []).map((day) => ({
          columnId: member.id,
          date: day.date,
          intervals: [...day.intervals],
        })),
      ),
      bookings: [...byBooking.values()].flatMap((bookingItems) => {
        const block = blockOf(bookingItems[0]?.staffId ?? '', bookingItems);
        return block ? [block] : [];
      }),
    };
  },
};

const resourceAxis: AxisStrategy = {
  layout: ({ resources, staffHours, items, resourceTerm }) => {
    const opening = openingHours(staffHours);
    return {
      columns: resources.map((resource) => ({
        id: resource.id,
        kind: 'resource',
        title: resource.name,
        subtitle: null,
        avatarUrl: null,
        typeTerm: resourceTerm(resource),
      })),
      workingHours: resources.flatMap((resource) =>
        opening.map((day) => ({
          columnId: resource.id,
          date: day.date,
          intervals: [...day.intervals],
        })),
      ),
      // Services of one booking on the same resource read as one visit.
      bookings: [
        ...Map.groupBy(
          items.filter((item) => item.resourceId !== null),
          (item) => `${item.bookingId}:${item.resourceId ?? ''}`,
        ).values(),
      ].flatMap((visitItems) => {
        const block = blockOf(visitItems[0]?.resourceId ?? '', visitItems);
        return block ? [block] : [];
      }),
    };
  },
};

export const scheduleAxisStrategies: Record<ScheduleAxis, AxisStrategy> = {
  staff: staffAxis,
  resource: resourceAxis,
};
