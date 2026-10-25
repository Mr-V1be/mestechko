import { z } from 'zod';
import { localeSchema } from '../../primitives.js';
import { defineRoute } from '../../route.js';

export const clientPreferencesSchema = z.object({
  /** The language the client chose; `null` follows the language of their Telegram. */
  locale: localeSchema.nullable(),
});

export const getMiniAppPreferences = defineRoute({
  method: 'GET',
  path: '/v1/miniapp/preferences',
  summary: "The client's own settings: the language they chose",
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  response: clientPreferencesSchema,
});

export const updateMiniAppPreferences = defineRoute({
  method: 'PUT',
  path: '/v1/miniapp/preferences',
  summary: 'Keeps the language the client chose; the bot writes to them in it too',
  tag: 'miniapp',
  auth: 'telegram',
  status: 200,
  body: z.object({ locale: localeSchema }),
  response: clientPreferencesSchema,
});

export type ClientPreferences = z.infer<typeof clientPreferencesSchema>;
