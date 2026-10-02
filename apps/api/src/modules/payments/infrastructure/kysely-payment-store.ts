import { sql } from 'kysely';
import { currencyCode } from '../../../platform/db/column-parsers.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  PaymentRecord,
  PaymentStore,
  PendingRefunds,
  ProviderCheckout,
} from '../application/ports.js';

const columns = [
  'id',
  'bookingId',
  'clientId',
  'provider',
  'providerPaymentId',
  'checkoutUrl',
  'amountMinor',
  'currency',
  'status',
  'refundRequestedMinor',
  'refundedMinor',
] as const;

function toRecord<T extends { currency: string }>(
  row: T,
): T & { currency: PaymentRecord['currency'] } {
  return { ...row, currency: currencyCode(row.currency) };
}

export class KyselyPaymentStore implements PaymentStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async insert(payment: PaymentRecord, now: Date): Promise<void> {
    await this.unitOfWork
      .tenant()
      .insertInto('payments')
      .values({
        ...payment,
        businessId: this.unitOfWork.currentBusinessId(),
        createdAt: now,
        updatedAt: now,
        paidAt: null,
      })
      .execute();
  }

  async find(paymentId: string): Promise<PaymentRecord | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('payments')
      .select(columns)
      .where('id', '=', paymentId)
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async lock(paymentId: string): Promise<PaymentRecord | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('payments')
      .select(columns)
      .where('id', '=', paymentId)
      .forUpdate()
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async latestForBooking(bookingId: string): Promise<PaymentRecord | null> {
    return (await this.latestForBookings([bookingId])).get(bookingId) ?? null;
  }

  async latestForBookings(bookingIds: readonly string[]): Promise<Map<string, PaymentRecord>> {
    if (bookingIds.length === 0) {
      return new Map();
    }
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('payments')
      .select(columns)
      .distinctOn('bookingId')
      .where('bookingId', 'in', bookingIds)
      .orderBy('bookingId')
      .orderBy('createdAt', 'desc')
      .execute();
    return new Map(rows.map((row) => [row.bookingId, toRecord(row)]));
  }

  async attachCheckout(paymentId: string, checkout: ProviderCheckout, now: Date): Promise<void> {
    await this.unitOfWork
      .tenant()
      .updateTable('payments')
      .set({
        providerPaymentId: checkout.providerPaymentId,
        checkoutUrl: checkout.checkoutUrl,
        updatedAt: now,
      })
      .where('id', '=', paymentId)
      .where('providerPaymentId', 'is', null)
      .execute();
  }

  async update(
    paymentId: string,
    changes: Partial<Pick<PaymentRecord, 'status' | 'refundRequestedMinor' | 'refundedMinor'>> & {
      readonly paidAt?: Date;
    },
    now: Date,
  ): Promise<void> {
    await this.unitOfWork
      .tenant()
      .updateTable('payments')
      .set({ ...changes, updatedAt: now })
      .where('id', '=', paymentId)
      .execute();
  }

  async recordEvent(
    event: { readonly provider: string; readonly eventId: string; readonly kind: string },
    paymentId: string,
    now: Date,
  ): Promise<boolean> {
    const result = await this.unitOfWork
      .tenant()
      .insertInto('paymentWebhookEvents')
      .values({
        provider: event.provider,
        eventId: event.eventId,
        businessId: this.unitOfWork.currentBusinessId(),
        paymentId,
        kind: event.kind,
        receivedAt: now,
      })
      .onConflict((conflict) => conflict.columns(['provider', 'eventId']).doNothing())
      .executeTakeFirst();
    return result.numInsertedOrUpdatedRows === 1n;
  }
}

export class KyselyPendingRefunds implements PendingRefunds {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async list(limit: number): Promise<{ businessId: string; paymentId: string }[]> {
    const result = await sql<{ businessId: string; paymentId: string }>`
      select business_id as "businessId", payment_id as "paymentId"
      from pending_payment_refunds(${limit})
    `.execute(this.unitOfWork.platform());
    return result.rows;
  }
}
