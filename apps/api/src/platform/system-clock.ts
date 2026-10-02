import { Temporal, type Clock } from '@mestechko/domain';
import { v7 as uuidv7 } from 'uuid';
import type { IdGenerator } from '../shared/application/ports.js';

export class SystemClock implements Clock {
  now(): Temporal.Instant {
    return Temporal.Now.instant();
  }
}

/** UUIDv7 keeps primary keys time-ordered, which keeps B-tree inserts local. */
export class UuidV7Generator implements IdGenerator {
  next(): string {
    return uuidv7();
  }
}
