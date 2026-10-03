import { ApiError } from '@mestechko/contracts/client';
import type { TFunction } from 'i18next';

/** Why the API refused, when it said: a domain rule or a booking conflict. */
export function reasonOf(error: unknown): string | null {
  if (!(error instanceof ApiError)) {
    return null;
  }
  const details = error.details as { reason?: unknown } | undefined;
  return typeof details?.reason === 'string' ? details.reason : null;
}

/** Fields the API rejected, by name, e.g. `{ phone: 'taken' }`. */
export function fieldErrorsOf(error: unknown): Readonly<Record<string, string>> {
  if (!(error instanceof ApiError)) {
    return {};
  }
  const details = error.details as { fields?: unknown } | undefined;
  const fields = details?.fields;
  return typeof fields === 'object' && fields !== null
    ? Object.fromEntries(
        Object.entries(fields).filter(
          (entry): entry is [string, string] => typeof entry[1] === 'string',
        ),
      )
    : {};
}

/** The most specific message: the reason if it has words, otherwise the error code. */
export function errorMessage(t: TFunction, error: unknown): string {
  const reason = reasonOf(error);
  const reasonKey = `common:errors.reasons.${reason ?? ''}`;
  if (reason && t(reasonKey) !== reasonKey) {
    return t(reasonKey);
  }
  return t(`common:errors.${error instanceof ApiError ? error.code : 'internal'}`);
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}
