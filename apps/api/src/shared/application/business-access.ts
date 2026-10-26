import type { AccessScope, RoleId } from '@slotwise/domain';

/** Verified membership of the signed-in user in the business a request addresses. */
export interface BusinessAccess {
  readonly businessId: string;
  readonly role: RoleId;
  readonly staffId: string | null;
  readonly scope: AccessScope;
}
