import type { Temporal } from './temporal.js';

/** Source of the current instant. Business code never reads the system time directly. */
export interface Clock {
  now(): Temporal.Instant;
}
