import type { CatalogService, Money, StaffOption } from '@mestechko/contracts/client';

export const flowSteps = ['services', 'staff', 'time', 'contact'] as const;
export type FlowStep = (typeof flowSteps)[number];

/** The visitor leaves the choice of staff member to the business. */
export const ANY_STAFF = 'any';

/** The booking taking shape, step by step. */
export interface FlowState {
  readonly step: FlowStep;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  /** A staff member's id, {@link ANY_STAFF}, or `null` before the choice. */
  readonly staff: string | null;
  readonly weekStart: string | null;
  readonly date: string | null;
  readonly start: string | null;
  /** One booking attempt per chosen start: repeating the press books once. */
  readonly attemptId: string;
}

export function initialFlow(locationId: string): FlowState {
  return {
    step: 'services',
    locationId,
    serviceIds: [],
    staff: null,
    weekStart: null,
    date: null,
    start: null,
    attemptId: crypto.randomUUID(),
  };
}

/** Whether the visitor may go on from a step with what they chose. */
export function canLeave(state: FlowState): boolean {
  switch (state.step) {
    case 'services':
      return state.serviceIds.length > 0;
    case 'staff':
      return state.staff !== null;
    case 'time':
      return state.start !== null;
    case 'contact':
      return true;
  }
}

export function stepAfter(step: FlowStep): FlowStep | null {
  return flowSteps[flowSteps.indexOf(step) + 1] ?? null;
}

export function stepBefore(step: FlowStep): FlowStep | null {
  return flowSteps[flowSteps.indexOf(step) - 1] ?? null;
}

export function staffIdOf(state: FlowState): string | null {
  return state.staff === ANY_STAFF ? null : state.staff;
}

/** What the booking costs as far as it is known: exact, or from the cheapest. */
export type DraftPrice =
  | { readonly kind: 'exact'; readonly total: Money }
  | { readonly kind: 'from'; readonly min: Money };

export function draftPrice(
  chosen: readonly CatalogService[],
  staff: StaffOption | null,
  quoted: Money | null,
): DraftPrice | null {
  if (quoted) {
    return { kind: 'exact', total: quoted };
  }
  if (staff) {
    return { kind: 'exact', total: staff.total };
  }
  const [first] = chosen;
  if (!first) {
    return null;
  }
  const min = {
    amountMinor: chosen.reduce((sum, service) => sum + service.price.amountMinor, 0),
    currency: first.price.currency,
  };
  return chosen.some((service) => service.priceVaries)
    ? { kind: 'from', min }
    : { kind: 'exact', total: min };
}
