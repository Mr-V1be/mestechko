import {
  anyOverlap,
  normalizeIntervals,
  type InstantInterval,
  MS_PER_MINUTE,
} from '../time/instant-interval.js';

export interface Occupancy {
  readonly subjectId: string;
  readonly interval: InstantInterval;
}

const EMPTY: readonly InstantInterval[] = [];

/** Existing occupancies of staff members and resources, normalized for fast lookups. */
export class BusyIndex {
  private readonly staff: ReadonlyMap<string, readonly InstantInterval[]>;
  private readonly resources: ReadonlyMap<string, readonly InstantInterval[]>;

  private constructor(
    staff: ReadonlyMap<string, readonly InstantInterval[]>,
    resources: ReadonlyMap<string, readonly InstantInterval[]>,
  ) {
    this.staff = staff;
    this.resources = resources;
  }

  static from(input: {
    readonly staff: readonly Occupancy[];
    readonly resources: readonly Occupancy[];
  }): BusyIndex {
    return new BusyIndex(BusyIndex.group(input.staff), BusyIndex.group(input.resources));
  }

  static empty(): BusyIndex {
    return BusyIndex.from({ staff: [], resources: [] });
  }

  private static group(occupancies: readonly Occupancy[]): Map<string, InstantInterval[]> {
    const grouped = new Map<string, InstantInterval[]>();
    for (const occupancy of occupancies) {
      const list = grouped.get(occupancy.subjectId) ?? [];
      list.push(occupancy.interval);
      grouped.set(occupancy.subjectId, list);
    }
    for (const [subjectId, list] of grouped) {
      grouped.set(subjectId, normalizeIntervals(list));
    }
    return grouped;
  }

  staffBusy(staffId: string): readonly InstantInterval[] {
    return this.staff.get(staffId) ?? EMPTY;
  }

  isResourceFree(resourceId: string, interval: InstantInterval): boolean {
    return !anyOverlap(this.resources.get(resourceId) ?? EMPTY, interval);
  }

  /** Minutes of staff occupancy that fall inside `window`. */
  staffMinutesWithin(staffId: string, window: InstantInterval): number {
    let total = 0;
    for (const interval of this.staffBusy(staffId)) {
      const start = Math.max(interval.start, window.start);
      const end = Math.min(interval.end, window.end);
      if (start < end) {
        total += end - start;
      }
    }
    return total / MS_PER_MINUTE;
  }
}
