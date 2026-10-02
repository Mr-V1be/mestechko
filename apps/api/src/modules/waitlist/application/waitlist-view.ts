import type { WaitlistEntry } from '@mestechko/contracts';
import { dayPartIds, dayParts } from '@mestechko/domain';
import type { WaitlistEntryView } from './ports.js';

/** The client's view of a wish: a part of the day is named, the whole day is `null`. */
export function toWaitlistEntry(view: WaitlistEntryView): WaitlistEntry {
  return {
    id: view.id,
    date: view.date,
    dayPart:
      dayPartIds.find(
        (part) =>
          dayParts[part].startMinute === view.window.startMinute &&
          dayParts[part].endMinute === view.window.endMinute,
      ) ?? null,
    location: view.location,
    staff: view.staff,
    services: [...view.services],
    createdAt: view.createdAt.toISOString(),
  };
}
