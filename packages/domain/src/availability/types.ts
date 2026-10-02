import type { BookingRules } from '../booking/booking-rules.js';
import type { ProductionCalendar } from '../calendar/production-calendar.js';
import type { StaffWorkCalendar } from '../scheduling/staff-work-calendar.js';
import type { InstantInterval } from '../time/instant-interval.js';
import type { Temporal } from '../time/temporal.js';
import type { PlainDate } from '../time/zoned-time.js';
import type { BusyIndex } from './busy-index.js';
import type { ServiceSpec, StaffServiceTerms } from './service-spec.js';

export interface StaffCandidate {
  readonly id: string;
  /** Position in the business's own ordering of staff. */
  readonly rank: number;
  readonly workCalendar: StaffWorkCalendar;
  /** Services the staff member provides, with personal terms. */
  readonly serviceTerms: ReadonlyMap<string, StaffServiceTerms>;
}

export interface ResourceSpec {
  readonly id: string;
  readonly typeId: string;
}

export interface BookingLocation {
  readonly id: string;
  readonly timeZone: string;
}

/** Everything needed to compute free start times; assembled by the application layer. */
export interface AvailabilityRequest {
  readonly location: BookingLocation;
  /** Inclusive range of local dates at the location. */
  readonly from: PlainDate;
  readonly to: PlainDate;
  /** Services in the order they are performed. */
  readonly services: readonly ServiceSpec[];
  readonly staff: readonly StaffCandidate[];
  readonly resources: readonly ResourceSpec[];
  readonly busy: BusyIndex;
  readonly calendar: ProductionCalendar;
  readonly rules: BookingRules;
  readonly now: Temporal.Instant;
}

export interface AvailableSlot {
  /** Start instant in epoch milliseconds. */
  readonly start: number;
  /** Staff members free at this start, in assignment order for "any staff" bookings. */
  readonly staffIds: readonly string[];
}

export interface DayAvailability {
  readonly date: PlainDate;
  readonly slots: readonly AvailableSlot[];
}

export interface PlannedItem {
  readonly serviceId: string;
  /** When the client is served. */
  readonly start: number;
  readonly end: number;
  /** Time blocked for staff and resource, including edge buffers. */
  readonly occupied: InstantInterval;
  readonly resourceId: string | null;
}

/** A concrete, conflict-free way to serve the request at one start time. */
export interface BookingPlan {
  readonly staffId: string;
  readonly start: number;
  readonly end: number;
  readonly occupied: InstantInterval;
  readonly items: readonly PlannedItem[];
}
