import { roleIds, staffAssignmentStrategyIds, type RoleId } from '@mestechko/domain';
import type { Selectable } from 'kysely';
import { z } from 'zod';
import { currencyCode } from '../../../platform/db/column-parsers.js';
import type { Businesses } from '../../../platform/db/generated/database.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  BusinessDirectory,
  BusinessRecord,
  MembershipDirectory,
  MembershipRecord,
  RoleHolder,
} from '../application/business-directory.js';

const minutes = z.number().int().nonnegative();
const rulesOverridesSchema = z
  .object({
    slotStepMinutes: minutes,
    minLeadMinutes: minutes,
    horizonDays: minutes,
    maxServicesPerBooking: minutes,
    staffAssignment: z.enum(staffAssignmentStrategyIds),
    calendarPolicy: z
      .object({
        closeOnPublicHolidays: z.boolean(),
        closeOnNonWorkingDays: z.boolean(),
        preHolidayShorteningMinutes: minutes,
      })
      .partial(),
    prepayment: z.object({ depositPercent: minutes }).partial(),
    repeatVisit: z.object({ suggestAfterDays: minutes.nullable() }).partial(),
  })
  .partial()
  .strict();

function toRecord(row: Selectable<Businesses>): BusinessRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    verticalId: row.verticalId,
    countryCode: row.countryCode,
    currency: currencyCode(row.currency),
    rulesOverrides: rulesOverridesSchema.parse(
      row.rulesOverrides,
    ) as BusinessRecord['rulesOverrides'],
    isDemo: row.isDemo,
  };
}

export class KyselyBusinessDirectory implements BusinessDirectory, MembershipDirectory {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async findBySlug(slug: string): Promise<BusinessRecord | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('businesses')
      .selectAll()
      .where('slug', '=', slug)
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async findById(id: string): Promise<BusinessRecord | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('businesses')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async listDemo(): Promise<BusinessRecord[]> {
    const rows = await this.unitOfWork
      .platform()
      .selectFrom('businesses')
      .selectAll()
      .where('isDemo', '=', true)
      .orderBy('createdAt')
      .execute();
    return rows.map(toRecord);
  }

  async listCountryCodes(): Promise<string[]> {
    const rows = await this.unitOfWork
      .platform()
      .selectFrom('businesses')
      .select('countryCode')
      .distinct()
      .execute();
    return rows.map((row) => row.countryCode);
  }

  async listForUser(userId: string): Promise<MembershipRecord[]> {
    const rows = await this.membershipQuery().where('memberships.userId', '=', userId).execute();
    return rows.map((row) => this.toMembership(row));
  }

  async findUserWithRole(businessId: string, role: RoleId): Promise<string | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('memberships')
      .select('userId')
      .where('businessId', '=', businessId)
      .where('role', '=', role)
      .orderBy('createdAt')
      .executeTakeFirst();
    return row?.userId ?? null;
  }

  async listRoleHolders(businessId: string): Promise<RoleHolder[]> {
    const rows = await this.unitOfWork
      .platform()
      .selectFrom('memberships')
      .innerJoin('users', 'users.id', 'memberships.userId')
      .distinctOn('memberships.role')
      .select(['memberships.role', 'memberships.userId', 'users.displayName'])
      .where('memberships.businessId', '=', businessId)
      .orderBy('memberships.role')
      .orderBy('memberships.createdAt')
      .execute();
    return rows
      .map((row) => ({ role: row.role, userId: row.userId, displayName: row.displayName }))
      .sort((a, b) => roleIds.indexOf(a.role) - roleIds.indexOf(b.role));
  }

  async find(userId: string, businessId: string): Promise<MembershipRecord | null> {
    const row = await this.membershipQuery()
      .where('memberships.userId', '=', userId)
      .where('memberships.businessId', '=', businessId)
      .executeTakeFirst();
    return row ? this.toMembership(row) : null;
  }

  private membershipQuery() {
    return this.unitOfWork
      .platform()
      .selectFrom('memberships')
      .innerJoin('businesses', 'businesses.id', 'memberships.businessId')
      .selectAll('businesses')
      .select(['memberships.role', 'memberships.staffId'])
      .orderBy('businesses.name');
  }

  private toMembership(
    row: Selectable<Businesses> & { role: RoleId; staffId: string | null },
  ): MembershipRecord {
    return { business: toRecord(row), role: row.role, staffId: row.staffId };
  }
}
