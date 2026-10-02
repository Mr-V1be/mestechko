import type {
  CurrencyCode,
  LedgerAccount,
  LedgerReason,
  LoyaltySettings,
  PassPlan,
  PlainDate,
} from '@mestechko/domain';

export interface NewLedgerEntry {
  readonly id: string;
  readonly clientId: string;
  readonly reason: LedgerReason;
  readonly amount: number;
  /** Currency of money entries; `null` for points and pass visits. */
  readonly currency: CurrencyCode | null;
  readonly passId: string | null;
  readonly bookingId: string | null;
  readonly paymentId: string | null;
  readonly note: string | null;
  readonly actorUserId: string | null;
  /** Key of the request behind a hand-made entry; repeating it posts nothing. */
  readonly idempotencyKey: string | null;
  readonly createdAt: Date;
}

export interface LedgerEntryView {
  readonly id: string;
  readonly account: LedgerAccount;
  readonly reason: LedgerReason;
  readonly amount: number;
  readonly currency: CurrencyCode | null;
  readonly passName: string | null;
  readonly bookingId: string | null;
  readonly note: string | null;
  readonly createdAt: Date;
}

export interface SettlementEntryView {
  readonly reason: LedgerReason;
  readonly amount: number;
  readonly passName: string | null;
}

/** The ledger of the current tenant. Entries are only ever added. */
export interface LedgerStore {
  /** Serializes ledger changes of one client until the transaction ends. */
  lockClient(clientId: string): Promise<void>;
  /** Sum of a client's entries on an account, optionally of one pass. */
  balance(clientId: string, account: LedgerAccount, passId?: string): Promise<number>;
  /** Visits left per pass. */
  passBalances(passIds: readonly string[]): Promise<Map<string, number>>;
  /** Throws `DuplicateLedgerRequestError` when an idempotency key was used before. */
  append(entries: readonly NewLedgerEntry[]): Promise<void>;
  /** A client's recent entries, newest first. */
  listForClient(clientId: string, limit: number): Promise<LedgerEntryView[]>;
  /** How a visit was settled: its entries that are not a prepayment's. */
  settlementOf(bookingId: string): Promise<SettlementEntryView[]>;
  /** Points balances of many clients at once. */
  pointsBalances(clientIds: readonly string[]): Promise<Map<string, number>>;
}

export interface PassPlanRecord extends PassPlan {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
}

export interface ClientPassRecord {
  readonly id: string;
  readonly clientId: string;
  readonly name: string;
  readonly visits: number;
  readonly priceMinor: number;
  readonly validFrom: PlainDate;
  readonly validUntil: PlainDate;
  readonly serviceIds: readonly string[];
  readonly soldAt: Date;
}

/** Loyalty program, pass plans and sold passes of the current tenant. */
export interface LoyaltyStore {
  /** The business's program; `null` when it runs none. */
  program(): Promise<LoyaltySettings | null>;
  saveProgram(settings: LoyaltySettings, now: Date): Promise<void>;
  listPlans(): Promise<PassPlanRecord[]>;
  findPlan(planId: string): Promise<PassPlanRecord | null>;
  savePlan(plan: PassPlanRecord, now: Date): Promise<void>;
  /** Passes of a client, newest first; expired ones too. */
  listPasses(clientId: string): Promise<ClientPassRecord[]>;
  findPass(passId: string): Promise<ClientPassRecord | null>;
  /** `false` when a pass was already sold under the same idempotency key. */
  insertPass(
    pass: ClientPassRecord & {
      readonly planId: string;
      readonly soldByUserId: string | null;
      readonly idempotencyKey: string;
    },
  ): Promise<boolean>;
  /** Passes sold per plan. */
  soldPerPlan(): Promise<Map<string, number>>;
}

/** A hand-made entry was already posted for this request. */
export class DuplicateLedgerRequestError extends Error {
  constructor() {
    super('The request was already posted');
    this.name = 'DuplicateLedgerRequestError';
  }
}

export const LEDGER_STORE = Symbol('LEDGER_STORE');
export const LOYALTY_STORE = Symbol('LOYALTY_STORE');
