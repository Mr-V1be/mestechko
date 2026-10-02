import { AsyncLocalStorage } from 'node:async_hooks';
import { sql, type Kysely, type Transaction } from 'kysely';
import type { UnitOfWork, UnitOfWorkOptions } from '../../shared/application/unit-of-work.js';
import type { Database } from './database.js';

interface ScopedTransaction {
  /** `null` for platform transactions, which see no tenant rows. */
  readonly businessId: string | null;
  readonly transaction: Transaction<Database>;
}

export class TenantContextMissingError extends Error {
  constructor() {
    super('Tenant-scoped data accessed outside of a tenant transaction');
    this.name = 'TenantContextMissingError';
  }
}

/**
 * Binds a transaction to the tenant through `app.business_id`, which row-level
 * security policies read. Repositories obtain the transaction from here, so a
 * tenant-scoped query outside of `inTenant` fails instead of leaking data.
 */
export class KyselyUnitOfWork implements UnitOfWork {
  private readonly storage = new AsyncLocalStorage<ScopedTransaction>();
  private readonly db: Kysely<Database>;

  constructor(db: Kysely<Database>) {
    this.db = db;
  }

  async inTenant<T>(
    businessId: string,
    work: () => Promise<T>,
    options: UnitOfWorkOptions = {},
  ): Promise<T> {
    const current = this.storage.getStore();
    if (current) {
      if (current.businessId !== businessId) {
        throw new Error('A tenant transaction cannot be nested inside another scope');
      }
      return work();
    }
    const builder = options.readOnly
      ? this.db.transaction().setAccessMode('read only')
      : this.db.transaction();
    return builder.execute(async (transaction) => {
      await sql`select set_config('app.business_id', ${businessId}, true)`.execute(transaction);
      return this.storage.run({ businessId, transaction }, work);
    });
  }

  /**
   * One transaction over platform tables only, e.g. creating a customer with their
   * identity. Joins an enclosing transaction if there is one.
   */
  async inPlatform<T>(work: () => Promise<T>): Promise<T> {
    if (this.storage.getStore()) {
      return work();
    }
    return this.db
      .transaction()
      .execute((transaction) => this.storage.run({ businessId: null, transaction }, work));
  }

  /** Transaction of the current tenant; throws outside of `inTenant`. */
  tenant(): Transaction<Database> {
    return this.currentTenant().transaction;
  }

  currentBusinessId(): string {
    return this.currentTenant().businessId;
  }

  private currentTenant(): { businessId: string; transaction: Transaction<Database> } {
    const current = this.storage.getStore();
    const businessId = current?.businessId ?? null;
    if (current === undefined || businessId === null) {
      throw new TenantContextMissingError();
    }
    return { businessId, transaction: current.transaction };
  }

  /** Executor for platform tables: joins the current transaction when there is one. */
  platform(): Kysely<Database> {
    return this.storage.getStore()?.transaction ?? this.db;
  }
}
