export interface UnitOfWorkOptions {
  /** Read-only transactions for queries that must not write. */
  readonly readOnly?: boolean;
}

/**
 * Runs work in one transaction scoped to a business (tenant). Every tenant-scoped
 * repository call must happen inside it; the database enforces the scope as well.
 */
export interface UnitOfWork {
  inTenant<T>(businessId: string, work: () => Promise<T>, options?: UnitOfWorkOptions): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');
