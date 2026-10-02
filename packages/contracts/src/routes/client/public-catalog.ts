import { staffAssignmentStrategyIds } from '@mestechko/domain';
import { z } from 'zod';
import {
  currencySchema,
  instantSchema,
  listParam,
  localDateSchema,
  moneySchema,
  slugSchema,
  uuidSchema,
  verticalSummarySchema,
} from '../../primitives.js';
import { defineRoute } from '../../route.js';

const MAX_SERVICES = 10;

export const businessParamsSchema = z.object({ slug: slugSchema });

export const locationSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  address: z.string(),
  timeZone: z.string(),
});

export const publicBusinessSchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  name: z.string(),
  vertical: verticalSummarySchema,
  /** ISO 3166-1 alpha-2; the default region for phone numbers. */
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  currency: currencySchema,
  locations: z.array(locationSchema),
  booking: z.object({
    slotStepMinutes: z.number().int(),
    horizonDays: z.number().int(),
    maxServicesPerBooking: z.number().int(),
  }),
});

export const catalogServiceSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  durationMinutes: z.number().int(),
  /** Lowest price among the staff; `priceVaries` means some charge more. */
  price: moneySchema,
  priceVaries: z.boolean(),
  /** Staff who provide the service here; services combine only when someone does them all. */
  providerIds: z.array(uuidSchema),
});

export const serviceCategorySchema = z.object({
  id: uuidSchema,
  name: z.string(),
  services: z.array(catalogServiceSchema),
});

export const staffOptionSchema = z.object({
  id: uuidSchema,
  displayName: z.string(),
  title: z.string().nullable(),
  /** Path of the avatar image relative to the API base. */
  avatarUrl: z.string(),
  nextSlot: instantSchema.nullable(),
  /** Price of the chosen services with this staff member. */
  total: moneySchema,
});

export const availableDaySchema = z.object({
  date: localDateSchema,
  slots: z.array(z.object({ start: instantSchema })),
});

export const getPublicBusiness = defineRoute({
  method: 'GET',
  path: '/v1/public/businesses/:slug',
  summary: 'Business card with its locations and booking settings',
  tag: 'catalog',
  auth: 'none',
  status: 200,
  params: businessParamsSchema,
  response: publicBusinessSchema,
});

export const listPublicServices = defineRoute({
  method: 'GET',
  path: '/v1/public/businesses/:slug/services',
  summary: 'Services bookable at a location, grouped by category',
  tag: 'catalog',
  auth: 'none',
  status: 200,
  params: businessParamsSchema,
  query: z.object({ locationId: uuidSchema }),
  response: z.object({
    categories: z.array(serviceCategorySchema),
    /** Pairs of services never booked together. */
    incompatible: z.array(z.object({ serviceId: uuidSchema, otherServiceId: uuidSchema })),
  }),
});

export const listPublicStaff = defineRoute({
  method: 'GET',
  path: '/v1/public/businesses/:slug/staff',
  summary: 'Staff able to perform the chosen services, with their nearest free time',
  tag: 'catalog',
  auth: 'none',
  status: 200,
  params: businessParamsSchema,
  query: z.object({ locationId: uuidSchema, serviceIds: listParam(uuidSchema, MAX_SERVICES) }),
  response: z.object({ anyNextSlot: instantSchema.nullable(), staff: z.array(staffOptionSchema) }),
});

export const getAvailability = defineRoute({
  method: 'GET',
  path: '/v1/public/businesses/:slug/availability',
  summary: 'Free start times per day for the chosen services and staff',
  tag: 'catalog',
  auth: 'none',
  status: 200,
  params: businessParamsSchema,
  query: z.object({
    locationId: uuidSchema,
    serviceIds: listParam(uuidSchema, MAX_SERVICES),
    staffId: uuidSchema.optional(),
    from: localDateSchema,
    to: localDateSchema,
  }),
  response: z.object({ timeZone: z.string(), days: z.array(availableDaySchema) }),
});

export const bookingQuoteSchema = z.object({
  /** Whether the start is still free for these services and staff preference. */
  available: z.boolean(),
  /** Who would be booked right now and what it costs with them. */
  assigned: z
    .object({
      staff: z.object({
        id: uuidSchema,
        displayName: z.string(),
        title: z.string().nullable(),
        avatarUrl: z.string(),
      }),
      total: moneySchema,
      end: instantSchema,
    })
    .nullable(),
  /** Prices across everyone free at this start; differs only for "any staff". */
  priceRange: z.object({ min: moneySchema, max: moneySchema }).nullable(),
  /** How "any staff" is assigned, for explaining it to the client. */
  assignmentRule: z.enum(staffAssignmentStrategyIds).nullable(),
  /** Prepayment the booking would ask for with the assigned staff member. */
  deposit: moneySchema.nullable(),
});

export const getBookingQuote = defineRoute({
  method: 'GET',
  path: '/v1/public/businesses/:slug/quote',
  summary: 'Who would be booked at a start and the exact price',
  tag: 'catalog',
  auth: 'none',
  status: 200,
  params: businessParamsSchema,
  query: z.object({
    locationId: uuidSchema,
    serviceIds: listParam(uuidSchema, MAX_SERVICES),
    staffId: uuidSchema.optional(),
    start: instantSchema,
  }),
  response: bookingQuoteSchema,
});

export type PublicBusiness = z.infer<typeof publicBusinessSchema>;
export type BookingQuoteView = z.infer<typeof bookingQuoteSchema>;
export type Location = z.infer<typeof locationSchema>;
export type CatalogService = z.infer<typeof catalogServiceSchema>;
export type ServiceCategory = z.infer<typeof serviceCategorySchema>;
export type StaffOption = z.infer<typeof staffOptionSchema>;
export type AvailableDay = z.infer<typeof availableDaySchema>;
