import type { VerticalSummary } from '@slotwise/contracts/client';
import {
  moneyFromMajor,
  type BookingStatus,
  type MarketCurrency,
  type Money,
} from '@slotwise/domain';

/**
 * Test data of the sign-in showcase: a morning in a demo salon. Names and services are
 * translation keys (`signIn.showcase.*`, `catalog:services.*`), times are minutes.
 */
export const showcaseVertical: VerticalSummary = {
  id: 'beauty_salon',
  icon: 'sparkles',
  vocabulary: { staff: 'master', resource: 'workplace', client: 'client' },
};

export interface ShowcaseVisit {
  readonly clientKey: string;
  readonly serviceKey: string;
  readonly status: BookingStatus;
  readonly start: number;
  readonly end: number;
  /** Clean-up after the service, drawn hatched like in the real schedule. */
  readonly afterMinutes: number;
}

export interface ShowcaseStaff {
  readonly key: string;
  readonly avatarSeed: string;
  readonly working: { readonly start: number; readonly end: number };
  readonly visits: readonly ShowcaseVisit[];
}

const hour = (value: number): number => value * 60;

export const showcaseStaff: readonly ShowcaseStaff[] = [
  {
    key: 'anna',
    avatarSeed: 'siren-anna',
    working: { start: hour(10), end: hour(14.5) },
    visits: [
      {
        clientKey: 'alina',
        serviceKey: 'women_haircut',
        status: 'completed',
        start: hour(10),
        end: hour(11),
        afterMinutes: 10,
      },
      {
        clientKey: 'polina',
        serviceKey: 'hair_coloring',
        status: 'confirmed',
        start: hour(11.5),
        end: hour(13.5),
        afterMinutes: 15,
      },
    ],
  },
  {
    key: 'maria',
    avatarSeed: 'siren-maria',
    working: { start: hour(10), end: hour(14.5) },
    visits: [
      {
        clientKey: 'kirill',
        serviceKey: 'men_haircut',
        status: 'completed',
        start: hour(10.25),
        end: hour(11),
        afterMinutes: 10,
      },
      {
        clientKey: 'sofia',
        serviceKey: 'blowout',
        status: 'confirmed',
        start: hour(12.5),
        end: hour(13.25),
        afterMinutes: 10,
      },
    ],
  },
  {
    key: 'olga',
    avatarSeed: 'siren-olga',
    working: { start: hour(10), end: hour(14.5) },
    visits: [
      {
        clientKey: 'vera',
        serviceKey: 'gel_manicure',
        status: 'completed',
        start: hour(10.5),
        end: hour(11.75),
        afterMinutes: 0,
      },
      {
        clientKey: 'daria',
        serviceKey: 'pedicure',
        status: 'confirmed',
        start: hour(12),
        end: hour(13),
        afterMinutes: 0,
      },
    ],
  },
];

/** The "now" line of the showcase schedule. */
export const SHOWCASE_NOW_MINUTE = hour(11.75);

/**
 * The client in the phone is picking a time with Maria for a colouring, priced like the
 * demo salon of the reader's market.
 */
export const showcasePhone = {
  staffKey: 'maria',
  serviceKey: 'hair_coloring',
  prices: {
    RUB: moneyFromMajor(4700, 'RUB'),
    USD: moneyFromMajor(165, 'USD'),
  } satisfies Readonly<Record<MarketCurrency, Money>>,
  chosenDayOffset: 1,
  daysShown: 7,
  slots: [
    { groupKey: 'morning', starts: [hour(10), hour(10.5), hour(11.25)] },
    { groupKey: 'afternoon', starts: [hour(12.5), hour(13), hour(14.75), hour(15.5), hour(16)] },
  ],
  chosenStart: hour(12.5),
} as const;
