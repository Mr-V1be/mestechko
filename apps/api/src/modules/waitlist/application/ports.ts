import type { MessengerChannel, WaitlistStatus, WaitlistWindow } from '@mestechko/domain';

export interface NewWaitlistEntry {
  readonly id: string;
  readonly clientId: string;
  readonly locationId: string;
  readonly staffId: string | null;
  readonly serviceIds: readonly string[];
  /** Local date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly window: WaitlistWindow;
  readonly channel: MessengerChannel;
  readonly now: Date;
}

/** A client's wish to be offered a free time, as matching and offers need it. */
export interface WaitlistEntryRecord {
  readonly id: string;
  readonly clientId: string;
  readonly customerId: string | null;
  readonly locationId: string;
  readonly staffId: string | null;
  readonly serviceIds: readonly string[];
  readonly date: string;
  readonly window: WaitlistWindow;
  readonly channel: MessengerChannel;
  readonly status: WaitlistStatus;
  readonly createdAt: Date;
}

/** The same wish with names, as the client sees it. */
export interface WaitlistEntryView extends WaitlistEntryRecord {
  readonly location: {
    readonly id: string;
    readonly name: string;
    readonly address: string;
    readonly timeZone: string;
  };
  readonly staff: { readonly id: string; readonly displayName: string } | null;
  readonly services: readonly { readonly id: string; readonly name: string }[];
}

/** Waitlist of the current tenant. Every call runs inside a tenant unit of work. */
export interface WaitlistStore {
  /** Saves the wish; it replaces the client's open wish for that day and location. */
  saveOpen(entry: NewWaitlistEntry): Promise<string>;
  find(entryId: string): Promise<WaitlistEntryView | null>;
  /** Open wishes of a client from the given local date on, soonest first. */
  listOpenForClient(clientId: string, fromDate: string): Promise<WaitlistEntryView[]>;
  /** Open wishes for a day in a location, oldest first: who waited longer is offered first. */
  listOpenForDay(locationId: string, date: string): Promise<WaitlistEntryRecord[]>;
  cancel(entryId: string, clientId: string, now: Date): Promise<boolean>;
  markBooked(entryId: string, bookingId: string, now: Date): Promise<void>;
}

export const WAITLIST_STORE = Symbol('WAITLIST_STORE');
