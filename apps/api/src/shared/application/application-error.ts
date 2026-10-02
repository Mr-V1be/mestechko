import type { ApiErrorCode } from '@mestechko/contracts';

/** Expected failure of a use case, expressed in the API's stable error vocabulary. */
export class ApplicationError extends Error {
  readonly code: ApiErrorCode;
  readonly details: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApplicationError';
    this.code = code;
    this.details = details;
  }
}

export function notFound(what: string): ApplicationError {
  return new ApplicationError('not_found', `${what} not found`);
}
