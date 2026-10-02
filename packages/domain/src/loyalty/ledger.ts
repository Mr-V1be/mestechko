import { invariant } from '../shared/domain-error.js';

/**
 * What a client has with a business: loyalty points (one point pays one unit of the
 * currency), visits left on a pass, and money paid (in minor units).
 */
export const ledgerAccounts = ['points', 'pass', 'money'] as const;
export type LedgerAccount = (typeof ledgerAccounts)[number];

interface LedgerReasonDefinition {
  readonly account: LedgerAccount;
  /** `credit` adds to the balance, `debit` takes from it, `either` is a correction. */
  readonly direction: 'credit' | 'debit' | 'either';
}

/**
 * Every ledger entry carries one of these reasons; the amount's sign must match its
 * direction, and balances are only ever sums of entries.
 */
export const ledgerReasons = {
  points_accrual: { account: 'points', direction: 'credit' },
  points_redemption: { account: 'points', direction: 'debit' },
  points_adjustment: { account: 'points', direction: 'either' },
  pass_sale: { account: 'pass', direction: 'credit' },
  pass_visit: { account: 'pass', direction: 'debit' },
  pass_adjustment: { account: 'pass', direction: 'either' },
  prepayment: { account: 'money', direction: 'credit' },
  prepayment_refund: { account: 'money', direction: 'debit' },
  visit_payment: { account: 'money', direction: 'credit' },
  pass_payment: { account: 'money', direction: 'credit' },
} as const satisfies Record<string, LedgerReasonDefinition>;

export type LedgerReason = keyof typeof ledgerReasons;

export const ledgerReasonIds = Object.keys(ledgerReasons) as LedgerReason[];

/** Checks an entry against its reason before it is written. */
export function validateLedgerEntry(reason: LedgerReason, amount: number): void {
  const { direction } = ledgerReasons[reason];
  invariant(
    Number.isSafeInteger(amount) && amount !== 0,
    'invalid_ledger_entry',
    'Ledger amounts are non-zero whole units',
  );
  invariant(
    direction === 'either' || (direction === 'credit' ? amount > 0 : amount < 0),
    'invalid_ledger_entry',
    `A ${reason} entry must be a ${direction}`,
  );
}

/** A debit may not take a balance below zero. */
export function assertCovered(balance: number, debit: number): void {
  invariant(balance + debit >= 0, 'insufficient_balance', 'Not enough on the balance');
}
