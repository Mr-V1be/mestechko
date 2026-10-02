import { invariant } from '../shared/domain-error.js';
import { Temporal } from '../time/temporal.js';
import type { PlainDate } from '../time/zoned-time.js';

const VISITS_RANGE = { min: 1, max: 100 } as const;
const VALIDITY_RANGE = { min: 1, max: 730 } as const;

/** A visit pass a business sells: so many visits of some services within so many days. */
export interface PassPlan {
  readonly visits: number;
  readonly validityDays: number;
  readonly priceMinor: number;
  readonly serviceIds: readonly string[];
}

export function validatePassPlan(plan: PassPlan): void {
  invariant(
    Number.isInteger(plan.visits) &&
      plan.visits >= VISITS_RANGE.min &&
      plan.visits <= VISITS_RANGE.max &&
      Number.isInteger(plan.validityDays) &&
      plan.validityDays >= VALIDITY_RANGE.min &&
      plan.validityDays <= VALIDITY_RANGE.max &&
      Number.isInteger(plan.priceMinor) &&
      plan.priceMinor >= 0 &&
      plan.serviceIds.length > 0,
    'invalid_pass',
    'A pass covers some services, 1–100 visits, for 1–730 days',
  );
}

/** A pass a client holds; the visits left come from the ledger. */
export interface ClientPass {
  readonly serviceIds: readonly string[];
  readonly validUntil: PlainDate;
  readonly visitsLeft: number;
}

export function passValidUntil(plan: PassPlan, soldOn: PlainDate): PlainDate {
  return soldOn.add({ days: plan.validityDays - 1 });
}

/** A pass pays for a visit when it covers every service of it, on the visit's day. */
export function passCovers(
  pass: ClientPass,
  serviceIds: readonly string[],
  on: PlainDate,
): boolean {
  return (
    pass.visitsLeft > 0 &&
    Temporal.PlainDate.compare(on, pass.validUntil) <= 0 &&
    serviceIds.length > 0 &&
    serviceIds.every((serviceId) => pass.serviceIds.includes(serviceId))
  );
}
