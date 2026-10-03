import {
  passCovers,
  pointsRedeemable,
  settleVisit,
  type CurrencyCode,
  type LoyaltySettings,
  type PlainDate,
  type VisitSettlement,
} from '@mestechko/domain';
import { ApplicationError } from '../../../shared/application/application-error.js';
import type { LedgerBook } from './ledger-book.js';
import type { ClientPassRecord, LedgerStore, LoyaltyStore } from './ports.js';

/** A business without a program accrues and redeems nothing. */
export const noLoyalty: LoyaltySettings = {
  kind: 'none',
  accrualPercent: 0,
  maxRedeemPercent: 0,
};

export interface VisitToSettle {
  readonly clientId: string;
  readonly bookingId: string;
  readonly serviceIds: readonly string[];
  readonly totalMinor: number;
  readonly prepaidMinor: number;
  readonly currency: CurrencyCode;
  /** Local date of the visit, for pass validity. */
  readonly date: PlainDate;
}

export interface SettlementChoice {
  readonly passId: string | null;
  readonly pointsRequested: number;
}

/** What the front desk may use to pay for a visit. */
export interface SettlementOptions {
  readonly loyalty: LoyaltySettings;
  readonly pointsBalance: number;
  readonly pointsRedeemable: number;
  readonly passes: readonly (ClientPassRecord & { readonly visitsLeft: number })[];
}

/**
 * Pays for completed visits from the client's passes and points, records the money due
 * and accrues points, all in the ledger of the visit's transaction.
 */
export class VisitSettlements {
  constructor(
    private readonly loyalty: LoyaltyStore,
    private readonly ledger: LedgerStore,
    private readonly book: LedgerBook,
  ) {}

  async options(visit: VisitToSettle): Promise<SettlementOptions> {
    const program = (await this.loyalty.program()) ?? noLoyalty;
    const pointsBalance = await this.ledger.balance(visit.clientId, 'points');
    return {
      loyalty: program,
      pointsBalance,
      pointsRedeemable: pointsRedeemable(program, visit.totalMinor, pointsBalance),
      passes: await this.coveringPasses(visit),
    };
  }

  async settle(
    visit: VisitToSettle,
    choice: SettlementChoice,
    actor: { readonly userId: string | null; readonly now: Date },
  ): Promise<VisitSettlement> {
    await this.ledger.lockClient(visit.clientId);
    if (choice.passId !== null) {
      const covering = await this.coveringPasses(visit);
      if (!covering.some((pass) => pass.id === choice.passId)) {
        throw new ApplicationError('validation_failed', 'The pass does not cover this visit', {
          reason: 'pass_not_applicable',
        });
      }
    }
    const program = (await this.loyalty.program()) ?? noLoyalty;
    const settlement = settleVisit({
      totalMinor: visit.totalMinor,
      prepaidMinor: visit.prepaidMinor,
      passId: choice.passId,
      pointsRequested: choice.pointsRequested,
      pointsBalance: await this.ledger.balance(visit.clientId, 'points'),
      loyalty: program,
    });
    await this.book.post(
      {
        clientId: visit.clientId,
        currency: visit.currency,
        actorUserId: actor.userId,
        now: actor.now,
      },
      settlement.entries.map((entry) => ({ ...entry, bookingId: visit.bookingId })),
    );
    return settlement;
  }

  private async coveringPasses(
    visit: VisitToSettle,
  ): Promise<(ClientPassRecord & { readonly visitsLeft: number })[]> {
    const passes = await this.loyalty.listPasses(visit.clientId);
    const left = await this.ledger.passBalances(passes.map((pass) => pass.id));
    return passes
      .map((pass) => ({ ...pass, visitsLeft: left.get(pass.id) ?? 0 }))
      .filter((pass) =>
        passCovers(
          { serviceIds: pass.serviceIds, validUntil: pass.validUntil, visitsLeft: pass.visitsLeft },
          visit.serviceIds,
          visit.date,
        ),
      );
  }
}
