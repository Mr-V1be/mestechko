import { z } from 'zod';
import {
  instantSchema,
  localDateSchema,
  moneySchema,
  phoneSchema,
  uuidSchema,
} from '../../primitives.js';
import { defineRoute } from '../../route.js';
import { cabinetBookingDetailsSchema, cabinetParamsSchema } from './schedule.js';

const MAX_SERVICES = 10;
const MAX_NAME_LENGTH = 80;
const MAX_COMMENT_LENGTH = 500;
const MAX_POINTS = 10_000_000;

const bookingParamsSchema = cabinetParamsSchema.extend({ bookingId: uuidSchema });

/** The version the change was made against; a newer one means someone changed it meanwhile. */
const expectedVersionSchema = z.number().int().positive();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === '' ? null : value));

export const deskClientSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('existing'), clientId: uuidSchema }),
  z.object({
    kind: z.literal('new'),
    name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    phone: phoneSchema.nullable(),
  }),
]);

export const createCabinetBooking = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/bookings',
  summary: 'Book a client from the front desk',
  tag: 'cabinet',
  auth: 'session',
  status: 201,
  params: cabinetParamsSchema,
  headers: z.object({ 'idempotency-key': uuidSchema }),
  body: z.object({
    locationId: uuidSchema,
    staffId: uuidSchema,
    serviceIds: z.array(uuidSchema).min(1).max(MAX_SERVICES),
    start: instantSchema,
    client: deskClientSchema,
    comment: optionalText(MAX_COMMENT_LENGTH),
  }),
  response: cabinetBookingDetailsSchema,
});

export const moveCabinetBooking = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/bookings/:bookingId/move',
  summary: 'Move a booking to another time or staff member',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: bookingParamsSchema,
  body: z.object({
    staffId: uuidSchema,
    start: instantSchema,
    expectedVersion: expectedVersionSchema,
  }),
  response: cabinetBookingDetailsSchema,
});

export const cancelCabinetBooking = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/bookings/:bookingId/cancel',
  summary: 'Cancel a booking; a prepayment goes back to the client',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: bookingParamsSchema,
  body: z.object({ expectedVersion: expectedVersionSchema }),
  response: cabinetBookingDetailsSchema,
});

export const completeCabinetBooking = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/bookings/:bookingId/complete',
  summary: 'Mark a visit as done and settle it from a pass, points and money',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: bookingParamsSchema,
  body: z.object({
    expectedVersion: expectedVersionSchema,
    passId: uuidSchema.nullable(),
    points: z.number().int().min(0).max(MAX_POINTS),
  }),
  response: cabinetBookingDetailsSchema,
});

export const markCabinetNoShow = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/bookings/:bookingId/no-show',
  summary: 'Mark that the client did not come',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: bookingParamsSchema,
  body: z.object({ expectedVersion: expectedVersionSchema }),
  response: cabinetBookingDetailsSchema,
});

export const getVisitSettlementOptions = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/bookings/:bookingId/settlement-options',
  summary: 'Passes and points the client can pay for the visit with',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: bookingParamsSchema,
  response: z.object({
    total: moneySchema,
    prepaid: moneySchema,
    pointsBalance: z.number().int(),
    pointsRedeemable: z.number().int(),
    passes: z.array(
      z.object({
        id: uuidSchema,
        name: z.string(),
        visitsLeft: z.number().int(),
        validUntil: localDateSchema,
      }),
    ),
  }),
});

export type DeskClient = z.infer<typeof deskClientSchema>;
export type VisitSettlementOptions = z.infer<typeof getVisitSettlementOptions.response>;
