import type { AccessArea } from '@mestechko/domain';
import { CalendarDays, ListChecks, type LucideIcon } from 'lucide-react';

export interface NavigationSection {
  readonly path: string;
  readonly labelKey: string;
  readonly icon: LucideIcon;
  /** Role permission the section needs; sections a role lacks are not shown. */
  readonly area: AccessArea;
}

/** Sections of the cabinet. A new section is one entry here plus its route. */
export const navigationSections: readonly NavigationSection[] = [
  { path: 'schedule', labelKey: 'nav.schedule', icon: CalendarDays, area: 'schedule' },
  { path: 'bookings', labelKey: 'nav.bookings', icon: ListChecks, area: 'bookings' },
];
