interface BookingStatusDefinition {
  /** Whether the booking blocks staff and resources for its time range. */
  readonly occupiesTime: boolean;
  /** Final statuses accept no further transitions. */
  readonly isFinal: boolean;
  /** The client may still reschedule, cancel or confirm their visit. */
  readonly acceptsClientChanges: boolean;
  /** The client may give the time up at any moment, whatever the change cutoff. */
  readonly clientMayRelease: boolean;
  /** The business may move the booking to another time or staff member. */
  readonly movable: boolean;
  /** Statuses the booking may move to; the database guards the rest. */
  readonly next: readonly string[];
}

export const bookingStatuses = {
  /** Time held for a short while: until a prepayment arrives or an offer is answered. */
  held: {
    occupiesTime: true,
    isFinal: false,
    acceptsClientChanges: false,
    clientMayRelease: true,
    movable: false,
    next: ['confirmed', 'cancelled'],
  },
  confirmed: {
    occupiesTime: true,
    isFinal: false,
    acceptsClientChanges: true,
    clientMayRelease: false,
    movable: true,
    next: ['completed', 'no_show', 'cancelled'],
  },
  completed: {
    occupiesTime: true,
    isFinal: true,
    acceptsClientChanges: false,
    clientMayRelease: false,
    movable: false,
    next: [],
  },
  no_show: {
    occupiesTime: true,
    isFinal: true,
    acceptsClientChanges: false,
    clientMayRelease: false,
    movable: false,
    next: [],
  },
  cancelled: {
    occupiesTime: false,
    isFinal: true,
    acceptsClientChanges: false,
    clientMayRelease: false,
    movable: false,
    next: [],
  },
} as const satisfies Record<string, BookingStatusDefinition>;

export type BookingStatus = keyof typeof bookingStatuses;

export const bookingStatusIds = Object.keys(bookingStatuses) as BookingStatus[];

export const timeOccupyingStatuses = bookingStatusIds.filter(
  (status) => bookingStatuses[status].occupiesTime,
);

/** Status of a booking created by a client. */
export const initialBookingStatus: BookingStatus = 'confirmed';

export function canMoveToStatus(from: BookingStatus, to: BookingStatus): boolean {
  return (bookingStatuses[from].next as readonly string[]).includes(to);
}
