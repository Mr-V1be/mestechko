import { z } from 'zod';
import { instantSchema } from '../primitives.js';
import { defineRoute } from '../route.js';
import { cabinetParamsSchema } from './cabinet.js';

const maxUserIdSchema = z.string().regex(/^[1-9]\d{0,17}$/);
const chatParamsSchema = cabinetParamsSchema.extend({ userId: maxUserIdSchema });

export const maxEmulatorButtonSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('callback'),
    text: z.string(),
    payload: z.string(),
    intent: z.enum(['default', 'positive', 'negative']),
  }),
  z.object({ type: z.literal('link'), text: z.string(), url: z.url() }),
]);

export const maxEmulatorMessageSchema = z.object({
  id: z.string(),
  fromBot: z.boolean(),
  /** Message text; `html` messages use the subset MAX supports (b, i, line breaks). */
  text: z.string().nullable(),
  format: z.enum(['html', 'markdown']).nullable(),
  buttons: z.array(z.array(maxEmulatorButtonSchema)),
  sentAt: instantSchema,
  editedAt: instantSchema.nullable(),
});

export const maxEmulatorChatSchema = z.object({
  userId: maxUserIdSchema,
  clientName: z.string(),
  started: z.boolean(),
  lastMessage: z.object({ text: z.string(), sentAt: instantSchema }).nullable(),
});

export const listMaxEmulatorChats = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/max-emulator/chats',
  summary: 'Clients who use MAX and their chats with the bot, as the MAX emulator holds them',
  tag: 'max-emulator',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  response: z.object({ chats: z.array(maxEmulatorChatSchema) }),
});

export const getMaxEmulatorChat = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/max-emulator/chats/:userId',
  summary: 'One client’s chat with the bot, with one-time notices the bot showed',
  tag: 'max-emulator',
  auth: 'session',
  status: 200,
  params: chatParamsSchema,
  response: z.object({
    chat: maxEmulatorChatSchema,
    messages: z.array(maxEmulatorMessageSchema),
    notices: z.array(z.object({ text: z.string(), shownAt: instantSchema })),
  }),
});

export const startMaxEmulatorChat = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/max-emulator/chats/:userId/start',
  summary: 'Press “Start” in the client’s MAX app',
  tag: 'max-emulator',
  auth: 'session',
  status: 204,
  params: chatParamsSchema,
  response: null,
});

export const sendMaxEmulatorText = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/max-emulator/chats/:userId/messages',
  summary: 'Write to the bot as the client',
  tag: 'max-emulator',
  auth: 'session',
  status: 204,
  params: chatParamsSchema,
  body: z.object({ text: z.string().trim().min(1).max(4000) }),
  response: null,
});

export const pressMaxEmulatorButton = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/max-emulator/chats/:userId/press',
  summary: 'Press a button under a bot message as the client',
  tag: 'max-emulator',
  auth: 'session',
  status: 204,
  params: chatParamsSchema,
  body: z.object({ messageId: z.string().min(1).max(64), payload: z.string().min(1).max(1024) }),
  response: null,
});

export type MaxEmulatorChat = z.infer<typeof maxEmulatorChatSchema>;
export type MaxEmulatorMessage = z.infer<typeof maxEmulatorMessageSchema>;
export type MaxEmulatorButton = z.infer<typeof maxEmulatorButtonSchema>;
