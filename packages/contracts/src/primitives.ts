import {
  accessAreas,
  accessScopes,
  bookingSourceIds,
  bookingStatusIds,
  currencies,
  roleIds,
  type CurrencyCode,
} from '@mestechko/domain';
import { isValidPhoneNumber } from 'libphonenumber-js/min';
import { z } from 'zod';

export const uuidSchema = z.uuid();
export const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/);
/** Local calendar date, `YYYY-MM-DD`. */
export const localDateSchema = z.iso.date();
/** Absolute time, ISO 8601 with offset. */
export const instantSchema = z.iso.datetime({ offset: true });
/** Phone in E.164 form, e.g. `+79161234567`, checked against numbering plans. */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/)
  .refine((value) => isValidPhoneNumber(value), { message: 'Invalid phone number' });

export const currencySchema = z.enum(Object.keys(currencies) as [CurrencyCode, ...CurrencyCode[]]);
export const moneySchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: currencySchema,
});

export const bookingStatusSchema = z.enum(bookingStatusIds);
export const bookingSourceSchema = z.enum(bookingSourceIds);
export const roleSchema = z.enum(roleIds);
export const accessScopeSchema = z.enum(accessScopes);
export const accessMapSchema = z.record(z.enum(accessAreas), accessScopeSchema);

export const timeRangeSchema = z.object({ start: instantSchema, end: instantSchema });

/** Query list accepting `a,b` or repeated parameters. */
export function listParam<T extends z.ZodType<unknown, string>>(item: T, max: number) {
  return z
    .union([z.string(), z.array(z.string())])
    .transform((value) => (Array.isArray(value) ? value : value.split(',')).filter(Boolean))
    .pipe(z.array(item).min(1).max(max));
}

/** Integer query parameter accepting numbers and numeric strings. */
export function intParam(min: number, max: number) {
  return z
    .union([z.number(), z.string().regex(/^\d+$/)])
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
}

export const pageCursorSchema = z.string().min(1).max(200);

export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), nextCursor: pageCursorSchema.nullable() });
}

export const verticalSummarySchema = z.object({
  id: z.string(),
  icon: z.string(),
  vocabulary: z.object({ staff: z.string(), resource: z.string(), client: z.string() }),
});

export type Money = z.infer<typeof moneySchema>;
export type VerticalSummary = z.infer<typeof verticalSummarySchema>;
