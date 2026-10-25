import { sql } from 'kysely';
import { localeCode } from '../../../platform/db/column-parsers.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type { TestPayEvent, TestPayPayment, TestPayStore } from '../application/ports.js';

const paymentColumns = [
  'id',
  'idempotencyKey',
  'amountMinor',
  'currency',
  'description',
  'returnUrl',
  'locale',
  'status',
  'refundedMinor',
  'expiresAt',
] as const;

type PaymentRow = Omit<TestPayPayment, 'metadata' | 'status' | 'locale'> & {
  readonly status: string;
  readonly locale: string;
  readonly metadata: string;
};

function toPayment(row: PaymentRow): TestPayPayment {
  return {
    ...row,
    status: row.status as TestPayPayment['status'],
    locale: localeCode(row.locale),
    // Read as text: the camel-case plugin would rename keys inside JSON.
    metadata: JSON.parse(row.metadata) as Record<string, string>,
  };
}

export class KyselyTestPayStore implements TestPayStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  transaction<T>(work: () => Promise<T>): Promise<T> {
    return this.unitOfWork.inPlatform(work);
  }

  async createOnce(payment: TestPayPayment, now: Date): Promise<TestPayPayment> {
    await this.unitOfWork
      .platform()
      .insertInto('testPayPayments')
      .values({
        id: payment.id,
        idempotencyKey: payment.idempotencyKey,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        description: payment.description,
        returnUrl: payment.returnUrl,
        locale: payment.locale,
        metadata: JSON.stringify(payment.metadata),
        status: payment.status,
        refundedMinor: 0,
        expiresAt: payment.expiresAt,
        createdAt: now,
        updatedAt: now,
      })
      .onConflict((conflict) => conflict.column('idempotencyKey').doNothing())
      .execute();
    const stored = await this.select()
      .where('idempotencyKey', '=', payment.idempotencyKey)
      .executeTakeFirstOrThrow();
    return toPayment(stored);
  }

  async find(paymentId: string): Promise<TestPayPayment | null> {
    const row = await this.select().where('id', '=', paymentId).executeTakeFirst();
    return row ? toPayment(row) : null;
  }

  async lock(paymentId: string): Promise<TestPayPayment | null> {
    const row = await this.select().where('id', '=', paymentId).forUpdate().executeTakeFirst();
    return row ? toPayment(row) : null;
  }

  async setStatus(paymentId: string, status: TestPayPayment['status'], now: Date): Promise<void> {
    await this.unitOfWork
      .platform()
      .updateTable('testPayPayments')
      .set({ status, updatedAt: now })
      .where('id', '=', paymentId)
      .execute();
  }

  async addRefund(
    refund: { readonly id: string; readonly paymentId: string; readonly idempotencyKey: string },
    amountMinor: number,
    now: Date,
  ): Promise<boolean> {
    const db = this.unitOfWork.platform();
    if (amountMinor <= 0) {
      return false;
    }
    const inserted = await db
      .insertInto('testPayRefunds')
      .values({ ...refund, amountMinor, createdAt: now })
      .onConflict((conflict) => conflict.column('idempotencyKey').doNothing())
      .executeTakeFirst();
    if (inserted.numInsertedOrUpdatedRows !== 1n) {
      return false;
    }
    await db
      .updateTable('testPayPayments')
      .set((eb) => ({ refundedMinor: eb('refundedMinor', '+', amountMinor), updatedAt: now }))
      .where('id', '=', refund.paymentId)
      .execute();
    return true;
  }

  async addEvent(event: Omit<TestPayEvent, 'attempts'>, now: Date): Promise<void> {
    await this.unitOfWork
      .platform()
      .insertInto('testPayEvents')
      .values({ ...event, attempts: 0, createdAt: now, deliveredAt: null })
      .execute();
  }

  async findUndelivered(eventId: string): Promise<TestPayEvent | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('testPayEvents')
      .select(['id', 'paymentId', 'type', 'body', 'attempts'])
      .where('id', '=', eventId)
      .where('deliveredAt', 'is', null)
      .executeTakeFirst();
    return row ? { ...row, type: row.type as TestPayEvent['type'] } : null;
  }

  async markDelivered(eventId: string, now: Date): Promise<void> {
    await this.unitOfWork
      .platform()
      .updateTable('testPayEvents')
      .set({ deliveredAt: now })
      .where('id', '=', eventId)
      .execute();
  }

  async countAttempt(eventId: string): Promise<void> {
    await this.unitOfWork
      .platform()
      .updateTable('testPayEvents')
      .set((eb) => ({ attempts: eb('attempts', '+', 1) }))
      .where('id', '=', eventId)
      .execute();
  }

  async undeliveredEvents(limit: number): Promise<string[]> {
    const rows = await this.unitOfWork
      .platform()
      .selectFrom('testPayEvents')
      .select('id')
      .where('deliveredAt', 'is', null)
      .orderBy('createdAt')
      .limit(limit)
      .execute();
    return rows.map((row) => row.id);
  }

  async expiredPayments(now: Date, limit: number): Promise<string[]> {
    const rows = await this.unitOfWork
      .platform()
      .selectFrom('testPayPayments')
      .select('id')
      .where('status', '=', 'pending')
      .where('expiresAt', '<=', now)
      .limit(limit)
      .execute();
    return rows.map((row) => row.id);
  }

  private select() {
    return this.unitOfWork
      .platform()
      .selectFrom('testPayPayments')
      .select([...paymentColumns, sql<string>`metadata::text`.as('metadata')]);
  }
}
