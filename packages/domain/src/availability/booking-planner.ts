import {
  findContainingInterval,
  MS_PER_MINUTE,
  type InstantInterval,
} from '../time/instant-interval.js';
import type { BusyIndex } from './busy-index.js';
import { serviceMinutesFor, type ServiceSpec } from './service-spec.js';
import type { BookingPlan, PlannedItem, ResourceSpec, StaffCandidate } from './types.js';

export interface PlanningContext {
  readonly services: readonly ServiceSpec[];
  readonly resourcesByType: ReadonlyMap<string, readonly ResourceSpec[]>;
  readonly busy: BusyIndex;
}

interface Timing {
  readonly start: number;
  readonly end: number;
}

function itemTimings(
  staff: StaffCandidate,
  services: readonly ServiceSpec[],
  start: number,
): Timing[] {
  const timings: Timing[] = [];
  let cursor = start;
  for (const service of services) {
    const minutes = serviceMinutesFor(service, staff.serviceTerms.get(service.id));
    timings.push({ start: cursor, end: cursor + minutes * MS_PER_MINUTE });
    cursor += minutes * MS_PER_MINUTE;
  }
  return timings;
}

function pickResource(
  service: ServiceSpec,
  occupied: InstantInterval,
  context: PlanningContext,
): string | null | undefined {
  if (service.resourceTypeId === null) {
    return null;
  }
  const candidates = context.resourcesByType.get(service.resourceTypeId) ?? [];
  return candidates.find((resource) => context.busy.isResourceFree(resource.id, occupied))?.id;
}

/**
 * Plans the request for one staff member at `start` against their free time
 * (`free` must be normalized). Returns `null` when anything does not fit.
 */
export function planForStaff(
  staff: StaffCandidate,
  start: number,
  free: readonly InstantInterval[],
  context: PlanningContext,
): BookingPlan | null {
  const { services } = context;
  const first = services[0];
  const last = services.at(-1);
  if (!first || !last) {
    return null;
  }
  const timings = itemTimings(staff, services, start);
  const end = timings.at(-1)?.end ?? start;
  const occupied: InstantInterval = {
    start: start - first.bufferBeforeMinutes * MS_PER_MINUTE,
    end: end + last.bufferAfterMinutes * MS_PER_MINUTE,
  };
  if (findContainingInterval(free, occupied) < 0) {
    return null;
  }
  const items: PlannedItem[] = [];
  for (const [index, service] of services.entries()) {
    const timing = timings[index];
    if (!timing) {
      return null;
    }
    const itemOccupied: InstantInterval = {
      start: index === 0 ? occupied.start : timing.start,
      end: index === services.length - 1 ? occupied.end : timing.end,
    };
    const resourceId = pickResource(service, itemOccupied, context);
    if (resourceId === undefined) {
      return null;
    }
    items.push({ serviceId: service.id, ...timing, occupied: itemOccupied, resourceId });
  }
  return { staffId: staff.id, start, end, occupied, items };
}
