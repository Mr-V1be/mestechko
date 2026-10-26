/**
 * The product's technical name. Its Redis keys and queues live under it, and the names it
 * gives its database connections, metrics and files start with it, so a PostgreSQL or
 * Redis shared with other products tells the product's clients and keys apart.
 */
export const SYSTEM_NAME = 'slotwise';

/** A name of one of the product's parts: `slotwise-api`, `slotwise-cli`. */
export const systemNameOf = (part: string): string => `${SYSTEM_NAME}-${part}`;

/** A Redis key in the product's namespace: `slotwise:update:…`. */
export const redisKeyOf = (...parts: readonly string[]): string =>
  [SYSTEM_NAME, ...parts].join(':');
