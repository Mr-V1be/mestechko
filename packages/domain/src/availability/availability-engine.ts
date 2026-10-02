import { staffAssignmentStrategies, type AssignmentContext } from '../booking/staff-assignment.js';
import { validateBookingRules } from '../booking/booking-rules.js';
import { workingIntervals } from '../scheduling/day-template.js';
import { resolveStaffDay } from '../scheduling/staff-work-calendar.js';
import {
  MS_PER_MINUTE,
  normalizeIntervals,
  subtractIntervals,
  type InstantInterval,
} from '../time/instant-interval.js';
import { Temporal } from '../time/temporal.js';
import {
  assertTimeZone,
  datesBetween,
  localDateOf,
  localDayBounds,
  maxDate,
  minDate,
  wallIntervalToInstants,
  type PlainDate,
} from '../time/zoned-time.js';
import { planForStaff, type PlanningContext } from './booking-planner.js';
import { validateServiceCombo } from './service-spec.js';
import { startGrid } from './start-grid.js';
import type {
  AvailabilityRequest,
  AvailableSlot,
  BookingPlan,
  DayAvailability,
  ResourceSpec,
  StaffCandidate,
} from './types.js';

interface PreparedRequest {
  readonly request: AvailabilityRequest;
  readonly dates: readonly PlainDate[];
  readonly eligible: readonly StaffCandidate[];
  readonly planning: PlanningContext;
  readonly earliestStart: number;
}

function groupResources(resources: readonly ResourceSpec[]): Map<string, ResourceSpec[]> {
  const grouped = new Map<string, ResourceSpec[]>();
  for (const resource of resources) {
    grouped.set(resource.typeId, [...(grouped.get(resource.typeId) ?? []), resource]);
  }
  return grouped;
}

function prepare(request: AvailabilityRequest): PreparedRequest {
  const { rules, location, services } = request;
  validateBookingRules(rules);
  validateServiceCombo(services, rules.maxServicesPerBooking);
  assertTimeZone(location.timeZone);

  const nowEpoch = request.now.epochMilliseconds;
  const today = localDateOf(nowEpoch, location.timeZone);
  const from = maxDate(request.from, today);
  const to = minDate(request.to, today.add({ days: rules.horizonDays }));
  const dates = Temporal.PlainDate.compare(from, to) <= 0 ? datesBetween(from, to) : [];

  const eligible = request.staff
    .filter((staff) => services.every((service) => staff.serviceTerms.has(service.id)))
    .sort((a, b) => a.rank - b.rank);

  return {
    request,
    dates,
    eligible,
    planning: { services, resourcesByType: groupResources(request.resources), busy: request.busy },
    earliestStart: nowEpoch + rules.minLeadMinutes * MS_PER_MINUTE,
  };
}

/** Free time of a staff member on a local date: working hours minus existing occupancy. */
function freeTimeOn(
  prepared: PreparedRequest,
  staff: StaffCandidate,
  date: PlainDate,
): InstantInterval[] {
  const { location, calendar, rules, busy } = prepared.request;
  const template = resolveStaffDay(staff.workCalendar, date, location.id, {
    calendar,
    policy: rules.calendarPolicy,
  });
  if (!template) {
    return [];
  }
  const working = workingIntervals(template)
    .map((interval) => wallIntervalToInstants(date, interval, location.timeZone))
    .filter((interval): interval is InstantInterval => interval !== null);
  return subtractIntervals(normalizeIntervals(working), busy.staffBusy(staff.id));
}

function candidateStarts(prepared: PreparedRequest, date: PlainDate): number[] {
  const { location, rules } = prepared.request;
  return startGrid(date, location.timeZone, rules.slotStepMinutes).filter(
    (start) => start >= prepared.earliestStart,
  );
}

function assignmentContext(prepared: PreparedRequest, date: PlainDate): AssignmentContext {
  const dayWindow = localDayBounds(date, prepared.request.location.timeZone);
  const booked = new Map<string, number>();
  const ranks = new Map(prepared.eligible.map((staff) => [staff.id, staff.rank]));
  return {
    bookedMinutes: (staffId) => {
      const cached = booked.get(staffId);
      if (cached !== undefined) {
        return cached;
      }
      const minutes = prepared.request.busy.staffMinutesWithin(staffId, dayWindow);
      booked.set(staffId, minutes);
      return minutes;
    },
    rank: (staffId) => ranks.get(staffId) ?? Number.MAX_SAFE_INTEGER,
  };
}

/** Orders interchangeable staff of one day by the business's assignment strategy. */
function staffOrderFor(
  prepared: PreparedRequest,
  date: PlainDate,
): (staffIds: readonly string[]) => string[] {
  const strategy = staffAssignmentStrategies[prepared.request.rules.staffAssignment];
  const context = assignmentContext(prepared, date);
  return (staffIds) => strategy.order(staffIds, context);
}

function daySlots(prepared: PreparedRequest, date: PlainDate): AvailableSlot[] {
  const starts = candidateStarts(prepared, date);
  if (starts.length === 0) {
    return [];
  }
  const staffByStart = new Map<number, string[]>();
  for (const staff of prepared.eligible) {
    const free = freeTimeOn(prepared, staff, date);
    if (free.length === 0) {
      continue;
    }
    for (const start of starts) {
      if (planForStaff(staff, start, free, prepared.planning)) {
        staffByStart.set(start, [...(staffByStart.get(start) ?? []), staff.id]);
      }
    }
  }
  const order = staffOrderFor(prepared, date);
  return [...staffByStart.entries()]
    .sort(([a], [b]) => a - b)
    .map(([start, staffIds]) => ({ start, staffIds: order(staffIds) }));
}

/** Free start times per local date for the requested services and staff. */
export function findAvailability(request: AvailabilityRequest): DayAvailability[] {
  const prepared = prepare(request);
  return prepared.dates.map((date) => ({ date, slots: daySlots(prepared, date) }));
}

/** First free start of every eligible staff member within the request range. */
export function earliestSlotByStaff(request: AvailabilityRequest): Map<string, number> {
  const prepared = prepare(request);
  const earliest = new Map<string, number>();
  for (const date of prepared.dates) {
    const starts = candidateStarts(prepared, date);
    for (const staff of prepared.eligible) {
      if (earliest.has(staff.id)) {
        continue;
      }
      const free = freeTimeOn(prepared, staff, date);
      const start = starts.find((candidate) =>
        planForStaff(staff, candidate, free, prepared.planning),
      );
      if (start !== undefined) {
        earliest.set(staff.id, start);
      }
    }
    if (earliest.size === prepared.eligible.length) {
      break;
    }
  }
  return earliest;
}

/**
 * Conflict-free plans for a booking at `start`, best candidate first. Empty when the
 * start is not an offered slot (off-grid, too early, beyond the horizon or taken).
 */
export function planBookingOptions(request: AvailabilityRequest, start: number): BookingPlan[] {
  const prepared = prepare(request);
  const date = localDateOf(start, request.location.timeZone);
  if (!prepared.dates.some((candidate) => candidate.equals(date))) {
    return [];
  }
  if (!candidateStarts(prepared, date).includes(start)) {
    return [];
  }
  const plans = new Map<string, BookingPlan>();
  for (const staff of prepared.eligible) {
    const plan = planForStaff(staff, start, freeTimeOn(prepared, staff, date), prepared.planning);
    if (plan) {
      plans.set(staff.id, plan);
    }
  }
  return staffOrderFor(
    prepared,
    date,
  )([...plans.keys()]).flatMap((staffId) => {
    const plan = plans.get(staffId);
    return plan ? [plan] : [];
  });
}

/** Why a staff member cannot take the services at a start; the front desk shows it. */
export const unavailableReasons = [
  'past',
  'beyond_horizon',
  'off_grid',
  'not_qualified',
  'not_working',
  'outside_hours',
  'staff_busy',
  'resource_busy',
] as const;
export type UnavailableReason = (typeof unavailableReasons)[number];

/**
 * Explains why `planBookingOptions` finds nothing for a staff member at a start, from
 * the most basic cause to the most specific; `null` when the start can be planned.
 */
export function explainUnavailable(
  request: AvailabilityRequest,
  staffId: string,
  start: number,
): UnavailableReason | null {
  const prepared = prepare(request);
  const date = localDateOf(start, request.location.timeZone);
  if (start < prepared.earliestStart) {
    return 'past';
  }
  if (!prepared.dates.some((candidate) => candidate.equals(date))) {
    return 'beyond_horizon';
  }
  if (!candidateStarts(prepared, date).includes(start)) {
    return 'off_grid';
  }
  const staff = prepared.eligible.find((candidate) => candidate.id === staffId);
  if (!staff) {
    return 'not_qualified';
  }
  const template = resolveStaffDay(staff.workCalendar, date, request.location.id, {
    calendar: request.calendar,
    policy: request.rules.calendarPolicy,
  });
  if (!template) {
    return 'not_working';
  }
  const working = normalizeIntervals(
    workingIntervals(template)
      .map((interval) => wallIntervalToInstants(date, interval, request.location.timeZone))
      .filter((interval): interval is InstantInterval => interval !== null),
  );
  // Without resources the plan depends on the staff member's time alone.
  const staffOnly: PlanningContext = {
    ...prepared.planning,
    services: prepared.planning.services.map((service) => ({ ...service, resourceTypeId: null })),
  };
  if (!planForStaff(staff, start, working, staffOnly)) {
    return 'outside_hours';
  }
  const free = freeTimeOn(prepared, staff, date);
  if (!planForStaff(staff, start, free, staffOnly)) {
    return 'staff_busy';
  }
  return planForStaff(staff, start, free, prepared.planning) ? null : 'resource_busy';
}
