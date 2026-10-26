import { loyaltyKindIds, Temporal, type LoyaltyKind, type LoyaltySettings } from '@slotwise/domain';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import { isUniqueViolation } from '../../../platform/db/pg-errors.js';
import { sql } from 'kysely';
import type { ClientPassRecord, LoyaltyStore, PassPlanRecord } from '../application/ports.js';

const PASS_IDEMPOTENCY_CONSTRAINT = 'client_passes_idempotency_key';

function loyaltyKind(value: string): LoyaltyKind {
  const kind = loyaltyKindIds.find((candidate) => candidate === value);
  if (!kind) {
    throw new Error(`Unknown loyalty kind "${value}" in storage`);
  }
  return kind;
}

export class KyselyLoyaltyStore implements LoyaltyStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async program(): Promise<LoyaltySettings | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('loyaltyPrograms')
      .select(['kind', 'accrualPercent', 'maxRedeemPercent'])
      .executeTakeFirst();
    return row ? { ...row, kind: loyaltyKind(row.kind) } : null;
  }

  async saveProgram(settings: LoyaltySettings, now: Date): Promise<void> {
    const values = {
      kind: settings.kind,
      accrualPercent: settings.accrualPercent,
      maxRedeemPercent: settings.maxRedeemPercent,
      updatedAt: now,
    };
    await this.unitOfWork
      .tenant()
      .insertInto('loyaltyPrograms')
      .values({ businessId: this.unitOfWork.currentBusinessId(), ...values })
      .onConflict((conflict) => conflict.column('businessId').doUpdateSet(values))
      .execute();
  }

  async listPlans(): Promise<PassPlanRecord[]> {
    return this.plans();
  }

  async findPlan(planId: string): Promise<PassPlanRecord | null> {
    return (await this.plans(planId))[0] ?? null;
  }

  async savePlan(plan: PassPlanRecord, now: Date): Promise<void> {
    const db = this.unitOfWork.tenant();
    const businessId = this.unitOfWork.currentBusinessId();
    const fields = {
      name: plan.name,
      visits: plan.visits,
      validityDays: plan.validityDays,
      priceMinor: plan.priceMinor,
      isActive: plan.isActive,
      updatedAt: now,
    };
    await db
      .insertInto('passPlans')
      .values({
        id: plan.id,
        businessId,
        ...fields,
        sortOrder: sql<number>`(select coalesce(max(sort_order), -1) + 1 from pass_plans)`,
        createdAt: now,
      })
      .onConflict((conflict) => conflict.column('id').doUpdateSet(fields))
      .execute();
    await db.deleteFrom('passPlanServices').where('planId', '=', plan.id).execute();
    await db
      .insertInto('passPlanServices')
      .values(plan.serviceIds.map((serviceId) => ({ businessId, planId: plan.id, serviceId })))
      .execute();
  }

  async listPasses(clientId: string): Promise<ClientPassRecord[]> {
    return this.passes({ clientId });
  }

  async findPass(passId: string): Promise<ClientPassRecord | null> {
    return (await this.passes({ passId }))[0] ?? null;
  }

  async insertPass(
    pass: ClientPassRecord & {
      readonly planId: string;
      readonly soldByUserId: string | null;
      readonly idempotencyKey: string;
    },
  ): Promise<boolean> {
    const db = this.unitOfWork.tenant();
    const businessId = this.unitOfWork.currentBusinessId();
    await sql`savepoint pass_sale`.execute(db);
    try {
      await db
        .insertInto('clientPasses')
        .values({
          id: pass.id,
          businessId,
          clientId: pass.clientId,
          planId: pass.planId,
          name: pass.name,
          visits: pass.visits,
          priceMinor: pass.priceMinor,
          validFrom: pass.validFrom.toString(),
          validUntil: pass.validUntil.toString(),
          soldAt: pass.soldAt,
          soldByUserId: pass.soldByUserId,
          idempotencyKey: pass.idempotencyKey,
        })
        .execute();
      await db
        .insertInto('clientPassServices')
        .values(pass.serviceIds.map((serviceId) => ({ businessId, passId: pass.id, serviceId })))
        .execute();
      await sql`release savepoint pass_sale`.execute(db);
      return true;
    } catch (error) {
      await sql`rollback to savepoint pass_sale`.execute(db);
      if (isUniqueViolation(error, PASS_IDEMPOTENCY_CONSTRAINT)) {
        return false;
      }
      throw error;
    }
  }

  async soldPerPlan(): Promise<Map<string, number>> {
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('clientPasses')
      .select((eb) => ['planId', eb.fn.countAll<string>().as('sold')])
      .where('planId', 'is not', null)
      .groupBy('planId')
      .execute();
    return new Map(rows.flatMap((row) => (row.planId ? [[row.planId, Number(row.sold)]] : [])));
  }

  private async plans(planId?: string): Promise<PassPlanRecord[]> {
    const db = this.unitOfWork.tenant();
    let query = db
      .selectFrom('passPlans')
      .select(['id', 'name', 'visits', 'validityDays', 'priceMinor', 'isActive'])
      .orderBy('sortOrder')
      .orderBy('id');
    if (planId) {
      query = query.where('id', '=', planId);
    }
    const plans = await query.execute();
    if (plans.length === 0) {
      return [];
    }
    const services = await db
      .selectFrom('passPlanServices')
      .select(['planId', 'serviceId'])
      .where(
        'planId',
        'in',
        plans.map((plan) => plan.id),
      )
      .execute();
    return plans.map((plan) => ({
      ...plan,
      serviceIds: services.filter((row) => row.planId === plan.id).map((row) => row.serviceId),
    }));
  }

  private async passes(by: { clientId?: string; passId?: string }): Promise<ClientPassRecord[]> {
    const db = this.unitOfWork.tenant();
    let query = db
      .selectFrom('clientPasses as p')
      .select([
        'p.id',
        'p.clientId',
        'p.name',
        'p.visits',
        'p.priceMinor',
        'p.validFrom',
        'p.validUntil',
        'p.soldAt',
      ])
      .orderBy('p.soldAt', 'desc');
    if (by.clientId) {
      query = query.where('p.clientId', '=', by.clientId);
    }
    if (by.passId) {
      query = query.where('p.id', '=', by.passId);
    }
    const rows = await query.execute();
    if (rows.length === 0) {
      return [];
    }
    const services = await db
      .selectFrom('clientPassServices')
      .select(['passId', 'serviceId'])
      .where(
        'passId',
        'in',
        rows.map((row) => row.id),
      )
      .execute();
    return rows.map((row) => ({
      ...row,
      validFrom: Temporal.PlainDate.from(row.validFrom),
      validUntil: Temporal.PlainDate.from(row.validUntil),
      serviceIds: services.filter((service) => service.passId === row.id).map((s) => s.serviceId),
    }));
  }
}
