import { MINUTES_PER_DAY, type MinuteOfDay } from './wall-time.js';

interface DayPartDefinition {
  /** First minute of the part, inclusive. */
  readonly startMinute: MinuteOfDay;
  /** End of the part, exclusive. */
  readonly endMinute: MinuteOfDay;
}

/**
 * Parts of a local day: slot lists are grouped by them and waitlist entries can ask
 * for one of them. Ordered from the start of the day.
 */
export const dayParts = {
  morning: { startMinute: 0, endMinute: 12 * 60 },
  afternoon: { startMinute: 12 * 60, endMinute: 17 * 60 },
  evening: { startMinute: 17 * 60, endMinute: MINUTES_PER_DAY },
} as const satisfies Record<string, DayPartDefinition>;

export type DayPart = keyof typeof dayParts;

export const dayPartIds = Object.keys(dayParts) as DayPart[];

export function dayPartOfMinute(minute: MinuteOfDay): DayPart {
  return (
    dayPartIds.find(
      (part) => minute >= dayParts[part].startMinute && minute < dayParts[part].endMinute,
    ) ?? 'evening'
  );
}
