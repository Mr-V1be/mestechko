import type { Clock } from '@mestechko/domain';

export type { Clock };

/** Time-ordered unique identifiers for new records. */
export interface IdGenerator {
  next(): string;
}

export const CLOCK = Symbol('CLOCK');
export const ID_GENERATOR = Symbol('ID_GENERATOR');
