import { dayParts, type DayPart } from '../time/day-parts.js';
import type { MinuteOfDay } from '../time/wall-time.js';
import { MINUTES_PER_DAY } from '../time/wall-time.js';
import { invariant } from '../shared/domain-error.js';

interface WaitlistStatusDefinition {
  /** The entry still waits for a free time and may receive offers. */
  readonly open: boolean;
}

export const waitlistStatuses = {
  active: { open: true },
  booked: { open: false },
  cancelled: { open: false },
} as const satisfies Record<string, WaitlistStatusDefinition>;

export type WaitlistStatus = keyof typeof waitlistStatuses;

export const waitlistStatusIds = Object.keys(waitlistStatuses) as WaitlistStatus[];

/** Part of the desired day a client waits for, in local minutes. */
export interface WaitlistWindow {
  readonly startMinute: MinuteOfDay;
  readonly endMinute: MinuteOfDay;
}

export const WHOLE_DAY: WaitlistWindow = { startMinute: 0, endMinute: MINUTES_PER_DAY };

export function waitlistWindowOf(part: DayPart | null): WaitlistWindow {
  return part ? dayParts[part] : WHOLE_DAY;
}

export function validateWaitlistWindow(window: WaitlistWindow): void {
  invariant(
    Number.isInteger(window.startMinute) &&
      Number.isInteger(window.endMinute) &&
      window.startMinute >= 0 &&
      window.endMinute <= MINUTES_PER_DAY &&
      window.startMinute < window.endMinute,
    'invalid_waitlist_window',
    'Waitlist window must be a non-empty part of one day',
  );
}

/**
 * The start to offer a waiting client: the earliest free start whose local minute lies
 * in their window. `localMinute` converts an instant to minutes of the location's day.
 */
export function firstStartInWindow(
  starts: readonly number[],
  window: WaitlistWindow,
  localMinute: (epochMs: number) => MinuteOfDay,
): number | null {
  const sorted = [...starts].sort((a, b) => a - b);
  return (
    sorted.find((start) => {
      const minute = localMinute(start);
      return minute >= window.startMinute && minute < window.endMinute;
    }) ?? null
  );
}
