import { dayPartIds } from '@slotwise/domain';
import { z } from 'zod';
import { instantSchema, localDateSchema, uuidSchema } from '../../primitives.js';
import { defineRoute } from '../../route.js';
import { bookingContactSchema, clientBookingSchema } from './miniapp-bookings.js';
import { businessParamsSchema, locationSchema } from './public-catalog.js';

const MAX_SERVICES = 10;

export const waitlistEntrySchema = z.object({
  id: uuidSchema,
  date: localDateSchema,
  /** Part of the day the client waits for; `null` means any time that day. */
  dayPart: z.enum(dayPartIds).nullable(),
  location: locationSchema,
  staff: z.object({ id: uuidSchema, displayName: z.string() }).nullable(),
  services: z.array(z.object({ id: uuidSchema, name: z.string() })),
  createdAt: instantSchema,
});

export const joinMiniAppWaitlist = defineRoute({
  method: 'POST',
  path: '/v1/miniapp/businesses/:slug/waitlist',
  summary: 'Wait for a free time on a day; replaces the client’s wish for that day',
  tag: 'miniapp',
  auth: 'telegram',
  status: 201,
  params: businessParamsSchema,
  body: z.object({
    locationId: uuidSchema,
    serviceIds: z.array(uuidSchema).min(1).max(MAX_SERVICES),
    staffId: uuidSchema.nullable(),
    date: localDateSchema,
    dayPart: z.enum(dayPartIds).nullable(),
    contact: bookingContactSchema,
  }),
  response: waitlistEntrySchema,
});

export const listMiniAppWaitlist = defineRoute({
  method: 'GET',
  path: '/v1/miniapp/businesses/:slug/waitlist',
  summary: 'Days the client still waits for in the business',
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  params: businessParamsSchema,
  response: z.object({ items: z.array(waitlistEntrySchema) }),
});

export const leaveMiniAppWaitlist = defineRoute({
  method: 'DELETE',
  path: '/v1/miniapp/businesses/:slug/waitlist/:entryId',
  summary: 'Stop waiting for a day',
  tag: 'miniapp',
  auth: 'telegram',
  status: 204,
  params: businessParamsSchema.extend({ entryId: uuidSchema }),
  response: null,
});

const offerParamsSchema = businessParamsSchema.extend({ bookingId: uuidSchema });

/** Takes the time offered from the waitlist; a prepayment, if due, comes next. */
export const acceptMiniAppOffer = defineRoute({
  method: 'POST',
  path: '/v1/miniapp/businesses/:slug/bookings/:bookingId/offer/accept',
  summary: 'Take the time offered from the waitlist',
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  params: offerParamsSchema,
  response: clientBookingSchema,
});

/** Lets the offered time go to the next in line; the wish stays. */
export const declineMiniAppOffer = defineRoute({
  method: 'POST',
  path: '/v1/miniapp/businesses/:slug/bookings/:bookingId/offer/decline',
  summary: 'Pass the offered time on to the next in line',
  tag: 'miniapp',
  auth: 'telegram',
  status: 204,
  params: offerParamsSchema,
  response: null,
});

export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>;
