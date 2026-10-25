import {
  bookingStatuses,
  BusyIndex,
  datesBetween,
  findAvailability,
  incompatibleWith,
  localDateOf,
  localDayBounds,
  localMinuteOf,
  planBookingOptions,
  quoteBooking,
  resolveStaffDay,
  Temporal,
  workingIntervals,
  type AvailabilityRequest,
  type BookingPlan,
  type BookingSource,
  type BookingStatus,
  type Occupancy,
  type PlainDate,
  type ProductionCalendar,
} from '@mestechko/domain';
import type { BuiltCatalog, BuiltService, BuiltStaff } from './catalog-builder.js';
import { attendanceRisk, dayDemand, startWeight } from './demand-model.js';
import { demoPopulations } from './people/index.js';
import type { Random } from './random.js';

export interface GeneratedBooking {
  readonly staff: BuiltStaff;
  readonly locationId: string;
  readonly plan: BookingPlan;
  readonly services: readonly BuiltService[];
  readonly prices: readonly number[];
  readonly totalMinor: number;
  readonly status: BookingStatus;
  readonly source: BookingSource;
  readonly clientIndex: number;
  readonly comment: string | null;
  readonly createdAt: Date;
}

const MAX_ATTEMPTS_PER_DAY = 40;
const COMBO_PROBABILITY = 0.2;
const COMMENT_PROBABILITY = 0.06;
const TELEGRAM_SHARE = 0.65;
const MAX_BOOKING_LEAD_DAYS = 14;
const MS_PER_DAY = 86_400_000;
const MS_PER_MINUTE = 60_000;
/** Returning clients book far more often than one-off visitors. */
const CLIENT_WEIGHT_DECAY = 0.993;
/** Demand fades for days further ahead: people book closer to the date. */
const FUTURE_DEMAND_DAYS = 24;
const MIN_FUTURE_DEMAND = 0.1;
/** Day-to-day scatter around the expected occupancy of a staff member. */
const DAILY_NOISE = 0.1;
const OCCUPANCY_RANGE = { min: 0.12, max: 0.96 } as const;
const NO_SHOW_RATE = 0.045;
const CANCEL_RATE = 0.085;

/** Visits that ended this recently may still wait for the desk to mark them. */
const UNMARKED_WINDOW_MS = 30 * 60 * MS_PER_MINUTE;
const UNMARKED_SHARE = 0.35;

/**
 * Past visits mostly happened; a few were missed or cancelled, and some of the latest
 * are not marked yet, as at any front desk. Future ones are mostly confirmed.
 */
function statusFor(random: Random, endsAt: number, now: number, risk: number): BookingStatus {
  if (endsAt > now) {
    return random.chance(0.07 * risk) ? 'cancelled' : 'confirmed';
  }
  if (now - endsAt < UNMARKED_WINDOW_MS && random.chance(UNMARKED_SHARE)) {
    return 'confirmed';
  }
  const roll = random.next();
  if (roll < NO_SHOW_RATE * risk) {
    return 'no_show';
  }
  return roll < (NO_SHOW_RATE + CANCEL_RATE) * risk ? 'cancelled' : 'completed';
}

interface DayContext {
  readonly catalog: BuiltCatalog;
  readonly calendar: ProductionCalendar;
  readonly random: Random;
  readonly date: PlainDate;
  readonly now: number;
  readonly occupancy: { staff: Occupancy[]; resources: Occupancy[] };
  readonly clientWeights: readonly number[];
}

function workingMinutes(context: DayContext, staff: BuiltStaff): number {
  const template = resolveStaffDay(staff.candidate.workCalendar, context.date, staff.locationId, {
    calendar: context.calendar,
    policy: context.catalog.rules.calendarPolicy,
  });
  return template
    ? workingIntervals(template).reduce((sum, interval) => sum + interval.end - interval.start, 0)
    : 0;
}

/** Mostly one service; sometimes a natural pair from two categories (haircut and brows). */
function pickServices(context: DayContext, staff: BuiltStaff): BuiltService[] {
  const offered = context.catalog.services.filter((service) =>
    staff.terms.some((term) => term.serviceId === service.id),
  );
  const first = context.random.pick(offered);
  const blocked = incompatibleWith([first.id], context.catalog.incompatible);
  const companions = offered.filter(
    (service) => service.categoryId !== first.categoryId && !blocked.has(service.id),
  );
  const chosen =
    context.random.chance(COMBO_PROBABILITY) && companions.length > 0
      ? [first, context.random.pick(companions)]
      : [first];
  return offered.filter((service) => chosen.includes(service));
}

function requestFor(
  context: DayContext,
  staff: BuiltStaff,
  services: readonly BuiltService[],
): AvailabilityRequest {
  const location = context.catalog.locations.find((candidate) => candidate.id === staff.locationId);
  if (!location) {
    throw new Error(`Staff ${staff.key} has no location`);
  }
  return {
    location: { id: location.id, timeZone: location.timeZone },
    from: context.date,
    to: context.date,
    services,
    staff: [staff.candidate],
    resources: context.catalog.resources
      .filter((resource) => resource.locationId === location.id)
      .map((resource) => ({ id: resource.id, typeId: resource.typeId })),
    busy: BusyIndex.from(context.occupancy),
    calendar: context.calendar,
    // History ignores lead time and horizon: it is written as if booked back then.
    rules: { ...context.catalog.rules, minLeadMinutes: 0, horizonDays: 366 },
    now: Temporal.Instant.fromEpochMilliseconds(
      localDayBounds(context.date, location.timeZone).start,
    ),
  };
}

/** One booking for the staff member on the day, or `null` when nothing fits. */
function bookOnce(context: DayContext, staff: BuiltStaff): GeneratedBooking | null {
  const { random, catalog } = context;
  const services = pickServices(context, staff);
  const request = requestFor(context, staff, services);
  const slots = findAvailability(request)[0]?.slots ?? [];
  if (slots.length === 0) {
    return null;
  }
  // Starts are not equally wanted: evenings and Friday nights go first at a salon.
  const timeZone = request.location.timeZone;
  const weekday = context.date.dayOfWeek;
  const start =
    slots[
      random.weighted(
        slots.map((slot) =>
          startWeight(catalog.definition.demand, weekday, localMinuteOf(slot.start, timeZone)),
        ),
      )
    ]?.start;
  const plan = start === undefined ? undefined : planBookingOptions(request, start)[0];
  if (!plan) {
    return null;
  }
  const quote = quoteBooking(
    services.map((service) => ({
      serviceId: service.id,
      basePriceMinor: service.priceMinor,
      staffPriceMinor:
        staff.terms.find((term) => term.serviceId === service.id)?.priceMinor ?? null,
    })),
    catalog.definition.currency,
  );
  const status = statusFor(
    random,
    plan.end,
    context.now,
    attendanceRisk(weekday, localMinuteOf(plan.start, timeZone)),
  );
  const bookedAt =
    plan.start -
    random.int(0, MAX_BOOKING_LEAD_DAYS) * MS_PER_DAY -
    random.int(1, 600) * MS_PER_MINUTE;
  return {
    staff,
    locationId: staff.locationId,
    plan,
    services,
    prices: quote.items.map((item) => item.price.amountMinor),
    totalMinor: quote.total.amountMinor,
    status,
    source: random.chance(TELEGRAM_SHARE) ? 'telegram_mini_app' : 'cabinet',
    clientIndex: random.weighted(context.clientWeights),
    comment: random.chance(COMMENT_PROBABILITY)
      ? random.pick(demoPopulations[context.catalog.definition.locale].comments)
      : null,
    createdAt: new Date(Math.min(bookedAt, context.now)),
  };
}

function occupy(context: DayContext, booking: GeneratedBooking): number {
  if (!bookingStatuses[booking.status].occupiesTime) {
    return 0;
  }
  context.occupancy.staff.push({ subjectId: booking.staff.id, interval: booking.plan.occupied });
  for (const item of booking.plan.items) {
    if (item.resourceId) {
      context.occupancy.resources.push({ subjectId: item.resourceId, interval: item.occupied });
    }
  }
  return (booking.plan.occupied.end - booking.plan.occupied.start) / MS_PER_MINUTE;
}

/**
 * Fills staff calendars with plausible bookings using the availability engine itself,
 * so every generated booking satisfies the same rules and constraints as real ones.
 */
export function generateHistory(input: {
  readonly catalog: BuiltCatalog;
  readonly calendar: ProductionCalendar;
  readonly from: PlainDate;
  readonly to: PlainDate;
  readonly now: Temporal.Instant;
  readonly random: Random;
  readonly clientCount: number;
}): GeneratedBooking[] {
  const { catalog, random } = input;
  const now = input.now.epochMilliseconds;
  const clientWeights = Array.from(
    { length: input.clientCount },
    (_, index) => CLIENT_WEIGHT_DECAY ** index,
  );
  const mainZone = catalog.locations[0]?.timeZone ?? 'UTC';
  const today = localDateOf(now, mainZone);
  const bookings: GeneratedBooking[] = [];

  for (const date of datesBetween(input.from, input.to)) {
    const context: DayContext = {
      catalog,
      calendar: input.calendar,
      random,
      date,
      now,
      occupancy: { staff: [], resources: [] },
      clientWeights,
    };
    const daysAhead = today.until(date, { largestUnit: 'days' }).days;
    const { demand } = catalog.definition;
    const busyness = dayDemand({
      demand,
      date,
      historyStart: input.from,
      today,
      calendar: input.calendar,
    });
    for (const staff of random.shuffle(catalog.staff)) {
      const available = workingMinutes(context, staff);
      if (available === 0) {
        continue;
      }
      const popularity =
        catalog.definition.staff.find((candidate) => candidate.key === staff.key)?.popularity ?? 1;
      const expected =
        daysAhead <= 0
          ? demand.base * busyness * popularity
          : demand.upcoming *
            busyness *
            popularity *
            Math.max(MIN_FUTURE_DEMAND, 1 - daysAhead / FUTURE_DEMAND_DAYS);
      const target = Math.min(
        OCCUPANCY_RANGE.max,
        Math.max(OCCUPANCY_RANGE.min, expected * random.between(1 - DAILY_NOISE, 1 + DAILY_NOISE)),
      );
      let booked = 0;
      for (
        let attempt = 0;
        attempt < MAX_ATTEMPTS_PER_DAY && booked < target * available;
        attempt += 1
      ) {
        const booking = bookOnce(context, staff);
        if (booking) {
          bookings.push(booking);
          booked += occupy(context, booking);
        }
      }
    }
  }
  return bookings;
}
