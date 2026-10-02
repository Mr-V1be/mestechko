import { MS_PER_MINUTE } from '../time/instant-interval.js';
import type { BookingRules } from './booking-rules.js';

interface HoldReasonDefinition {
  /** Minutes the time stays held, from the business's rules. */
  readonly minutes: (rules: BookingRules) => number;
  /** The hold ends when the prepayment arrives. */
  readonly awaitsPayment: boolean;
}

/**
 * Why a booking only holds its time for now. A held booking blocks the time like a
 * confirmed one, so nobody else takes it, and is released when the hold expires.
 */
export const holdReasons = {
  /** Waiting for the prepayment. */
  payment: { minutes: (rules) => rules.prepayment.holdMinutes, awaitsPayment: true },
  /** Freed time offered to the next client on the waitlist. */
  waitlist_offer: { minutes: (rules) => rules.waitlist.offerHoldMinutes, awaitsPayment: false },
} as const satisfies Record<string, HoldReasonDefinition>;

export type HoldReason = keyof typeof holdReasons;

export const holdReasonIds = Object.keys(holdReasons) as HoldReason[];

export function holdExpiry(reason: HoldReason, rules: BookingRules, now: number): number {
  return now + holdReasons[reason].minutes(rules) * MS_PER_MINUTE;
}
