import type {
  CalendarYear,
  PlainDate,
  ScheduleAssignment,
  ScheduleChange,
  StaffAbsence,
  StaffWorkCalendar,
} from '@slotwise/domain';

export interface DateWindow {
  readonly from: PlainDate;
  readonly to: PlainDate;
}

/** Staff schedules of the current tenant in domain form. */
export interface WorkCalendarReader {
  /** Assignments and overrides of the staff that touch the window. */
  forStaff(
    staffIds: readonly string[],
    window: DateWindow,
  ): Promise<Map<string, StaffWorkCalendar>>;
  /** Staff with a schedule at the location somewhere within the window. */
  staffAssignedTo(locationId: string, window: DateWindow): Promise<Set<string>>;
}

export interface StoredCalendarYear extends CalendarYear {
  readonly revision: number;
}

/** Country-wide production calendars; shared by all tenants. */
export interface ProductionCalendarStore {
  load(countryCode: string, years: readonly number[]): Promise<StoredCalendarYear[]>;
  /** Saves a year and bumps its revision when the days changed. */
  save(countryCode: string, year: CalendarYear, source: string, fetchedAt: Date): Promise<void>;
}

/** External provider of official calendars. */
export interface ProductionCalendarSource {
  readonly name: string;
  /**
   * Whether the source publishes the country's calendar. Businesses elsewhere (the US
   * has no production calendar) follow their staff schedules alone.
   */
  covers(countryCode: string): boolean;
  fetchYear(countryCode: string, year: number): Promise<CalendarYear>;
}

export interface WarningLogger {
  warn(context: object, message: string): void;
}

export const WORK_CALENDAR_READER = Symbol('WORK_CALENDAR_READER');
export const PRODUCTION_CALENDAR_STORE = Symbol('PRODUCTION_CALENDAR_STORE');
export const PRODUCTION_CALENDAR_SOURCE = Symbol('PRODUCTION_CALENDAR_SOURCE');

/** Someone's working time as the cabinet edits it, with the ids of what it stores. */
export interface StaffScheduleSnapshot extends StaffWorkCalendar {
  readonly assignments: readonly (ScheduleAssignment & { readonly id: string })[];
  readonly absences: readonly (StaffAbsence & { readonly id: string })[];
}

/** Schedules of the current tenant as the team page reads and changes them. */
export interface ScheduleStore {
  /** Serializes schedule changes of one person until the transaction ends. */
  lockStaff(staffId: string): Promise<void>;
  /** Assignments still in effect on or after `from`, exceptions and absences from it on. */
  snapshots(
    staffIds: readonly string[],
    from: PlainDate,
  ): Promise<Map<string, StaffScheduleSnapshot>>;
  save(staffId: string, change: ScheduleChange, now: Date): Promise<void>;
}

export const SCHEDULE_STORE = Symbol('SCHEDULE_STORE');
