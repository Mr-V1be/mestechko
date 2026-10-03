/**
 * Limits the API contract puts on services (`routes/cabinet/catalog.ts`). The server
 * checks them; the editor checks them too so the message appears at the field.
 */
export const serviceLimits = {
  nameMax: 120,
  descriptionMax: 500,
  durationMin: 5,
  minutesMax: 720,
  percentMax: 100,
} as const;

/** A new service starts as a typical one-hour visit without pauses. */
export const newServiceDefaults = {
  durationMinutes: 60,
  bufferMinutes: 0,
} as const;
