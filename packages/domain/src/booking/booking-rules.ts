import { validateCalendarPolicy, type CalendarPolicy } from '../calendar/calendar-policy.js';
import { invariant } from '../shared/domain-error.js';
import { MINUTES_PER_DAY } from '../time/wall-time.js';
import { staffAssignmentStrategies, type StaffAssignmentStrategyId } from './staff-assignment.js';

export interface PrepaymentRule {
  /** Share of the price paid in advance, `0` means no prepayment. */
  readonly depositPercent: number;
  /** How long the time is held for an unpaid booking before it is released. */
  readonly holdMinutes: number;
}

export interface WaitlistRule {
  /** How long freed time is held for the client it is offered to, before the next. */
  readonly offerHoldMinutes: number;
}

export interface ClientChangesRule {
  /** Clients reschedule or cancel online until this many minutes before the visit. */
  readonly cutoffMinutes: number;
}

export interface RepeatVisitRule {
  /** Days after a visit when the client is invited back; `null` disables it. */
  readonly suggestAfterDays: number | null;
}

/** Booking behaviour of a business: vertical defaults plus the business's own overrides. */
export interface BookingRules {
  /** Grid of start times in minutes from local midnight. */
  readonly slotStepMinutes: number;
  /** How long before the start a client can still book. */
  readonly minLeadMinutes: number;
  /** How many days ahead clients can book. */
  readonly horizonDays: number;
  readonly maxServicesPerBooking: number;
  readonly staffAssignment: StaffAssignmentStrategyId;
  readonly calendarPolicy: CalendarPolicy;
  readonly prepayment: PrepaymentRule;
  readonly repeatVisit: RepeatVisitRule;
  readonly clientChanges: ClientChangesRule;
  readonly waitlist: WaitlistRule;
}

/** Only the differences from the vertical defaults are stored per business. */
export type BookingRulesOverrides = {
  readonly [K in keyof BookingRules]?: BookingRules[K] extends object
    ? Partial<BookingRules[K]>
    : BookingRules[K];
};

const SLOT_STEP_RANGE = { min: 5, max: 240 } as const;
const LEAD_RANGE = { min: 0, max: 7 * 24 * 60 } as const;
const HORIZON_RANGE = { min: 1, max: 366 } as const;
const SERVICES_RANGE = { min: 1, max: 10 } as const;
const PERCENT_RANGE = { min: 0, max: 100 } as const;
const CHANGE_CUTOFF_RANGE = { min: 0, max: 7 * 24 * 60 } as const;
const HOLD_RANGE = { min: 5, max: 24 * 60 } as const;

function isWithin(value: number, range: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= range.min && value <= range.max;
}

/**
 * Whole-number ranges of the rules a business tunes, so forms check what they offer
 * against the same limits the rules are validated with.
 */
export const bookingRuleLimits = {
  slotStepMinutes: SLOT_STEP_RANGE,
  minLeadMinutes: LEAD_RANGE,
  horizonDays: HORIZON_RANGE,
  maxServicesPerBooking: SERVICES_RANGE,
  depositPercent: PERCENT_RANGE,
  changeCutoffMinutes: CHANGE_CUTOFF_RANGE,
  holdMinutes: HOLD_RANGE,
} as const;

/** A slot step works only when whole steps fill a day. */
export function isValidSlotStep(minutes: number): boolean {
  return isWithin(minutes, SLOT_STEP_RANGE) && MINUTES_PER_DAY % minutes === 0;
}

export function validateBookingRules(rules: BookingRules): void {
  invariant(
    isValidSlotStep(rules.slotStepMinutes),
    'invalid_booking_rules',
    'Slot step must divide a day into whole steps between 5 and 240 minutes',
  );
  invariant(
    isWithin(rules.minLeadMinutes, LEAD_RANGE),
    'invalid_booking_rules',
    'Lead time must be between 0 minutes and 7 days',
  );
  invariant(isWithin(rules.horizonDays, HORIZON_RANGE), 'invalid_booking_rules', 'Invalid horizon');
  invariant(
    isWithin(rules.maxServicesPerBooking, SERVICES_RANGE),
    'invalid_booking_rules',
    'Invalid number of services per booking',
  );
  invariant(
    Object.hasOwn(staffAssignmentStrategies, rules.staffAssignment),
    'invalid_booking_rules',
    `Unknown staff assignment strategy "${rules.staffAssignment}"`,
  );
  invariant(
    isWithin(rules.prepayment.depositPercent, PERCENT_RANGE),
    'invalid_booking_rules',
    'Deposit must be between 0 and 100 percent',
  );
  invariant(
    rules.repeatVisit.suggestAfterDays === null || rules.repeatVisit.suggestAfterDays > 0,
    'invalid_booking_rules',
    'Repeat visit interval must be positive',
  );
  invariant(
    isWithin(rules.clientChanges.cutoffMinutes, CHANGE_CUTOFF_RANGE),
    'invalid_booking_rules',
    'Change cutoff must be between 0 minutes and 7 days',
  );
  invariant(
    isWithin(rules.prepayment.holdMinutes, HOLD_RANGE) &&
      isWithin(rules.waitlist.offerHoldMinutes, HOLD_RANGE),
    'invalid_booking_rules',
    'Holds last between 5 minutes and a day',
  );
  validateCalendarPolicy(rules.calendarPolicy);
}

export function resolveBookingRules(
  defaults: BookingRules,
  overrides: BookingRulesOverrides,
): BookingRules {
  const rules: BookingRules = {
    slotStepMinutes: overrides.slotStepMinutes ?? defaults.slotStepMinutes,
    minLeadMinutes: overrides.minLeadMinutes ?? defaults.minLeadMinutes,
    horizonDays: overrides.horizonDays ?? defaults.horizonDays,
    maxServicesPerBooking: overrides.maxServicesPerBooking ?? defaults.maxServicesPerBooking,
    staffAssignment: overrides.staffAssignment ?? defaults.staffAssignment,
    calendarPolicy: { ...defaults.calendarPolicy, ...overrides.calendarPolicy },
    prepayment: { ...defaults.prepayment, ...overrides.prepayment },
    repeatVisit: { ...defaults.repeatVisit, ...overrides.repeatVisit },
    clientChanges: { ...defaults.clientChanges, ...overrides.clientChanges },
    waitlist: { ...defaults.waitlist, ...overrides.waitlist },
  };
  validateBookingRules(rules);
  return rules;
}

/** Start precision of bookings the front desk places by hand. */
export const FRONT_DESK_STEP_MINUTES = SLOT_STEP_RANGE.min;

/**
 * Rules for bookings the business makes or moves itself. The engine still checks
 * schedules, breaks, buffers, resources and other bookings; only the limits meant for
 * online clients fall away: a walk-in may start now, far ahead, at any five minutes.
 */
export function frontDeskRules(rules: BookingRules): BookingRules {
  return {
    ...rules,
    slotStepMinutes: FRONT_DESK_STEP_MINUTES,
    minLeadMinutes: 0,
    horizonDays: HORIZON_RANGE.max,
  };
}
