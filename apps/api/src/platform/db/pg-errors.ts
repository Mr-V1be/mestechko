const EXCLUSION_VIOLATION = '23P01';
const UNIQUE_VIOLATION = '23505';
const DEADLOCK_DETECTED = '40P01';

interface PgError {
  readonly code?: unknown;
  readonly constraint?: unknown;
}

function asPgError(error: unknown): PgError | null {
  return typeof error === 'object' && error !== null ? error : null;
}

export function isExclusionViolation(error: unknown): boolean {
  return asPgError(error)?.code === EXCLUSION_VIOLATION;
}

/**
 * Another transaction is writing the same time. Either the exclusion constraint
 * rejected this write, or two writers of overlapping rows each waited for the other's
 * uncommitted row and the database aborted this one to break the deadlock. Both mean
 * the time went to someone else; under a savepoint the transaction can go on.
 */
export function isTimeConflict(error: unknown): boolean {
  const code = asPgError(error)?.code;
  return code === EXCLUSION_VIOLATION || code === DEADLOCK_DETECTED;
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pgError = asPgError(error);
  return (
    pgError?.code === UNIQUE_VIOLATION &&
    (constraint === undefined || pgError.constraint === constraint)
  );
}
