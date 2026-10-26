import { checkoutPresentationIds, holdReasonIds, paymentStatusIds } from '@slotwise/domain';
import { z } from 'zod';
import { bookingStatusSchema, instantSchema, moneySchema, uuidSchema } from '../../primitives.js';
import { defineRoute } from '../../route.js';
import { bookingContactSchema, returnPathSchema } from './miniapp-bookings.js';
import { businessParamsSchema, locationSchema } from './public-catalog.js';

const MAX_SERVICES = 10;
const MAX_COMMENT_LENGTH = 500;

/** A booking made on the business's website, as its visitor sees it. */
export const widgetBookingSchema = z.object({
  id: uuidSchema,
  status: bookingStatusSchema,
  hold: z.object({ reason: z.enum(holdReasonIds), expiresAt: instantSchema }).nullable(),
  start: instantSchema,
  end: instantSchema,
  location: locationSchema,
  staffName: z.string(),
  serviceNames: z.array(z.string()),
  total: moneySchema,
  deposit: moneySchema.nullable(),
  paymentStatus: z.enum(paymentStatusIds).nullable(),
});

const bookingTokenHeaders = z.object({
  /** Proof the visitor made this booking, returned when it was created. */
  'x-booking-token': z.string().min(16).max(128),
});

export const createWidgetBooking = defineRoute({
  method: 'POST',
  path: '/v1/widget/businesses/:slug/bookings',
  summary: 'Book from the business’s website',
  tag: 'widget',
  auth: 'none',
  status: 201,
  params: businessParamsSchema,
  headers: z.object({ 'idempotency-key': uuidSchema }),
  body: z.object({
    locationId: uuidSchema,
    serviceIds: z.array(uuidSchema).min(1).max(MAX_SERVICES),
    staffId: uuidSchema.nullable(),
    start: instantSchema,
    agreedTotal: moneySchema,
    contact: bookingContactSchema,
    comment: z
      .string()
      .trim()
      .max(MAX_COMMENT_LENGTH)
      .nullable()
      .transform((value) => (value === '' ? null : value)),
    /** The visitor agreed to the processing of their contact details. */
    consent: z.literal(true),
    /** Where the payment page sends the visitor back, when a prepayment is due. */
    returnPath: returnPathSchema,
  }),
  response: z.object({
    booking: widgetBookingSchema,
    token: z.string(),
    /** Payment page when the booking asks for a prepayment. */
    checkoutUrl: z.string().nullable(),
    /** Where to open it: in place of the form, or in a new browser window. */
    checkoutPresentation: z.enum(checkoutPresentationIds).nullable(),
  }),
});

export const getWidgetBooking = defineRoute({
  method: 'GET',
  path: '/v1/widget/businesses/:slug/bookings/:bookingId',
  summary: 'A booking made on the website, for its visitor',
  tag: 'widget',
  auth: 'none',
  status: 200,
  params: businessParamsSchema.extend({ bookingId: uuidSchema }),
  headers: bookingTokenHeaders,
  response: widgetBookingSchema,
});

export type WidgetBooking = z.infer<typeof widgetBookingSchema>;
