import {
  BusyIndex,
  dayTemplate,
  emptyProductionCalendar,
  ignoreProductionCalendar,
  parseWallInterval,
  resolveBookingRules,
  Temporal,
  type AvailabilityRequest,
  type BookingRules,
  type BookingRulesOverrides,
  type DayTemplate,
  type Occupancy,
  type ScheduleAssignment,
  type ScheduleOverride,
  type ServiceSpec,
  type StaffCandidate,
  type WeeklyPattern,
} from '../src/index.js';

export const MOSCOW = 'Europe/Moscow';
export const LOCATION_ID = 'location-main';
/** Monday. */
export const MONDAY = Temporal.PlainDate.from('2026-03-02');

export const date = (iso: string): Temporal.PlainDate => Temporal.PlainDate.from(iso);

export const hours = (start: string, end: string) => parseWallInterval(start, end);

export const day = (start: string, end: string, breaks: [string, string][] = []): DayTemplate =>
  dayTemplate(
    [hours(start, end)],
    breaks.map(([from, to]) => hours(from, to)),
  );

export function everyDay(template: DayTemplate | null): WeeklyPattern {
  return { kind: 'weekly', week: Array.from({ length: 7 }, () => template) };
}

/** Epoch milliseconds of a local date-time, e.g. `at('2026-03-02T10:00')`. */
export function at(localDateTime: string, timeZone: string = MOSCOW): number {
  return Temporal.PlainDateTime.from(localDateTime).toZonedDateTime(timeZone).epochMilliseconds;
}

/** Local `HH:MM` of an instant for readable assertions. */
export function clock(epoch: number, timeZone: string = MOSCOW): string {
  return Temporal.Instant.fromEpochMilliseconds(epoch)
    .toZonedDateTimeISO(timeZone)
    .toPlainTime()
    .toString({ smallestUnit: 'minute' });
}

const baseRules: BookingRules = {
  slotStepMinutes: 30,
  minLeadMinutes: 0,
  horizonDays: 30,
  maxServicesPerBooking: 4,
  staffAssignment: 'balanced',
  calendarPolicy: ignoreProductionCalendar,
  prepayment: { depositPercent: 0, holdMinutes: 15 },
  repeatVisit: { suggestAfterDays: null },
  clientChanges: { cutoffMinutes: 120 },
  waitlist: { offerHoldMinutes: 20 },
};

export const rules = (overrides: BookingRulesOverrides = {}): BookingRules =>
  resolveBookingRules(baseRules, overrides);

export function service(
  id: string,
  durationMinutes: number,
  options: Partial<Omit<ServiceSpec, 'id' | 'durationMinutes'>> = {},
): ServiceSpec {
  return {
    id,
    durationMinutes,
    bufferBeforeMinutes: options.bufferBeforeMinutes ?? 0,
    bufferAfterMinutes: options.bufferAfterMinutes ?? 0,
    resourceTypeId: options.resourceTypeId ?? null,
  };
}

interface StaffOptions {
  readonly rank?: number;
  readonly pattern?: ScheduleAssignment['pattern'];
  readonly assignments?: readonly ScheduleAssignment[];
  readonly overrides?: readonly ScheduleOverride[];
  /** Service id to personal duration (`null` keeps the service duration). */
  readonly services: Readonly<Record<string, number | null>>;
}

export function staff(id: string, options: StaffOptions): StaffCandidate {
  const assignments = options.assignments ?? [
    {
      locationId: LOCATION_ID,
      pattern: options.pattern ?? everyDay(day('10:00', '19:00')),
      validFrom: date('2026-01-01'),
      validUntil: null,
    },
  ];
  return {
    id,
    rank: options.rank ?? 0,
    workCalendar: { assignments, overrides: options.overrides ?? [], absences: [] },
    serviceTerms: new Map(
      Object.entries(options.services).map(([serviceId, minutes]) => [
        serviceId,
        { durationMinutes: minutes },
      ]),
    ),
  };
}

export function busy(input: {
  staff?: [string, number, number][];
  resources?: [string, number, number][];
}): BusyIndex {
  const toOccupancy = ([subjectId, start, end]: [string, number, number]): Occupancy => ({
    subjectId,
    interval: { start, end },
  });
  return BusyIndex.from({
    staff: (input.staff ?? []).map(toOccupancy),
    resources: (input.resources ?? []).map(toOccupancy),
  });
}

export function request(overrides: Partial<AvailabilityRequest> = {}): AvailabilityRequest {
  return {
    location: { id: LOCATION_ID, timeZone: MOSCOW },
    from: MONDAY,
    to: MONDAY,
    services: [service('cut', 60)],
    staff: [staff('anna', { services: { cut: null } })],
    resources: [],
    busy: BusyIndex.empty(),
    calendar: emptyProductionCalendar,
    rules: rules(),
    now: Temporal.Instant.fromEpochMilliseconds(at('2026-03-01T12:00')),
    ...overrides,
  };
}

/** Local start times offered on the single requested day. */
export function startsOf(
  days: readonly { slots: readonly { start: number }[] }[],
  timeZone = MOSCOW,
) {
  return days.flatMap((entry) => entry.slots.map((slot) => clock(slot.start, timeZone)));
}
