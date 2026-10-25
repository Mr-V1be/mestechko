import { z } from 'zod';
import { localeSchema, roleSchema, slugSchema, verticalSummarySchema } from '../primitives.js';
import { defineRoute } from '../route.js';

export const demoBusinessSchema = z.object({
  slug: slugSchema,
  name: z.string(),
  /** The language the business presents itself in; a demo shows its own language's businesses. */
  locale: localeSchema,
  vertical: verticalSummarySchema,
  address: z.string(),
  /** Roles a visitor can sign in as, with the person behind each. */
  personas: z.array(z.object({ role: roleSchema, displayName: z.string() })),
});

export const listDemoBusinesses = defineRoute({
  method: 'GET',
  path: '/v1/demo/businesses',
  summary: 'Businesses available in the demo (demo mode only)',
  tag: 'demo',
  auth: 'none',
  status: 200,
  response: z.object({ businesses: z.array(demoBusinessSchema) }),
});

export const createTelegramLaunch = defineRoute({
  method: 'POST',
  path: '/v1/demo/telegram-launch',
  summary: 'Signed Telegram launch data for opening the client app outside Telegram',
  tag: 'demo',
  auth: 'none',
  status: 201,
  body: z.object({
    businessSlug: slugSchema,
    demoUserId: z
      .string()
      .regex(/^\d{6,15}$/)
      .nullable(),
  }),
  response: z.object({
    initData: z.string(),
    demoUserId: z.string(),
    startParam: slugSchema,
  }),
});

export type DemoBusiness = z.infer<typeof demoBusinessSchema>;
