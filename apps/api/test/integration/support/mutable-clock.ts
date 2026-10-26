import { Temporal, type Clock } from '@slotwise/domain';

/** A clock the test moves: reminders become due without waiting a day. */
export class MutableClock implements Clock {
  private epochMs = Date.now();

  now(): Temporal.Instant {
    return Temporal.Instant.fromEpochMilliseconds(this.epochMs);
  }

  set(epochMs: number): void {
    this.epochMs = epochMs;
  }

  reset(): void {
    this.epochMs = Date.now();
  }
}
