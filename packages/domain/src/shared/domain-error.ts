/**
 * Stable machine-readable codes for violations of domain invariants.
 * Transport layers map them to their own error vocabularies.
 */
export const domainErrorCodes = [
  'invalid_time',
  'invalid_interval',
  'invalid_schedule',
  'invalid_calendar',
  'invalid_vertical',
  'invalid_booking_rules',
  'invalid_service_combo',
  'invalid_money',
  'unknown_reference',
] as const;

export type DomainErrorCode = (typeof domainErrorCodes)[number];

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
  }
}

export function invariant(
  condition: boolean,
  code: DomainErrorCode,
  message: string,
): asserts condition {
  if (!condition) {
    throw new DomainError(code, message);
  }
}
