import { z } from 'zod';
import {
  accessMapSchema,
  currencySchema,
  roleSchema,
  slugSchema,
  uuidSchema,
  verticalSummarySchema,
} from '../primitives.js';
import { defineRoute } from '../route.js';

const MAX_PASSWORD_LENGTH = 200;

export const membershipSchema = z.object({
  business: z.object({
    id: uuidSchema,
    slug: slugSchema,
    name: z.string(),
    vertical: verticalSummarySchema,
    currency: currencySchema,
  }),
  role: roleSchema,
  staffId: uuidSchema.nullable(),
  access: accessMapSchema,
});

export const meSchema = z.object({
  user: z.object({ id: uuidSchema, email: z.string(), displayName: z.string() }),
  memberships: z.array(membershipSchema),
});

export const createSession = defineRoute({
  method: 'POST',
  path: '/v1/auth/sessions',
  summary: 'Sign in to the business cabinet',
  tag: 'auth',
  auth: 'none',
  status: 200,
  body: z.object({
    email: z.email().max(254),
    password: z.string().min(1).max(MAX_PASSWORD_LENGTH),
  }),
  response: meSchema,
});

export const createDemoSession = defineRoute({
  method: 'POST',
  path: '/v1/auth/demo-sessions',
  summary: 'Sign in to a demo business in one of its roles (demo mode only)',
  tag: 'auth',
  auth: 'none',
  status: 200,
  body: z.object({ businessSlug: slugSchema, role: roleSchema.default('owner') }),
  response: meSchema,
});

export const deleteCurrentSession = defineRoute({
  method: 'DELETE',
  path: '/v1/auth/sessions/current',
  summary: 'Sign out',
  tag: 'auth',
  auth: 'session',
  status: 204,
  response: null,
});

export const getMe = defineRoute({
  method: 'GET',
  path: '/v1/auth/me',
  summary: 'Signed-in user and the businesses they can access',
  tag: 'auth',
  auth: 'session',
  status: 200,
  response: meSchema,
});

export type Me = z.infer<typeof meSchema>;
export type Membership = z.infer<typeof membershipSchema>;
