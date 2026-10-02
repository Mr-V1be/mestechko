import { describe, expect, it } from 'vitest';
import {
  calendarYear,
  DomainError,
  findAvailability,
  resolveStaffDay,
  YearlyProductionCalendar,
  type CalendarDayKind,
  type CalendarPolicy,
  type CyclePattern,
  type StaffWorkCalendar,
  validateWorkCalendar,
} from '../src/index.js';
import {
  date,
  day,
  everyDay,
  hours,
  LOCATION_ID,
  MONDAY,
  request,
  rules,
  startsOf,
} from './builders.js';

const ignore: CalendarPolicy = {
  closeOnPublicHolidays: false,
  closeOnNonWorkingDays: false,
  preHolidayShorteningMinutes: 0,
};

function calendarWith(marks: Record<string, CalendarDayKind>): YearlyProductionCalendar {
  const days: CalendarDayKind[] = Array.from({ length: 365 }, () => 'working');
  for (const [iso, kind] of Object.entries(marks)) {
    days[date(iso).dayOfYear - 1] = kind;
  }
  return new YearlyProductionCalendar([calendarYear(2026, days)]);
}

const resolve = (
  workCalendar: StaffWorkCalendar,
  iso: string,
  calendar = calendarWith({}),
  policy = ignore,
) => resolveStaffDay(workCalendar, date(iso), LOCATION_ID, { calendar, policy });

describe('schedule patterns', () => {
  it('maps weekly hours by weekday', () => {
    const week = [day('09:00', '18:00'), null, null, null, null, null, day('11:00', '16:00')];
    const workCalendar: StaffWorkCalendar = {
      assignments: [
        {
          locationId: LOCATION_ID,
          pattern: { kind: 'weekly', week },
          validFrom: MONDAY,
          validUntil: null,
        },
      ],
      overrides: [],
    };
    expect(resolve(workCalendar, '2026-03-02')?.work).toEqual([hours('09:00', '18:00')]);
    expect(resolve(workCalendar, '2026-03-03')).toBeNull();
    expect(resolve(workCalendar, '2026-03-08')?.work).toEqual([hours('11:00', '16:00')]);
  });

  it('rotates two-on two-off shifts in both directions from the anchor', () => {
    const shift = day('10:00', '22:00');
    const pattern: CyclePattern = {
      kind: 'cycle',
      anchorDate: MONDAY,
      days: [shift, shift, null, null],
    };
    const workCalendar: StaffWorkCalendar = {
      assignments: [
        { locationId: LOCATION_ID, pattern, validFrom: date('2026-01-01'), validUntil: null },
      ],
      overrides: [],
    };
    const working = ['2026-02-26', '2026-02-27', '2026-03-02', '2026-03-03', '2026-03-06'];
    const off = ['2026-02-28', '2026-03-01', '2026-03-04', '2026-03-05'];
    for (const iso of working) {
      expect(resolve(workCalendar, iso)).not.toBeNull();
    }
    for (const iso of off) {
      expect(resolve(workCalendar, iso)).toBeNull();
    }
  });

  it('applies assignments only within their validity and location', () => {
    const workCalendar: StaffWorkCalendar = {
      assignments: [
        {
          locationId: LOCATION_ID,
          pattern: everyDay(day('10:00', '19:00')),
          validFrom: date('2026-03-03'),
          validUntil: date('2026-03-04'),
        },
        {
          locationId: 'other-branch',
          pattern: everyDay(day('10:00', '19:00')),
          validFrom: date('2026-01-01'),
          validUntil: null,
        },
      ],
      overrides: [],
    };
    expect(resolve(workCalendar, '2026-03-02')).toBeNull();
    expect(resolve(workCalendar, '2026-03-04')).not.toBeNull();
    expect(resolve(workCalendar, '2026-03-05')).toBeNull();
  });

  it('lets an override replace the pattern for a single date', () => {
    const workCalendar: StaffWorkCalendar = {
      assignments: [
        {
          locationId: LOCATION_ID,
          pattern: everyDay(day('10:00', '19:00')),
          validFrom: MONDAY,
          validUntil: null,
        },
      ],
      overrides: [
        { date: date('2026-03-03'), locationId: null, template: null },
        { date: date('2026-03-04'), locationId: LOCATION_ID, template: day('12:00', '15:00') },
        { date: date('2026-03-05'), locationId: 'other-branch', template: day('12:00', '15:00') },
      ],
    };
    expect(resolve(workCalendar, '2026-03-03')).toBeNull();
    expect(resolve(workCalendar, '2026-03-04')?.work).toEqual([hours('12:00', '15:00')]);
    expect(resolve(workCalendar, '2026-03-05')).toBeNull();
  });

  it('rejects malformed patterns', () => {
    const withPattern = (pattern: StaffWorkCalendar['assignments'][number]['pattern']) => () => {
      validateWorkCalendar({
        assignments: [{ locationId: LOCATION_ID, pattern, validFrom: MONDAY, validUntil: null }],
        overrides: [],
      });
    };
    expect(withPattern({ kind: 'cycle', anchorDate: MONDAY, days: [null, null] })).toThrow(
      DomainError,
    );
    expect(withPattern({ kind: 'weekly', week: [day('10:00', '19:00')] })).toThrow(DomainError);
    expect(() => day('10:00', '19:00', [['18:00', '20:00']])).toThrow(DomainError);
  });
});

describe('production calendar', () => {
  const workCalendar: StaffWorkCalendar = {
    assignments: [
      {
        locationId: LOCATION_ID,
        pattern: everyDay(day('10:00', '19:00', [['18:00', '18:30']])),
        validFrom: date('2026-01-01'),
        validUntil: null,
      },
    ],
    overrides: [
      { date: date('2026-03-10'), locationId: LOCATION_ID, template: day('10:00', '14:00') },
    ],
  };
  const calendar = calendarWith({
    '2026-03-09': 'public_holiday',
    '2026-03-10': 'public_holiday',
    '2026-03-06': 'pre_holiday',
    '2026-03-07': 'non_working',
  });

  it('closes on public holidays when the business follows them', () => {
    const policy = { ...ignore, closeOnPublicHolidays: true };
    expect(resolve(workCalendar, '2026-03-09', calendar, policy)).toBeNull();
    expect(resolve(workCalendar, '2026-03-07', calendar, policy)).not.toBeNull();
    expect(resolve(workCalendar, '2026-03-09', calendar, ignore)).not.toBeNull();
  });

  it('closes on every official day off when the business follows the full calendar', () => {
    const policy = { ...ignore, closeOnNonWorkingDays: true };
    expect(resolve(workCalendar, '2026-03-07', calendar, policy)).toBeNull();
    expect(resolve(workCalendar, '2026-03-09', calendar, policy)).toBeNull();
  });

  it('shortens pre-holiday days including breaks that cross the new end', () => {
    const policy = { ...ignore, preHolidayShorteningMinutes: 60 };
    const shortened = resolve(workCalendar, '2026-03-06', calendar, policy);
    expect(shortened?.work).toEqual([hours('10:00', '18:00')]);
    expect(shortened?.breaks).toEqual([]);
  });

  it('keeps planned hours when the calendar of a year is unknown', () => {
    const unknownYear = new YearlyProductionCalendar([]);
    const policy = { ...ignore, closeOnNonWorkingDays: true };
    expect(resolve(workCalendar, '2026-03-07', unknownYear, policy)).not.toBeNull();
  });

  it('lets an explicit override win over a holiday', () => {
    const policy = { ...ignore, closeOnPublicHolidays: true };
    expect(resolve(workCalendar, '2026-03-10', calendar, policy)?.work).toEqual([
      hours('10:00', '14:00'),
    ]);
  });

  it('removes slots of closed days in availability', () => {
    const days = findAvailability(
      request({
        from: date('2026-03-09'),
        to: date('2026-03-09'),
        calendar,
        rules: rules({ calendarPolicy: { closeOnPublicHolidays: true } }),
      }),
    );
    expect(startsOf(days)).toEqual([]);
  });

  it('validates the number of days of a year', () => {
    expect(() =>
      calendarYear(
        2028,
        Array.from({ length: 365 }, () => 'working' as const),
      ),
    ).toThrow(DomainError);
  });
});
