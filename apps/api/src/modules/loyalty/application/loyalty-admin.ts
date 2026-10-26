import type { LoyaltyProgram, PassPlan } from '@slotwise/contracts';
import {
  localDateOf,
  passValidUntil,
  validateLoyaltySettings,
  validatePassPlan,
  type Clock,
  type CurrencyCode,
} from '@slotwise/domain';
import { notFound } from '../../../shared/application/application-error.js';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { CatalogReader } from '../../catalog/application/catalog-reader.js';
import type { LedgerBook } from './ledger-book.js';
import {
  DuplicateLedgerRequestError,
  type ClientPassRecord,
  type LedgerEntryView,
  type LedgerStore,
  type LoyaltyStore,
  type PassPlanRecord,
} from './ports.js';
import { noLoyalty } from './visit-settlements.js';

export interface PlanFields {
  readonly name: string;
  readonly visits: number;
  readonly validityDays: number;
  readonly priceMinor: number;
  readonly serviceIds: readonly string[];
  readonly isActive: boolean;
}

/** Who acts from the cabinet and in which business. */
export interface CabinetActor {
  readonly userId: string;
  readonly currency: CurrencyCode;
  readonly timeZone: string;
}

/** A client's balances as the cabinet shows them. */
export interface ClientLoyalty {
  readonly points: number;
  readonly passes: readonly (ClientPassRecord & { readonly visitsLeft: number })[];
  readonly ledger: readonly LedgerEntryView[];
}

const LEDGER_PREVIEW = 20;

/**
 * The cabinet's loyalty desk: the program, the passes on sale, selling a pass and
 * correcting points. Runs inside the caller's tenant unit of work.
 */
export class LoyaltyAdmin {
  constructor(
    private readonly store: LoyaltyStore,
    private readonly ledger: LedgerStore,
    private readonly book: LedgerBook,
    private readonly catalog: CatalogReader,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async program(): Promise<LoyaltyProgram> {
    return (await this.store.program()) ?? noLoyalty;
  }

  async updateProgram(program: LoyaltyProgram): Promise<LoyaltyProgram> {
    validateLoyaltySettings(program);
    await this.store.saveProgram(program, this.now());
    return program;
  }

  async plans(currency: CurrencyCode): Promise<PassPlan[]> {
    const [plans, sold] = await Promise.all([this.store.listPlans(), this.store.soldPerPlan()]);
    return plans.map((plan) => this.planView(plan, sold.get(plan.id) ?? 0, currency));
  }

  async savePlan(planId: string | null, fields: PlanFields, currency: CurrencyCode) {
    validatePassPlan(fields);
    const services = await this.catalog.listServices(fields.serviceIds);
    if (services.length !== new Set(fields.serviceIds).size) {
      throw notFound('Service');
    }
    if (planId !== null && !(await this.store.findPlan(planId))) {
      throw notFound('Pass plan');
    }
    const plan: PassPlanRecord = { id: planId ?? this.ids.next(), ...fields };
    await this.store.savePlan(plan, this.now());
    const sold = (await this.store.soldPerPlan()).get(plan.id) ?? 0;
    return this.planView(plan, sold, currency);
  }

  /** Sells a pass paid at the front desk: its visits and the money go to the ledger. */
  async sellPass(
    clientId: string,
    planId: string,
    idempotencyKey: string,
    actor: CabinetActor,
  ): Promise<void> {
    const plan = await this.store.findPlan(planId);
    if (!plan?.isActive) {
      throw notFound('Pass plan');
    }
    const now = this.now();
    const soldOn = localDateOf(now.getTime(), actor.timeZone);
    const passId = this.ids.next();
    const inserted = await this.store.insertPass({
      id: passId,
      clientId,
      planId: plan.id,
      name: plan.name,
      visits: plan.visits,
      priceMinor: plan.priceMinor,
      validFrom: soldOn,
      validUntil: passValidUntil(plan, soldOn),
      serviceIds: plan.serviceIds,
      soldAt: now,
      soldByUserId: actor.userId,
      idempotencyKey,
    });
    if (!inserted) {
      return;
    }
    await this.book.post({ clientId, currency: actor.currency, actorUserId: actor.userId, now }, [
      { reason: 'pass_sale', amount: plan.visits, passId },
      ...(plan.priceMinor > 0
        ? [{ reason: 'pass_payment' as const, amount: plan.priceMinor, passId }]
        : []),
    ]);
  }

  async adjustPoints(
    clientId: string,
    change: { readonly amount: number; readonly note: string; readonly idempotencyKey: string },
    actor: CabinetActor,
  ): Promise<void> {
    try {
      await this.book.post(
        { clientId, currency: actor.currency, actorUserId: actor.userId, now: this.now() },
        [
          {
            reason: 'points_adjustment',
            amount: change.amount,
            note: change.note,
            idempotencyKey: change.idempotencyKey,
          },
        ],
      );
    } catch (error) {
      if (!(error instanceof DuplicateLedgerRequestError)) {
        throw error;
      }
    }
  }

  async clientLoyalty(clientId: string): Promise<ClientLoyalty> {
    const passes = await this.store.listPasses(clientId);
    const [points, left, ledger] = await Promise.all([
      this.ledger.balance(clientId, 'points'),
      this.ledger.passBalances(passes.map((pass) => pass.id)),
      this.ledger.listForClient(clientId, LEDGER_PREVIEW),
    ]);
    return {
      points,
      passes: passes.map((pass) => ({ ...pass, visitsLeft: left.get(pass.id) ?? 0 })),
      ledger,
    };
  }

  private planView(plan: PassPlanRecord, sold: number, currency: CurrencyCode): PassPlan {
    return {
      id: plan.id,
      name: plan.name,
      visits: plan.visits,
      validityDays: plan.validityDays,
      price: { amountMinor: plan.priceMinor, currency },
      serviceIds: [...plan.serviceIds],
      isActive: plan.isActive,
      sold,
    };
  }

  private now(): Date {
    return new Date(this.clock.now().epochMilliseconds);
  }
}
