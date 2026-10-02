import type { CalendarYear, PlainDate, StaffWorkCalendar } from '@mestechko/domain';

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
  fetchYear(countryCode: string, year: number): Promise<CalendarYear>;
}

export interface WarningLogger {
  warn(context: object, message: string): void;
}

export const WORK_CALENDAR_READER = Symbol('WORK_CALENDAR_READER');
export const PRODUCTION_CALENDAR_STORE = Symbol('PRODUCTION_CALENDAR_STORE');
export const PRODUCTION_CALENDAR_SOURCE = Symbol('PRODUCTION_CALENDAR_SOURCE');
