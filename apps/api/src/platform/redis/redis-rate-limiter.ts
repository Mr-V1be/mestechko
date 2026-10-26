import type { Redis } from 'ioredis';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import {
  rateLimitPolicies,
  rateLimitPolicyIds,
  type RateLimiter,
  type RateLimitPolicyId,
  type ThrottleVerdict,
} from '../../shared/application/rate-limits.js';
import { redisKeyOf } from '../system-name.js';

const MS_PER_SECOND = 1_000;

/** Fixed-window counters in Redis, one prefix per policy. */
export class RedisRateLimiter implements RateLimiter {
  private readonly limiters: ReadonlyMap<RateLimitPolicyId, RateLimiterRedis>;

  constructor(redis: Redis) {
    this.limiters = new Map(
      rateLimitPolicyIds.map((policy) => [
        policy,
        new RateLimiterRedis({
          storeClient: redis,
          keyPrefix: redisKeyOf(policy),
          points: rateLimitPolicies[policy].points,
          duration: rateLimitPolicies[policy].windowSeconds,
        }),
      ]),
    );
  }

  async consume(policy: RateLimitPolicyId, key: string): Promise<ThrottleVerdict> {
    try {
      await this.limiterOf(policy).consume(key);
      return { allowed: true, retryAfterSeconds: 0 };
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        return { allowed: false, retryAfterSeconds: Math.ceil(error.msBeforeNext / MS_PER_SECOND) };
      }
      throw error;
    }
  }

  async reset(policy: RateLimitPolicyId, key: string): Promise<void> {
    await this.limiterOf(policy).delete(key);
  }

  private limiterOf(policy: RateLimitPolicyId): RateLimiterRedis {
    const limiter = this.limiters.get(policy);
    if (!limiter) {
      throw new Error(`No rate limiter for ${policy}`);
    }
    return limiter;
  }
}
