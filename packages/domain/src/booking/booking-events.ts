/** Changes in a booking's life after it was made; the booking keeps its current state. */
export const bookingEventKinds = ['rescheduled', 'cancelled', 'attendance_confirmed'] as const;
export type BookingEventKind = (typeof bookingEventKinds)[number];

/** Who changed the booking. */
export const bookingActors = ['client', 'business', 'system'] as const;
export type BookingActor = (typeof bookingActors)[number];

/** Moments that may notify the client: the booking was made, or one of its events. */
export type BookingLifecycleEvent = 'created' | BookingEventKind;
