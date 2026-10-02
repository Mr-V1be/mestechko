/** How many attempts a key gets within a window. */
interface RateLimitPolicy {
  readonly points: number;
  readonly windowSeconds: number;
}

/**
 * Limits against abuse, shared by every API instance. A new limit is a new entry here;
 * its keys never mix with another policy's.
 */
export const rateLimitPolicies = {
  /** Sign-in attempts per client address and per e-mail, against password guessing. */
  login: { points: 10, windowSeconds: 15 * 60 },
  /** Bookings from a business website per visitor address. */
  website_booking: { points: 10, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateLimitPolicy>;

export type RateLimitPolicyId = keyof typeof rateLimitPolicies;

export const rateLimitPolicyIds = Object.keys(rateLimitPolicies) as RateLimitPolicyId[];

export interface ThrottleVerdict {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(policy: RateLimitPolicyId, key: string): Promise<ThrottleVerdict>;
  reset(policy: RateLimitPolicyId, key: string): Promise<void>;
}

export const RATE_LIMITER = Symbol('RATE_LIMITER');
