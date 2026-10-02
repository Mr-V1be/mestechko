import { ApplicationError } from '../../../../shared/application/application-error.js';
import type { BusinessAccess } from '../../../../shared/application/business-access.js';

/**
 * Staff filter implied by the access scope: `own` sees only the linked staff profile,
 * `all` sees everyone.
 */
export function staffFilterOf(access: BusinessAccess): string | null {
  if (access.scope === 'all') {
    return null;
  }
  if (!access.staffId) {
    throw new ApplicationError('forbidden', 'The role needs a staff profile');
  }
  return access.staffId;
}
