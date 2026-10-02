import type { BookingRulesOverrides, CurrencyCode } from '@mestechko/domain';

/** Working hours of one day in a demo schedule: `['10:00', '20:00']` plus optional breaks. */
export interface DemoDay {
  readonly hours: readonly [string, string];
  readonly breaks?: readonly (readonly [string, string])[];
}

export type DemoPattern =
  | { readonly kind: 'weekly'; readonly week: readonly (DemoDay | null)[] }
  /** Shift cycle starting `anchorOffsetDays` after the Monday of the seed week. */
  | {
      readonly kind: 'cycle';
      readonly anchorOffsetDays: number;
      readonly days: readonly (DemoDay | null)[];
    };

export interface DemoStaffService {
  readonly template: string;
  readonly durationMinutes?: number;
  readonly priceMajor?: number;
}

export interface DemoStaff {
  readonly key: string;
  readonly displayName: string;
  readonly title: string;
  readonly locationKey: string;
  readonly pattern: DemoPattern;
  readonly services: readonly (string | DemoStaffService)[];
  /** Days off relative to the seed date, e.g. a vacation day next week. */
  readonly daysOff?: readonly number[];
}

export interface DemoBusiness {
  readonly slug: string;
  readonly name: string;
  readonly verticalId: string;
  readonly countryCode: string;
  readonly currency: CurrencyCode;
  readonly rulesOverrides?: BookingRulesOverrides;
  readonly owner: { readonly email: string; readonly displayName: string };
  readonly locations: readonly {
    readonly key: string;
    readonly name: string;
    readonly address: string;
    readonly timeZone: string;
  }[];
  readonly resources: readonly {
    readonly locationKey: string;
    readonly typeId: string;
    readonly name: string;
  }[];
  /** Service templates of the vertical the business offers, with its own prices. */
  readonly services: readonly { readonly template: string; readonly priceMajor?: number }[];
  readonly staff: readonly DemoStaff[];
  /** Share of female clients in the generated client base. */
  readonly femaleClientShare: number;
  /** Booked share of working time in the past and in the coming days. */
  readonly utilization: { readonly past: readonly [number, number]; readonly upcoming: number };
}

export const day = (
  from: string,
  to: string,
  ...breaks: (readonly [string, string])[]
): DemoDay => ({
  hours: [from, to],
  breaks,
});

/** Monday-first week with the same hours on the listed weekdays (1 = Monday). */
export function weekdays(hours: DemoDay, days: readonly number[]): DemoPattern {
  return {
    kind: 'weekly',
    week: Array.from({ length: 7 }, (_, index) => (days.includes(index + 1) ? hours : null)),
  };
}

/** Two days on, two days off. */
export function twoByTwo(hours: DemoDay, anchorOffsetDays: number): DemoPattern {
  return { kind: 'cycle', anchorOffsetDays, days: [hours, hours, null, null] };
}
