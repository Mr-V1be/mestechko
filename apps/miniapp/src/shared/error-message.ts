import { ApiError } from '@mestechko/contracts/client';
import type { TFunction } from 'i18next';

/** A human message for any failure, in the interface's own words. */
export function errorMessage(t: TFunction, error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'internal';
  return t(`common:errors.${code}`);
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

export function hasCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}
