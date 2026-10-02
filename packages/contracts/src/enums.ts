/** Value lists shared by schemas and clients; free of validation code. */
export const bookingScopes = ['upcoming', 'past'] as const;
export type BookingScope = (typeof bookingScopes)[number];

export const scheduleAxes = ['staff', 'resource'] as const;
export type ScheduleAxis = (typeof scheduleAxes)[number];
