import { bookingActionIds } from '@mestechko/domain';
import { z } from 'zod';
import {
  bookingStatusSchema,
  instantSchema,
  localDateSchema,
  moneySchema,
  pageCursorSchema,
  pageOf,
  phoneSchema,
  uuidSchema,
} from '../primitives.js';
import { bookingScopes } from '../enums.js';
import { defineRoute } from '../route.js';
import { availableDaySchema, businessParamsSchema, locationSchema } from './public-catalog.js';

const MAX_SERVICES = 10;
const MAX_NAME_LENGTH = 80;
const MAX_COMMENT_LENGTH = 500;

export const clientBookingSchema = z.object({
  id: uuidSchema,
  status: bookingStatusSchema,
  /** Grows with every reschedule or cancellation. */
  version: z.number().int().positive(),
  start: instantSchema,
  end: instantSchema,
  attendanceConfirmed: z.boolean(),
  /** Until when the client may reschedule or cancel online; `null` once the booking is final. */
  changeDeadline: instantSchema.nullable(),
  /** What the client can do with the booking right now. */
  actions: z.record(z.enum(bookingActionIds), z.boolean()),
  location: locationSchema,
  staff: z.object({
    id: uuidSchema,
    displayName: z.string(),
    title: z.string().nullable(),
    avatarUrl: z.string(),
  }),
  services: z.array(
    z.object({
      id: uuidSchema,
      name: z.string(),
      durationMinutes: z.number().int(),
      price: moneySchema,
    }),
  ),
  total: moneySchema,
  comment: z.string().nullable(),
  createdAt: instantSchema,
});

export const bookingContactSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  phone: phoneSchema,
});

export const createMiniAppBooking = defineRoute({
  method: 'POST',
  path: '/v1/miniapp/businesses/:slug/bookings',
  summary: 'Book the chosen services at a free start time',
  tag: 'miniapp',
  auth: 'telegram',
  status: 201,
  params: businessParamsSchema,
  headers: z.object({ 'idempotency-key': uuidSchema }),
  body: z.object({
    locationId: uuidSchema,
    serviceIds: z.array(uuidSchema).min(1).max(MAX_SERVICES),
    staffId: uuidSchema.nullable(),
    start: instantSchema,
    /** Total the client saw and confirmed; the booking is never made at a higher price. */
    agreedTotal: moneySchema,
    contact: bookingContactSchema,
    comment: z
      .string()
      .trim()
      .max(MAX_COMMENT_LENGTH)
      .nullable()
      .transform((value) => (value === '' ? null : value)),
  }),
  response: clientBookingSchema,
});

export const listMiniAppBookings = defineRoute({
  method: 'GET',
  path: '/v1/miniapp/businesses/:slug/bookings',
  summary: "The client's own bookings in the business",
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  params: businessParamsSchema,
  query: z.object({ scope: z.enum(bookingScopes), cursor: pageCursorSchema.optional() }),
  response: pageOf(clientBookingSchema),
});

export const getMiniAppBooking = defineRoute({
  method: 'GET',
  path: '/v1/miniapp/businesses/:slug/bookings/:bookingId',
  summary: "One of the client's own bookings",
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  params: businessParamsSchema.extend({ bookingId: uuidSchema }),
  response: clientBookingSchema,
});

export const getMiniAppProfile = defineRoute({
  method: 'GET',
  path: '/v1/miniapp/businesses/:slug/profile',
  summary: 'Contact details the business already knows about the client',
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  params: businessParamsSchema,
  response: z.object({ displayName: z.string().nullable(), phone: z.string().nullable() }),
});

export const getMiniAppNotifications = defineRoute({
  method: 'GET',
  path: '/v1/miniapp/notifications',
  summary: 'Whether the bot may message the client, and where to allow it if not',
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  response: z.object({ enabled: z.boolean(), connectUrl: z.url().nullable() }),
});

const bookingParamsSchema = businessParamsSchema.extend({ bookingId: uuidSchema });

export const cancelMiniAppBooking = defineRoute({
  method: 'POST',
  path: '/v1/miniapp/businesses/:slug/bookings/:bookingId/cancel',
  summary: 'Cancel one of the client’s own bookings while online changes are open',
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  params: bookingParamsSchema,
  response: clientBookingSchema,
});

export const getRescheduleOptions = defineRoute({
  method: 'GET',
  path: '/v1/miniapp/businesses/:slug/bookings/:bookingId/reschedule-options',
  summary: 'Free start times to move a booking to, with the same staff member',
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  params: bookingParamsSchema,
  query: z.object({ from: localDateSchema, to: localDateSchema }),
  response: z.object({ timeZone: z.string(), days: z.array(availableDaySchema) }),
});

export const rescheduleMiniAppBooking = defineRoute({
  method: 'POST',
  path: '/v1/miniapp/businesses/:slug/bookings/:bookingId/reschedule',
  summary: 'Move a booking to another free start; the price never grows',
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  params: bookingParamsSchema,
  body: z.object({ start: instantSchema }),
  response: clientBookingSchema,
});

export const confirmMiniAppAttendance = defineRoute({
  method: 'POST',
  path: '/v1/miniapp/businesses/:slug/bookings/:bookingId/attendance',
  summary: 'Confirm the client will come',
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  params: bookingParamsSchema,
  response: clientBookingSchema,
});

export type ClientBooking = z.infer<typeof clientBookingSchema>;
export type BookingContact = z.infer<typeof bookingContactSchema>;
