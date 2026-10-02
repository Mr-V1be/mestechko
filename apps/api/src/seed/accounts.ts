import type { RoleId } from '@mestechko/domain';
import type { Kysely } from 'kysely';
import type { Database } from '../platform/db/database.js';
import type { IdGenerator } from '../shared/application/ports.js';
import type { BuiltCatalog } from './catalog-builder.js';
import type { DemoBusiness } from './definitions/types.js';

/** A cabinet account of a demo business: the owner or a staff member. */
export interface DemoAccount {
  readonly email: string;
  readonly displayName: string;
  readonly role: RoleId;
  readonly staffId: string | null;
}

/** Every demo sign-in email, so a reseed can remove the accounts first. */
export function demoAccountEmails(definitions: readonly DemoBusiness[]): string[] {
  return definitions.flatMap((definition) => [
    definition.owner.email,
    ...definition.staffAccounts.map((account) => account.email),
  ]);
}

export function demoAccountsOf(definition: DemoBusiness, catalog: BuiltCatalog): DemoAccount[] {
  const staffAccounts = definition.staffAccounts.map((account): DemoAccount => {
    const member = catalog.staff.find((candidate) => candidate.key === account.staffKey);
    if (!member) {
      throw new Error(`Unknown staff "${account.staffKey}" in ${definition.slug}`);
    }
    return {
      email: account.email,
      displayName: member.displayName,
      role: 'staff',
      staffId: member.id,
    };
  });
  return [
    {
      email: definition.owner.email,
      displayName: definition.owner.displayName,
      role: 'owner',
      staffId: null,
    },
    ...staffAccounts,
  ];
}

export async function writeDemoAccounts(
  db: Kysely<Database>,
  input: {
    readonly businessId: string;
    readonly accounts: readonly DemoAccount[];
    readonly passwordHash: string;
    readonly ids: IdGenerator;
    readonly now: Date;
  },
): Promise<void> {
  for (const account of input.accounts) {
    const userId = input.ids.next();
    await db
      .insertInto('users')
      .values({
        id: userId,
        email: account.email,
        displayName: account.displayName,
        passwordHash: input.passwordHash,
        createdAt: input.now,
      })
      .execute();
    await db
      .insertInto('memberships')
      .values({
        businessId: input.businessId,
        userId,
        role: account.role,
        staffId: account.staffId,
        createdAt: input.now,
      })
      .execute();
  }
}
