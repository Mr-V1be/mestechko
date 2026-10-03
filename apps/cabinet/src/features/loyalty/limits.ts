/**
 * Limits the API contract puts on passes and the program (`routes/cabinet/loyalty.ts`).
 * The server checks them; the forms check them too so the message appears at the field.
 */
export const loyaltyLimits = {
  nameMax: 120,
  visitsMin: 1,
  visitsMax: 100,
  validityMin: 1,
  validityMax: 730,
  percentMax: 100,
} as const;

/** A new pass starts as a typical monthly pack. */
export const newPlanDefaults = {
  visits: 4,
  validityDays: 30,
} as const;

/** The visit the program's example is worked out for, in major units of the currency. */
export const EXAMPLE_VISIT_MAJOR = 3000;
