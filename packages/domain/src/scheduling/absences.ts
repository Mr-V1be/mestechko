import { invariant } from '../shared/domain-error.js';
import { Temporal } from '../time/temporal.js';
import type { PlainDate } from '../time/zoned-time.js';

/** Why a staff member is away; every kind takes whole days off. */
export const absenceKinds = ['vacation', 'sick_leave', 'day_off'] as const;
export type AbsenceKind = (typeof absenceKinds)[number];

/** Days away, both ends included; it wins over schedules and date exceptions. */
export interface StaffAbsence {
  readonly from: PlainDate;
  readonly to: PlainDate;
  readonly kind: AbsenceKind;
}

/** Days in the longest year: an absence lasts a year at most. */
const MAX_ABSENCE_DAYS = 366;

export function validateAbsence(absence: StaffAbsence): void {
  const days = absence.from.until(absence.to, { largestUnit: 'days' }).days + 1;
  invariant(
    days >= 1 && days <= MAX_ABSENCE_DAYS,
    'invalid_schedule',
    'An absence spans one day to a year, ending on or after it starts',
  );
}

export function isAbsent(absences: readonly StaffAbsence[], date: PlainDate): boolean {
  return absences.some(
    (absence) =>
      Temporal.PlainDate.compare(date, absence.from) >= 0 &&
      Temporal.PlainDate.compare(date, absence.to) <= 0,
  );
}
