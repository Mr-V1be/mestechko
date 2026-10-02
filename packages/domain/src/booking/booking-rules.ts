import { validateCalendarPolicy, type CalendarPolicy } from '../calendar/calendar-policy.js';
import { invariant } from '../shared/domain-error.js';
import { MINUTES_PER_DAY } from '../time/wall-time.js';
import { staffAssignmentStrategies, type StaffAssignmentStrategyId } from './staff-assignment.js';

export interface PrepaymentRule {
  /** Share of the price paid in advance, `0` means no prepayment. */
  readonly depositPercent: number;
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
}

/** Only the differences from the vertical defaults are stored per business. */
export type BookingRulesOverrides = {
  readonly [K in keyof BookingRules]?: BookingRules[K] extends object
    ? Partial<BookingRules[K]>
    : BookingRules[K];
};

const SLOT_STEP_RANGE = { min: 5, max: 240 } as const;
const HORIZON_RANGE = { min: 1, max: 366 } as const;
const SERVICES_RANGE = { min: 1, max: 10 } as const;
const PERCENT_MAX = 100;
const CHANGE_CUTOFF_RANGE = { min: 0, max: 7 * 24 * 60 } as const;

function isWithin(value: number, range: { min: number; max: number }): boolean {
  return Number.isInteger(value) && value >= range.min && value <= range.max;
}

export function validateBookingRules(rules: BookingRules): void {
  invariant(
    isWithin(rules.slotStepMinutes, SLOT_STEP_RANGE) &&
      MINUTES_PER_DAY % rules.slotStepMinutes === 0,
    'invalid_booking_rules',
    'Slot step must divide a day into whole steps between 5 and 240 minutes',
  );
  invariant(
    Number.isInteger(rules.minLeadMinutes) && rules.minLeadMinutes >= 0,
    'invalid_booking_rules',
    'Lead time must be a non-negative number of minutes',
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
    rules.prepayment.depositPercent >= 0 && rules.prepayment.depositPercent <= PERCENT_MAX,
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
  };
  validateBookingRules(rules);
  return rules;
}
