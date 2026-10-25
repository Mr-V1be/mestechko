import type { MarketCurrency } from '../locales/locales.js';
import { moneyFromMajor, type Money } from '../money/money.js';

/** What a subscription includes; names and descriptions live in the translation system. */
export const planFeatureIds = [
  'miniapp_booking',
  'bot_reminders',
  'schedule',
  'client_cards',
  'prepayment',
  'loyalty',
  'reports',
  'website_widget',
  'many_locations',
  'branch_reports',
  'priority_support',
] as const;

export type PlanFeature = (typeof planFeatureIds)[number];

export interface PricingPlan {
  /** The price in every currency the product is sold in; each market sees its own. */
  readonly monthlyPrices: Readonly<Record<MarketCurrency, Money>>;
  /** `null` means no limit. */
  readonly maxStaff: number | null;
  readonly maxLocations: number | null;
  readonly features: readonly PlanFeature[];
  /** The plan the service suggests starting with; the page singles it out. */
  readonly recommended: boolean;
}

const prices = (rub: number, usd: number): PricingPlan['monthlyPrices'] => ({
  RUB: moneyFromMajor(rub, 'RUB'),
  USD: moneyFromMajor(usd, 'USD'),
});

const essentials: readonly PlanFeature[] = [
  'miniapp_booking',
  'bot_reminders',
  'schedule',
  'client_cards',
];
const growth: readonly PlanFeature[] = [
  ...essentials,
  'prepayment',
  'loyalty',
  'reports',
  'website_widget',
];

/** Subscription plans of the service, in the order they are offered. */
export const pricingPlans = {
  start: {
    monthlyPrices: prices(990, 15),
    maxStaff: 3,
    maxLocations: 1,
    features: essentials,
    recommended: false,
  },
  team: {
    monthlyPrices: prices(2490, 35),
    maxStaff: 10,
    maxLocations: 1,
    features: growth,
    recommended: true,
  },
  network: {
    monthlyPrices: prices(5990, 79),
    maxStaff: null,
    maxLocations: null,
    features: [...growth, 'many_locations', 'branch_reports', 'priority_support'],
    recommended: false,
  },
} as const satisfies Record<string, PricingPlan>;

export type PricingPlanId = keyof typeof pricingPlans;

export const pricingPlanIds = Object.keys(pricingPlans) as PricingPlanId[];

/** Days a new business uses any plan before paying. */
export const TRIAL_DAYS = 14;
