import { Redis } from 'ioredis';

export const REDIS = Symbol('REDIS');

const CONNECT_TIMEOUT_MS = 5_000;

/**
 * BullMQ requires `maxRetriesPerRequest: null`: blocking commands must wait for
 * reconnection instead of failing a job.
 */
export function createRedis(url: string, connectionName: string): Redis {
  return new Redis(url, {
    connectionName,
    connectTimeout: CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
