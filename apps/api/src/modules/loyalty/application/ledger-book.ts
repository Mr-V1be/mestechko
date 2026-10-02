import {
  assertCovered,
  ledgerReasons,
  validateLedgerEntry,
  type CurrencyCode,
  type LedgerReason,
} from '@mestechko/domain';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type { LedgerStore } from './ports.js';

export interface Posting {
  readonly reason: LedgerReason;
  readonly amount: number;
  readonly passId?: string | null;
  readonly bookingId?: string | null;
  readonly paymentId?: string | null;
  readonly note?: string | null;
  readonly idempotencyKey?: string | null;
}

export interface PostingContext {
  readonly clientId: string;
  readonly currency: CurrencyCode;
  readonly actorUserId: string | null;
  readonly now: Date;
}

/**
 * The only way entries reach the ledger: each is checked against its reason, and a
 * debit of points or pass visits never takes the client's balance below zero. Runs in
 * the caller's tenant transaction, so entries commit with the change that causes them.
 */
export class LedgerBook {
  constructor(
    private readonly store: LedgerStore,
    private readonly ids: IdGenerator,
  ) {}

  async post(context: PostingContext, postings: readonly Posting[]): Promise<void> {
    if (postings.length === 0) {
      return;
    }
    await this.store.lockClient(context.clientId);
    for (const posting of postings) {
      validateLedgerEntry(posting.reason, posting.amount);
      const { account } = ledgerReasons[posting.reason];
      if (posting.amount < 0 && account !== 'money') {
        const balance = await this.store.balance(
          context.clientId,
          account,
          account === 'pass' ? (posting.passId ?? undefined) : undefined,
        );
        assertCovered(balance, posting.amount);
      }
    }
    await this.store.append(
      postings.map((posting) => ({
        id: this.ids.next(),
        clientId: context.clientId,
        reason: posting.reason,
        amount: posting.amount,
        currency: ledgerReasons[posting.reason].account === 'money' ? context.currency : null,
        passId: posting.passId ?? null,
        bookingId: posting.bookingId ?? null,
        paymentId: posting.paymentId ?? null,
        note: posting.note ?? null,
        actorUserId: context.actorUserId,
        idempotencyKey: posting.idempotencyKey ?? null,
        createdAt: context.now,
      })),
    );
  }
}
