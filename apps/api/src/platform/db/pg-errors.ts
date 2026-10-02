const EXCLUSION_VIOLATION = '23P01';
const UNIQUE_VIOLATION = '23505';

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

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pgError = asPgError(error);
  return (
    pgError?.code === UNIQUE_VIOLATION &&
    (constraint === undefined || pgError.constraint === constraint)
  );
}
