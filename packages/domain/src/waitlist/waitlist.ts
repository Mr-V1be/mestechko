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
 * in their window and that they were not offered before (an offer they let pass goes
 * to the next in line). `localMinute` converts an instant to minutes of the day.
 */
export function firstStartInWindow(
  starts: readonly number[],
  window: WaitlistWindow,
  localMinute: (epochMs: number) => MinuteOfDay,
  offeredBefore: ReadonlySet<number> = new Set(),
): number | null {
  const sorted = [...starts].sort((a, b) => a - b);
  return (
    sorted.find((start) => {
      const minute = localMinute(start);
      return !offeredBefore.has(start) && minute >= window.startMinute && minute < window.endMinute;
    }) ?? null
  );
}

interface WaitlistOfferStatusDefinition {
  /** The offered time is held for the client and waits for their answer. */
  readonly open: boolean;
}

/**
 * Offers go to one waiting client at a time: the time is held for them for a while,
 * then passes to the next in line if they decline or stay silent.
 */
export const waitlistOfferStatuses = {
  pending: { open: true },
  accepted: { open: false },
  declined: { open: false },
  expired: { open: false },
  /** The wish was withdrawn or booked otherwise while the offer waited. */
  withdrawn: { open: false },
} as const satisfies Record<string, WaitlistOfferStatusDefinition>;

export type WaitlistOfferStatus = keyof typeof waitlistOfferStatuses;

export const waitlistOfferStatusIds = Object.keys(waitlistOfferStatuses) as WaitlistOfferStatus[];
