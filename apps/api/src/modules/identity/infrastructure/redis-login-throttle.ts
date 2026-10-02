import type { Redis } from 'ioredis';
import { RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import type { LoginThrottle, ThrottleVerdict } from '../application/ports.js';

const ATTEMPTS = 10;
const WINDOW_SECONDS = 15 * 60;
const MS_PER_SECOND = 1_000;

/** Fixed-window counters in Redis, shared by every API instance. */
export class RedisLoginThrottle implements LoginThrottle {
  private readonly limiter: RateLimiterRedis;

  constructor(redis: Redis) {
    this.limiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: 'mestechko:login',
      points: ATTEMPTS,
      duration: WINDOW_SECONDS,
    });
  }

  async consume(key: string): Promise<ThrottleVerdict> {
    try {
      await this.limiter.consume(key);
      return { allowed: true, retryAfterSeconds: 0 };
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        return { allowed: false, retryAfterSeconds: Math.ceil(error.msBeforeNext / MS_PER_SECOND) };
      }
      throw error;
    }
  }

  async reset(key: string): Promise<void> {
    await this.limiter.delete(key);
  }
}
