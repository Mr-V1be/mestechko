import { ApiError } from '@mestechko/contracts/client';
import type { TFunction } from 'i18next';

export function errorMessage(t: TFunction, error: unknown): string {
  return t(`common:errors.${error instanceof ApiError ? error.code : 'internal'}`);
}

export function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function isForbidden(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}
