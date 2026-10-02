import { invariant } from '../shared/domain-error.js';

/** Two services a business never books together, e.g. a colouring and a perm. */
export interface IncompatiblePair {
  readonly serviceId: string;
  readonly otherServiceId: string;
}

/** Services from the list that cannot join it: each conflicts with one already chosen. */
export function incompatibleWith(
  chosen: readonly string[],
  pairs: readonly IncompatiblePair[],
): Set<string> {
  const blocked = new Set<string>();
  for (const pair of pairs) {
    if (chosen.includes(pair.serviceId)) {
      blocked.add(pair.otherServiceId);
    }
    if (chosen.includes(pair.otherServiceId)) {
      blocked.add(pair.serviceId);
    }
  }
  return blocked;
}

export function assertCompatible(
  serviceIds: readonly string[],
  pairs: readonly IncompatiblePair[],
): void {
  invariant(
    !pairs.some(
      (pair) => serviceIds.includes(pair.serviceId) && serviceIds.includes(pair.otherServiceId),
    ),
    'incompatible_services',
    'These services are not booked together',
  );
}
