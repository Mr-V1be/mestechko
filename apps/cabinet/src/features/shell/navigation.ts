import type { AccessArea, MessengerChannel } from '@mestechko/domain';
import {
  BookOpenText,
  CalendarDays,
  ChartColumn,
  Gift,
  ListChecks,
  MessagesSquare,
  Settings,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationSection {
  readonly path: string;
  readonly labelKey: string;
  readonly icon: LucideIcon;
  /** Role permission the section needs; sections a role lacks are not shown. */
  readonly area: AccessArea;
  /** Stays in the phone's bottom bar; the other sections open from «Ещё». */
  readonly pinned?: boolean;
  /** Tools of the demo itself, hidden outside demo mode. */
  readonly demoOnly?: boolean;
  /** A section of one messenger, shown only in languages whose readers are offered it. */
  readonly messenger?: MessengerChannel;
}

/** Sections of the cabinet. A new section is one entry here plus its route. */
export const navigationSections: readonly NavigationSection[] = [
  {
    path: 'schedule',
    labelKey: 'nav.schedule',
    icon: CalendarDays,
    area: 'schedule',
    pinned: true,
  },
  { path: 'bookings', labelKey: 'nav.bookings', icon: ListChecks, area: 'bookings', pinned: true },
  { path: 'clients', labelKey: 'nav.clients', icon: Users, area: 'clients', pinned: true },
  { path: 'team', labelKey: 'nav.team', icon: UsersRound, area: 'team' },
  { path: 'services', labelKey: 'nav.catalog', icon: BookOpenText, area: 'catalog' },
  { path: 'loyalty', labelKey: 'nav.loyalty', icon: Gift, area: 'loyalty' },
  { path: 'reports', labelKey: 'nav.reports', icon: ChartColumn, area: 'reports' },
  { path: 'settings', labelKey: 'nav.settings', icon: Settings, area: 'settings' },
  {
    path: 'max-emulator',
    labelKey: 'nav.maxEmulator',
    icon: MessagesSquare,
    area: 'messengers',
    demoOnly: true,
    messenger: 'max',
  },
];
