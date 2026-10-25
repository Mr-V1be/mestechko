import type { AbsenceKind, BookingRulesOverrides, CurrencyCode, Locale } from '@mestechko/domain';

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
  /** How sought-after the person is: 1 is average, a top stylist fills up sooner. */
  readonly popularity?: number;
  /** Absences relative to the seed date, both ends included. */
  readonly absences?: readonly {
    readonly kind: AbsenceKind;
    readonly from: number;
    readonly to: number;
  }[];
}

/** A pass the business sells: visits of some services within so many days. */
export interface DemoPassPlan {
  readonly name: string;
  readonly visits: number;
  readonly validityDays: number;
  readonly priceMajor: number;
  readonly services: readonly string[];
}

export interface DemoBusiness {
  readonly slug: string;
  readonly name: string;
  readonly verticalId: string;
  readonly countryCode: string;
  readonly currency: CurrencyCode;
  /** The language of the business: its catalogue, its people and the demo it opens for. */
  readonly locale: Locale;
  readonly rulesOverrides?: BookingRulesOverrides;
  readonly owner: { readonly email: string; readonly displayName: string };
  /** Staff members who sign in to the cabinet; the role sees only their own work. */
  readonly staffAccounts: readonly { readonly staffKey: string; readonly email: string }[];
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
  readonly services: readonly {
    readonly template: string;
    readonly priceMajor?: number;
    /** The service's own prepayment share. */
    readonly depositPercent?: number;
  }[];
  /** Pairs of service templates never booked together. */
  readonly incompatible?: readonly (readonly [string, string])[];
  /** Points earned per 100 paid and the largest share payable with points. */
  readonly loyalty?: { readonly accrualPercent: number; readonly maxRedeemPercent: number };
  readonly passPlans?: readonly DemoPassPlan[];
  /** How the business keeps its client cards: the tag of regulars, other tags, notes. */
  readonly crm: {
    readonly regularTag: string;
    readonly tags: readonly string[];
    readonly notes: readonly string[];
  };
  readonly staff: readonly DemoStaff[];
  /** Share of female clients in the generated client base. */
  readonly femaleClientShare: number;
  readonly demand: DemoDemand;
}

/** A busier stretch of the week, e.g. Friday evening. */
export interface DemoPeak {
  /** ISO weekday, 1 = Monday. */
  readonly weekday: number;
  readonly from: string;
  readonly factor: number;
}

/**
 * How demand moves through the week and the day. Occupancy, revenue and no-shows of the
 * generated history all follow it, so reports look like a business, not a generator.
 */
export interface DemoDemand {
  /** Booked share of working time on an average day of the recent past. */
  readonly base: number;
  /** Booked share of the coming days, fading further ahead. */
  readonly upcoming: number;
  /** Monday-first multipliers of the base. */
  readonly weekdays: readonly [number, number, number, number, number, number, number];
  /** Relative pull of starts in the morning (before 12:00), the day and the evening (17:00+). */
  readonly dayParts: { readonly morning: number; readonly day: number; readonly evening: number };
  readonly peaks?: readonly DemoPeak[];
  /** Occupancy at the start of the history relative to today: below 1 for a growing business. */
  readonly trendStart: number;
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
