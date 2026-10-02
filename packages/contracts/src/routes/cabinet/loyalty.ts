import { loyaltyKindIds } from '@mestechko/domain';
import { z } from 'zod';
import { moneySchema, uuidSchema } from '../../primitives.js';
import { defineRoute } from '../../route.js';
import { clientCardSchema } from './clients.js';
import { cabinetParamsSchema } from './schedule.js';

const MAX_NAME_LENGTH = 120;
const MAX_NOTE_LENGTH = 300;
const MAX_SERVICES = 100;
const MAX_POINTS_CHANGE = 1_000_000;

export const loyaltyProgramSchema = z.object({
  kind: z.enum(loyaltyKindIds),
  /** Points earned per 100 units paid; one point pays one unit. */
  accrualPercent: z.number().int().min(0).max(100),
  /** Largest share of a visit that may be paid with points. */
  maxRedeemPercent: z.number().int().min(0).max(100),
});

export const passPlanSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  visits: z.number().int(),
  validityDays: z.number().int(),
  price: moneySchema,
  serviceIds: z.array(uuidSchema),
  isActive: z.boolean(),
  /** Passes of this plan sold so far. */
  sold: z.number().int(),
});

export const getLoyaltySettings = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/loyalty',
  summary: 'The loyalty program and the passes the business sells',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  response: z.object({ program: loyaltyProgramSchema, plans: z.array(passPlanSchema) }),
});

export const updateLoyaltyProgram = defineRoute({
  method: 'PUT',
  path: '/v1/cabinet/businesses/:businessId/loyalty/program',
  summary: 'Change how points are earned and spent',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  body: loyaltyProgramSchema,
  response: loyaltyProgramSchema,
});

const planFieldsSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  visits: z.number().int().min(1).max(100),
  validityDays: z.number().int().min(1).max(730),
  priceMinor: z.number().int().min(0),
  serviceIds: z.array(uuidSchema).min(1).max(MAX_SERVICES),
  isActive: z.boolean(),
});

export const createPassPlan = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/loyalty/plans',
  summary: 'Offer a new pass',
  tag: 'cabinet',
  auth: 'session',
  status: 201,
  params: cabinetParamsSchema,
  body: planFieldsSchema,
  response: passPlanSchema,
});

export const updatePassPlan = defineRoute({
  method: 'PUT',
  path: '/v1/cabinet/businesses/:businessId/loyalty/plans/:planId',
  summary: 'Change a pass offer; passes already sold keep their terms',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema.extend({ planId: uuidSchema }),
  body: planFieldsSchema,
  response: passPlanSchema,
});

const clientParamsSchema = cabinetParamsSchema.extend({ clientId: uuidSchema });

export const sellClientPass = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/clients/:clientId/passes',
  summary: 'Sell a pass to a client; it is paid at the front desk',
  tag: 'cabinet',
  auth: 'session',
  status: 201,
  params: clientParamsSchema,
  headers: z.object({ 'idempotency-key': uuidSchema }),
  body: z.object({ planId: uuidSchema }),
  response: clientCardSchema,
});

export const adjustClientPoints = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/clients/:clientId/points',
  summary: 'Add or take points by hand, with a reason',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: clientParamsSchema,
  headers: z.object({ 'idempotency-key': uuidSchema }),
  body: z.object({
    amount: z
      .number()
      .int()
      .min(-MAX_POINTS_CHANGE)
      .max(MAX_POINTS_CHANGE)
      .refine((value) => value !== 0),
    note: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
  }),
  response: clientCardSchema,
});

export type LoyaltyProgram = z.infer<typeof loyaltyProgramSchema>;
export type PassPlan = z.infer<typeof passPlanSchema>;
