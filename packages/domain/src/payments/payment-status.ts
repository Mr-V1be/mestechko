interface PaymentStatusDefinition {
  /** Money the client paid and the business holds. */
  readonly holdsMoney: boolean;
  readonly next: readonly string[];
}

/**
 * A prepayment's life: it waits for the client, then succeeds or is cancelled (declined,
 * or the booking stopped waiting); a succeeded one may be refunded. Money that arrives
 * after we stopped waiting is still money received, so a cancelled payment may succeed.
 */
export const paymentStatuses = {
  pending: { holdsMoney: false, next: ['succeeded', 'cancelled'] },
  succeeded: { holdsMoney: true, next: ['refunded'] },
  cancelled: { holdsMoney: false, next: ['succeeded'] },
  refunded: { holdsMoney: false, next: [] },
} as const satisfies Record<string, PaymentStatusDefinition>;

export type PaymentStatus = keyof typeof paymentStatuses;

export const paymentStatusIds = Object.keys(paymentStatuses) as PaymentStatus[];

export function canMovePaymentTo(from: PaymentStatus, to: PaymentStatus): boolean {
  return (paymentStatuses[from].next as readonly string[]).includes(to);
}
