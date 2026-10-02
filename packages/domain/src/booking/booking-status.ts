interface BookingStatusDefinition {
  /** Whether the booking blocks staff and resources for its time range. */
  readonly occupiesTime: boolean;
  /** Final statuses accept no further transitions. */
  readonly isFinal: boolean;
  /** The client may still reschedule, cancel or confirm their visit. */
  readonly acceptsClientChanges: boolean;
}

export const bookingStatuses = {
  confirmed: { occupiesTime: true, isFinal: false, acceptsClientChanges: true },
  completed: { occupiesTime: true, isFinal: true, acceptsClientChanges: false },
  no_show: { occupiesTime: true, isFinal: true, acceptsClientChanges: false },
  cancelled: { occupiesTime: false, isFinal: true, acceptsClientChanges: false },
} as const satisfies Record<string, BookingStatusDefinition>;

export type BookingStatus = keyof typeof bookingStatuses;

export const bookingStatusIds = Object.keys(bookingStatuses) as BookingStatus[];

export const timeOccupyingStatuses = bookingStatusIds.filter(
  (status) => bookingStatuses[status].occupiesTime,
);

/** Status of a booking created by a client. */
export const initialBookingStatus: BookingStatus = 'confirmed';
