import { describe, expect, it } from 'vitest';
import {
  applyScheduleChange,
  DomainError,
  ignoreProductionCalendar,
  patternFromTemplate,
  resolveStaffDay,
  validateAbsence,
  visitsOutsideWork,
  type StaffWorkCalendar,
} from '../src/index.js';
import { at, date, day, LOCATION_ID, MONDAY, MOSCOW } from './builders.js';
import { emptyProductionCalendar } from '../src/index.js';

const context = { calendar: emptyProductionCalendar, policy: ignoreProductionCalendar };
const hours = day('10:00', '19:00');

function calendarOf(
  template: Parameters<typeof patternFromTemplate>[0],
  extra: Partial<StaffWorkCalendar> = {},
  weekdays: number[] = [],
): StaffWorkCalendar {
  return {
    assignments: [
      {
        locationId: LOCATION_ID,
        pattern: patternFromTemplate(template, { hours, weekdays, anchorDate: MONDAY }),
        validFrom: MONDAY,
        validUntil: null,
      },
    ],
    overrides: [],
    absences: [],
    ...extra,
  };
}

const worksOn = (workCalendar: StaffWorkCalendar, iso: string) =>
  resolveStaffDay(workCalendar, date(iso), LOCATION_ID, context) !== null;

describe('schedule templates', () => {
  it('builds a five-day week', () => {
    const calendar = calendarOf('five_two');
    expect(['2026-03-06', '2026-03-07', '2026-03-08'].map((iso) => worksOn(calendar, iso))).toEqual(
      [true, false, false],
    );
  });

  it('counts two-on, two-off from the start date', () => {
    const calendar = calendarOf('two_two');
    const days = ['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06'];
    expect(days.map((iso) => worksOn(calendar, iso))).toEqual([true, true, false, false, true]);
  });

  it('works only on chosen weekdays and requires at least one', () => {
    const calendar = calendarOf('weekdays', {}, [2, 4]);
    expect(['2026-03-02', '2026-03-03', '2026-03-05'].map((iso) => worksOn(calendar, iso))).toEqual(
      [false, true, true],
    );
    expect(() => calendarOf('weekdays', {}, [])).toThrow(DomainError);
  });
});

describe('absences', () => {
  it('beats both the schedule and a date exception', () => {
    const calendar = calendarOf('five_two', {
      overrides: [{ date: date('2026-03-04'), locationId: LOCATION_ID, template: hours }],
      absences: [{ from: date('2026-03-03'), to: date('2026-03-05'), kind: 'vacation' }],
    });
    expect(
      ['2026-03-02', '2026-03-04', '2026-03-05', '2026-03-06'].map((iso) => worksOn(calendar, iso)),
    ).toEqual([true, false, false, true]);
  });

  it('ends on or after it starts and lasts at most a year', () => {
    expect(() => {
      validateAbsence({ from: date('2026-03-05'), to: date('2026-03-04'), kind: 'day_off' });
    }).toThrow(DomainError);
    expect(() => {
      validateAbsence({ from: date('2026-01-01'), to: date('2027-01-02'), kind: 'vacation' });
    }).toThrow(DomainError);
  });
});

describe('schedule impact', () => {
  const visit = (id: string, start: string, end: string) => ({
    id,
    locationId: LOCATION_ID,
    occupied: { start: at(start), end: at(end) },
  });

  it('lists visits the new schedule no longer covers', () => {
    const calendar = calendarOf('five_two', {
      overrides: [
        { date: date('2026-03-03'), locationId: LOCATION_ID, template: day('10:00', '14:00') },
      ],
      absences: [{ from: date('2026-03-04'), to: date('2026-03-04'), kind: 'sick_leave' }],
    });
    const visits = [
      visit('inside', '2026-03-02T10:00', '2026-03-02T11:00'),
      visit('shortened', '2026-03-03T13:30', '2026-03-03T14:30'),
      visit('absent', '2026-03-04T12:00', '2026-03-04T13:00'),
      visit('weekend', '2026-03-07T12:00', '2026-03-07T13:00'),
    ];
    expect(visitsOutsideWork(visits, calendar, MOSCOW, context).map((entry) => entry.id)).toEqual([
      'shortened',
      'absent',
      'weekend',
    ]);
  });
});

describe('schedule changes', () => {
  const base = calendarOf('five_two');

  it('applies a new pattern from a date and keeps the old one before it', () => {
    const changed = applyScheduleChange(base, {
      kind: 'pattern',
      locationId: LOCATION_ID,
      pattern: patternFromTemplate('two_two', {
        hours,
        weekdays: [],
        anchorDate: date('2026-03-09'),
      }),
      validFrom: date('2026-03-09'),
    });
    expect(
      changed.assignments.map((assignment) => assignment.validUntil?.toString() ?? null),
    ).toEqual(['2026-03-08', null]);
    expect(worksOn(changed, '2026-03-07')).toBe(false);
    expect(worksOn(changed, '2026-03-14')).toBe(true);
  });

  it('sets, then clears, a date exception', () => {
    const off = applyScheduleChange(base, {
      kind: 'day',
      date: date('2026-03-04'),
      day: { kind: 'off' },
    });
    expect(worksOn(off, '2026-03-04')).toBe(false);
    const back = applyScheduleChange(off, {
      kind: 'day',
      date: date('2026-03-04'),
      day: { kind: 'regular' },
    });
    expect(worksOn(back, '2026-03-04')).toBe(true);
  });

  it('refuses an absence overlapping another one', () => {
    const away = applyScheduleChange(base, {
      kind: 'absence',
      absence: { from: date('2026-03-02'), to: date('2026-03-06'), kind: 'vacation' },
    });
    expect(() =>
      applyScheduleChange(away, {
        kind: 'absence',
        absence: { from: date('2026-03-06'), to: date('2026-03-07'), kind: 'day_off' },
      }),
    ).toThrow(DomainError);
  });
});
