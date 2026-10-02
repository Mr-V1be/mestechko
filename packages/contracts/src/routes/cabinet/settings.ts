import { staffAssignmentStrategyIds } from '@mestechko/domain';
import { z } from 'zod';
import { defineRoute } from '../../route.js';
import { cabinetParamsSchema } from './schedule.js';

/** Booking rules the business tunes; everything else follows its vertical. */
export const businessRulesSchema = z.object({
  slotStepMinutes: z.number().int().min(5).max(240),
  minLeadMinutes: z
    .number()
    .int()
    .min(0)
    .max(7 * 24 * 60),
  horizonDays: z.number().int().min(1).max(366),
  staffAssignment: z.enum(staffAssignmentStrategyIds),
  clientChangeCutoffMinutes: z
    .number()
    .int()
    .min(0)
    .max(7 * 24 * 60),
  depositPercent: z.number().int().min(0).max(100),
  paymentHoldMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
  waitlistOfferHoldMinutes: z
    .number()
    .int()
    .min(5)
    .max(24 * 60),
});

export const getBusinessSettings = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/settings',
  summary: 'Booking rules of the business and its vertical’s defaults',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  response: z.object({
    name: z.string(),
    rules: businessRulesSchema,
    defaults: businessRulesSchema,
  }),
});

export const updateBusinessSettings = defineRoute({
  method: 'PUT',
  path: '/v1/cabinet/businesses/:businessId/settings',
  summary: 'Change the booking rules; values equal to the defaults follow the vertical again',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  body: z.object({
    name: z.string().trim().min(1).max(120),
    rules: businessRulesSchema,
  }),
  response: getBusinessSettings.response,
});

export type BusinessRules = z.infer<typeof businessRulesSchema>;
export type BusinessSettings = z.infer<typeof getBusinessSettings.response>;
