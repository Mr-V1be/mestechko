import { invariant } from '../shared/domain-error.js';
import type { ClientChangeVerdict } from '../booking/client-changes.js';
import type { Money } from '../money/money.js';

const PERCENT = 100;

export interface DepositLine {
  readonly priceMinor: number;
  /** The service's own deposit share; `null` follows the business rule. */
  readonly depositPercent: number | null;
}

/** The prepayment a booking asks for: each service's share of its price, in whole units. */
export function depositFor(
  lines: readonly DepositLine[],
  rulePercent: number,
  currency: Money['currency'],
): Money {
  const amountMinor = lines.reduce((sum, line) => {
    const percent = line.depositPercent ?? rulePercent;
    invariant(
      Number.isInteger(percent) && percent >= 0 && percent <= PERCENT,
      'invalid_money',
      'Deposit share must be between 0 and 100 percent',
    );
    return sum + Math.round((line.priceMinor * percent) / PERCENT);
  }, 0);
  return { amountMinor, currency };
}

/** Who cancelled: the client in their app or chat, or the business in the cabinet. */
export type CancellationActor = 'client' | 'business';

/**
 * Whether a prepayment comes back on cancellation: always when the business cancels,
 * and when the client cancels while online changes are open. Late cancellations and
 * no-shows keep the deposit, which is what it is for.
 */
export function refundsDeposit(actor: CancellationActor, verdict: ClientChangeVerdict): boolean {
  return actor === 'business' || verdict === 'allowed';
}
