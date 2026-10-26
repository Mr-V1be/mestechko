import type { Me } from '@slotwise/contracts';
import { roles, type VerticalRegistry } from '@slotwise/domain';
import { ApplicationError } from '../../../shared/application/application-error.js';
import { verticalSummaryOf } from '../../tenancy/application/vertical-summary.js';
import type { MembershipDirectory } from '../../tenancy/application/business-directory.js';
import type { UserAccounts } from './ports.js';

/** The signed-in user with every business they can open and what their role allows. */
export class GetMe {
  constructor(
    private readonly accounts: UserAccounts,
    private readonly memberships: MembershipDirectory,
    private readonly verticals: VerticalRegistry,
  ) {}

  async execute(userId: string): Promise<Me> {
    const account = await this.accounts.findById(userId);
    if (!account) {
      throw new ApplicationError('unauthenticated', 'Account no longer exists');
    }
    const memberships = await this.memberships.listForUser(userId);
    return {
      user: { id: account.id, email: account.email, displayName: account.displayName },
      memberships: memberships.map((membership) => ({
        business: {
          id: membership.business.id,
          slug: membership.business.slug,
          name: membership.business.name,
          vertical: verticalSummaryOf(this.verticals.get(membership.business.verticalId)),
          currency: membership.business.currency,
        },
        role: membership.role,
        staffId: membership.staffId,
        access: { ...roles[membership.role].areas },
      })),
    };
  }
}
