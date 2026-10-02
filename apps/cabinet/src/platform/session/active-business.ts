import type { Me, Membership } from '@mestechko/contracts/client';
import type { AccessArea } from '@mestechko/domain';
import { useParams } from 'react-router';

const LAST_BUSINESS_KEY = 'mst-cabinet-business';

export function rememberBusiness(businessId: string): void {
  try {
    window.localStorage.setItem(LAST_BUSINESS_KEY, businessId);
  } catch {
    // The first business opens next time.
  }
}

/** The business to open by default: the last one used, otherwise the first available. */
export function defaultMembership(me: Me): Membership | null {
  let last: string | null = null;
  try {
    last = window.localStorage.getItem(LAST_BUSINESS_KEY);
  } catch {
    last = null;
  }
  return (
    me.memberships.find((membership) => membership.business.id === last) ??
    me.memberships[0] ??
    null
  );
}

export function useActiveMembership(me: Me): Membership | null {
  const { businessId } = useParams();
  return me.memberships.find((membership) => membership.business.id === businessId) ?? null;
}

export function canOpen(membership: Membership, area: AccessArea): boolean {
  return membership.access[area] !== 'none';
}
