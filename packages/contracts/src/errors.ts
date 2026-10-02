import { z } from 'zod';

/** Stable error codes of the public API with their HTTP status. */
export const apiErrors = {
  validation_failed: 400,
  unauthenticated: 401,
  invalid_credentials: 401,
  telegram_auth_invalid: 401,
  telegram_auth_expired: 401,
  forbidden: 403,
  not_found: 404,
  slot_unavailable: 409,
  /** The time is free but now costs more than the client agreed to. */
  price_changed: 409,
  idempotency_conflict: 409,
  rate_limited: 429,
  internal: 500,
  dependency_unavailable: 503,
} as const satisfies Record<string, number>;

export type ApiErrorCode = keyof typeof apiErrors;

export const apiErrorCodes = Object.keys(apiErrors) as ApiErrorCode[];

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.enum(apiErrorCodes),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>;
