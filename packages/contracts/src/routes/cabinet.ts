import { z } from 'zod';
import {
  bookingSourceSchema,
  bookingStatusSchema,
  currencySchema,
  instantSchema,
  intParam,
  localDateSchema,
  moneySchema,
  pageCursorSchema,
  pageOf,
  slugSchema,
  timeRangeSchema,
  uuidSchema,
  verticalSummarySchema,
} from '../primitives.js';
import { defineRoute } from '../route.js';
import { locationSchema } from './public-catalog.js';

export const scheduleAxes = ['staff', 'resource'] as const;
const MAX_PAGE_SIZE = 100;

const cabinetParamsSchema = z.object({ businessId: uuidSchema });

export const cabinetStaffSchema = z.object({
  id: uuidSchema,
  displayName: z.string(),
  title: z.string().nullable(),
  avatarUrl: z.string(),
});

export const cabinetResourceSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  typeId: z.string(),
  typeTerm: z.string(),
  locationId: uuidSchema,
});

export const getCabinetOverview = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/overview',
  summary: 'Reference data of a business: locations, staff and resources',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  response: z.object({
    business: z.object({
      id: uuidSchema,
      slug: slugSchema,
      name: z.string(),
      vertical: verticalSummarySchema,
      currency: currencySchema,
    }),
    locations: z.array(locationSchema),
    staff: z.array(cabinetStaffSchema),
    resources: z.array(cabinetResourceSchema),
  }),
});

export const scheduleColumnSchema = z.object({
  id: uuidSchema,
  kind: z.enum(scheduleAxes),
  title: z.string(),
  subtitle: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  /** Translation key of the resource type (`terms:resourceType.*`) for resource columns. */
  typeTerm: z.string().nullable(),
});

export const scheduleBookingSchema = z.object({
  id: uuidSchema,
  columnId: uuidSchema,
  status: bookingStatusSchema,
  start: instantSchema,
  end: instantSchema,
  occupied: timeRangeSchema,
  clientName: z.string(),
  serviceNames: z.array(z.string()),
  staffName: z.string(),
});

export const getSchedule = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/schedule',
  summary: 'Working hours and bookings of a location per staff member or resource',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  query: z.object({
    locationId: uuidSchema,
    from: localDateSchema,
    to: localDateSchema,
    axis: z.enum(scheduleAxes),
  }),
  response: z.object({
    timeZone: z.string(),
    columns: z.array(scheduleColumnSchema),
    workingHours: z.array(
      z.object({
        columnId: uuidSchema,
        date: localDateSchema,
        intervals: z.array(timeRangeSchema),
      }),
    ),
    bookings: z.array(scheduleBookingSchema),
  }),
});

export const cabinetBookingRowSchema = z.object({
  id: uuidSchema,
  status: bookingStatusSchema,
  source: bookingSourceSchema,
  start: instantSchema,
  end: instantSchema,
  timeZone: z.string(),
  client: z.object({ id: uuidSchema, displayName: z.string(), phone: z.string().nullable() }),
  staff: cabinetStaffSchema,
  location: z.object({ id: uuidSchema, name: z.string() }),
  services: z.array(z.object({ id: uuidSchema, name: z.string() })),
  total: moneySchema,
});

export const cabinetBookingDetailsSchema = cabinetBookingRowSchema.extend({
  comment: z.string().nullable(),
  createdAt: instantSchema,
  items: z.array(
    z.object({
      serviceId: uuidSchema,
      serviceName: z.string(),
      start: instantSchema,
      end: instantSchema,
      price: moneySchema,
      resourceName: z.string().nullable(),
    }),
  ),
});

export const listCabinetBookings = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/bookings',
  summary: 'Bookings of a period, newest start first within the filter',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  query: z.object({
    from: localDateSchema,
    to: localDateSchema,
    status: bookingStatusSchema.optional(),
    staffId: uuidSchema.optional(),
    locationId: uuidSchema.optional(),
    search: z.string().trim().min(2).max(80).optional(),
    cursor: pageCursorSchema.optional(),
    limit: intParam(1, MAX_PAGE_SIZE).optional(),
  }),
  response: pageOf(cabinetBookingRowSchema),
});

export const getCabinetBooking = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/bookings/:bookingId',
  summary: 'Details of one booking',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema.extend({ bookingId: uuidSchema }),
  response: cabinetBookingDetailsSchema,
});

export type ScheduleAxis = (typeof scheduleAxes)[number];
export type ScheduleColumn = z.infer<typeof scheduleColumnSchema>;
export type ScheduleBooking = z.infer<typeof scheduleBookingSchema>;
export type CabinetBookingRow = z.infer<typeof cabinetBookingRowSchema>;
export type CabinetBookingDetails = z.infer<typeof cabinetBookingDetailsSchema>;
export type CabinetStaff = z.infer<typeof cabinetStaffSchema>;
export type CabinetResource = z.infer<typeof cabinetResourceSchema>;
