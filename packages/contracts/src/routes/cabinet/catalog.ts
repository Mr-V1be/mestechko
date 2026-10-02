import { z } from 'zod';
import { moneySchema, uuidSchema } from '../../primitives.js';
import { defineRoute } from '../../route.js';
import { cabinetParamsSchema } from './schedule.js';

const MAX_NAME_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_MINUTES = 720;
const MAX_STAFF = 200;
const MAX_PAIRS = 100;

const serviceParamsSchema = cabinetParamsSchema.extend({ serviceId: uuidSchema });
const categoryParamsSchema = cabinetParamsSchema.extend({ categoryId: uuidSchema });

export const serviceAdminSchema = z.object({
  id: uuidSchema,
  categoryId: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  durationMinutes: z.number().int(),
  bufferBeforeMinutes: z.number().int(),
  bufferAfterMinutes: z.number().int(),
  price: moneySchema,
  /** Resource the service occupies, e.g. a chair; `null` when none. */
  resourceTypeId: z.string().nullable(),
  /** Share paid in advance; `null` follows the business rule. */
  depositPercent: z.number().int().min(0).max(100).nullable(),
  isActive: z.boolean(),
  /** Staff providing it, with personal terms when they differ. */
  staff: z.array(
    z.object({
      staffId: uuidSchema,
      durationMinutes: z.number().int().nullable(),
      price: moneySchema.nullable(),
    }),
  ),
  /** Services never booked together with this one. */
  incompatibleWith: z.array(uuidSchema),
});

export const categoryAdminSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  services: z.array(serviceAdminSchema),
});

export const getCabinetCatalog = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/catalog',
  summary: 'Categories and services with prices, staff terms and incompatible combinations',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  response: z.object({
    categories: z.array(categoryAdminSchema),
    /** Resource types of the business's vertical, with their translation keys. */
    resourceTypes: z.array(z.object({ id: z.string(), term: z.string() })),
    /** The business rule services follow unless they set their own share. */
    depositPercent: z.number().int(),
  }),
});

const categoryBodySchema = z.object({ name: z.string().trim().min(1).max(MAX_NAME_LENGTH) });

export const createServiceCategory = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/catalog/categories',
  summary: 'Add a category of services',
  tag: 'cabinet',
  auth: 'session',
  status: 201,
  params: cabinetParamsSchema,
  body: categoryBodySchema,
  response: categoryAdminSchema,
});

export const updateServiceCategory = defineRoute({
  method: 'PATCH',
  path: '/v1/cabinet/businesses/:businessId/catalog/categories/:categoryId',
  summary: 'Rename a category or move it in the list',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: categoryParamsSchema,
  body: categoryBodySchema.partial().extend({ position: z.number().int().min(0).optional() }),
  response: categoryAdminSchema,
});

const serviceFieldsSchema = z.object({
  categoryId: uuidSchema,
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  description: z
    .string()
    .trim()
    .max(MAX_DESCRIPTION_LENGTH)
    .nullable()
    .transform((value) => (value === '' ? null : value)),
  durationMinutes: z.number().int().min(5).max(MAX_MINUTES),
  bufferBeforeMinutes: z.number().int().min(0).max(MAX_MINUTES),
  bufferAfterMinutes: z.number().int().min(0).max(MAX_MINUTES),
  priceMinor: z.number().int().min(0),
  resourceTypeId: z.string().nullable(),
  depositPercent: z.number().int().min(0).max(100).nullable(),
});

export const createService = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/catalog/services',
  summary: 'Add a service',
  tag: 'cabinet',
  auth: 'session',
  status: 201,
  params: cabinetParamsSchema,
  body: serviceFieldsSchema,
  response: serviceAdminSchema,
});

export const updateService = defineRoute({
  method: 'PATCH',
  path: '/v1/cabinet/businesses/:businessId/catalog/services/:serviceId',
  summary: 'Change a service, move it in its category, or stop offering it',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: serviceParamsSchema,
  body: serviceFieldsSchema
    .partial()
    .extend({ isActive: z.boolean().optional(), position: z.number().int().min(0).optional() }),
  response: serviceAdminSchema,
});

export const setServiceStaff = defineRoute({
  method: 'PUT',
  path: '/v1/cabinet/businesses/:businessId/catalog/services/:serviceId/staff',
  summary: 'Who provides a service, with personal durations and prices',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: serviceParamsSchema,
  body: z.object({
    staff: z
      .array(
        z.object({
          staffId: uuidSchema,
          durationMinutes: z.number().int().min(5).max(MAX_MINUTES).nullable(),
          priceMinor: z.number().int().min(0).nullable(),
        }),
      )
      .max(MAX_STAFF),
  }),
  response: serviceAdminSchema,
});

export const setServiceIncompatibilities = defineRoute({
  method: 'PUT',
  path: '/v1/cabinet/businesses/:businessId/catalog/services/:serviceId/incompatible',
  summary: 'Services never booked together with this one',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: serviceParamsSchema,
  body: z.object({ serviceIds: z.array(uuidSchema).max(MAX_PAIRS) }),
  response: serviceAdminSchema,
});

export type ServiceAdmin = z.infer<typeof serviceAdminSchema>;
export type CategoryAdmin = z.infer<typeof categoryAdminSchema>;
export type CabinetCatalog = z.infer<typeof getCabinetCatalog.response>;
