import type { Redis } from 'ioredis';
import type { UpdateDeduplicator } from '../application/update-deduplicator.js';

/** Messengers stop redelivering long before a day passes. */
const REMEMBER_SECONDS = 86_400;

export class RedisUpdateDeduplicator implements UpdateDeduplicator {
  constructor(private readonly redis: Redis) {}

  async firstTime(key: string): Promise<boolean> {
    const result = await this.redis.set(
      `mestechko:update:${key}`,
      '1',
      'EX',
      REMEMBER_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  async forget(key: string): Promise<void> {
    await this.redis.del(`mestechko:update:${key}`);
  }
}
