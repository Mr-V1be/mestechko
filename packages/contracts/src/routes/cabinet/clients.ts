import { ledgerAccounts, ledgerReasonIds, messengerChannelIds } from '@slotwise/domain';
import { z } from 'zod';
import {
  instantSchema,
  intParam,
  localDateSchema,
  localeSchema,
  moneySchema,
  pageCursorSchema,
  pageOf,
  phoneSchema,
  uuidSchema,
} from '../../primitives.js';
import { defineRoute, fileSpec } from '../../route.js';
import { cabinetBookingRowSchema, cabinetParamsSchema } from './schedule.js';

const MAX_PAGE_SIZE = 100;
const MAX_NAME_LENGTH = 120;
/** Limits of a client's tags, the same as the database keeps. */
export const clientTagLimits = { maxLength: 32, maxCount: 20 } as const;
const MAX_NOTE_LENGTH = 2000;
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Spreadsheet formats clients are imported from and exported to. */
export const clientFileFormats = {
  csv: { mediaType: 'text/csv', extension: 'csv' },
  xlsx: {
    mediaType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
  },
} as const;
export type ClientFileFormat = keyof typeof clientFileFormats;
export const clientFileFormatIds = Object.keys(clientFileFormats) as [
  ClientFileFormat,
  ...ClientFileFormat[],
];
const clientFileMediaTypes = [
  clientFileFormats.csv.mediaType,
  clientFileFormats.xlsx.mediaType,
] as const;

const clientParamsSchema = cabinetParamsSchema.extend({ clientId: uuidSchema });

export const clientTagSchema = z.string().trim().min(1).max(clientTagLimits.maxLength);

export const clientSummarySchema = z.object({
  id: uuidSchema,
  displayName: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  tags: z.array(z.string()),
  /** Messenger the client can be written to; `null` when none. */
  messenger: z.enum(messengerChannelIds).nullable(),
  visits: z.number().int(),
  noShows: z.number().int(),
  lastVisitAt: instantSchema.nullable(),
  nextVisitAt: instantSchema.nullable(),
  createdAt: instantSchema,
});

export const clientNoteSchema = z.object({
  id: uuidSchema,
  body: z.string(),
  authorName: z.string().nullable(),
  createdAt: instantSchema,
});

export const ledgerEntrySchema = z.object({
  id: uuidSchema,
  account: z.enum(ledgerAccounts),
  reason: z.enum(ledgerReasonIds),
  amount: z.number().int(),
  /** Set for money entries, whose amount is in minor units. */
  currency: z.string().nullable(),
  passName: z.string().nullable(),
  note: z.string().nullable(),
  createdAt: instantSchema,
});

export const clientPassSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  visits: z.number().int(),
  visitsLeft: z.number().int(),
  validFrom: localDateSchema,
  validUntil: localDateSchema,
  serviceNames: z.array(z.string()),
  price: moneySchema,
});

export const clientCardSchema = z.object({
  client: clientSummarySchema,
  stats: z.object({
    visits: z.number().int(),
    noShows: z.number().int(),
    cancellations: z.number().int(),
    /** Total of visits that took place. */
    spent: moneySchema,
  }),
  upcoming: z.array(cabinetBookingRowSchema),
  /** Latest past visits, newest first. */
  history: z.array(cabinetBookingRowSchema),
  notes: z.array(clientNoteSchema),
  loyalty: z.object({
    points: z.number().int(),
    passes: z.array(clientPassSchema),
    ledger: z.array(ledgerEntrySchema),
  }),
});

export const clientSorts = ['recent', 'name'] as const;

export const listClients = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/clients',
  summary: 'Clients of the business, by name, phone or tag',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  query: z.object({
    search: z.string().trim().min(2).max(80).optional(),
    tag: clientTagSchema.optional(),
    sort: z.enum(clientSorts).optional(),
    cursor: pageCursorSchema.optional(),
    limit: intParam(1, MAX_PAGE_SIZE).optional(),
  }),
  response: pageOf(clientSummarySchema),
});

export const listClientTags = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/client-tags',
  summary: 'Tags in use, most used first',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  response: z.object({ tags: z.array(z.object({ tag: z.string(), clients: z.number().int() })) }),
});

export const getClientCard = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/clients/:clientId',
  summary: 'A client’s card: visits, notes, no-shows, passes and points',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: clientParamsSchema,
  response: clientCardSchema,
});

const clientFieldsSchema = z.object({
  displayName: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  phone: phoneSchema.nullable(),
  email: z.email().max(254).nullable(),
  tags: z.array(clientTagSchema).max(clientTagLimits.maxCount),
});

export const createClient = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/clients',
  summary: 'Add a client card',
  tag: 'cabinet',
  auth: 'session',
  status: 201,
  params: cabinetParamsSchema,
  body: clientFieldsSchema,
  response: clientCardSchema,
});

export const updateClient = defineRoute({
  method: 'PATCH',
  path: '/v1/cabinet/businesses/:businessId/clients/:clientId',
  summary: 'Change a client’s contacts or tags',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: clientParamsSchema,
  body: clientFieldsSchema.partial(),
  response: clientCardSchema,
});

export const addClientNote = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/clients/:clientId/notes',
  summary: 'Add a note to a client’s card',
  tag: 'cabinet',
  auth: 'session',
  status: 201,
  params: clientParamsSchema,
  body: z.object({ body: z.string().trim().min(1).max(MAX_NOTE_LENGTH) }),
  response: clientNoteSchema,
});

export const deleteClientNote = defineRoute({
  method: 'DELETE',
  path: '/v1/cabinet/businesses/:businessId/clients/:clientId/notes/:noteId',
  summary: 'Remove a note',
  tag: 'cabinet',
  auth: 'session',
  status: 204,
  params: clientParamsSchema.extend({ noteId: uuidSchema }),
  response: null,
});

export const exportClients = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/clients/export',
  summary: 'All clients as a spreadsheet',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  query: z.object({
    format: z.enum(clientFileFormatIds),
    /** The language of the file's name and column titles; the browser follows this link itself. */
    locale: localeSchema.optional(),
  }),
  response: fileSpec(clientFileMediaTypes, MAX_IMPORT_BYTES * 4),
});

export const importClients = defineRoute({
  method: 'POST',
  path: '/v1/cabinet/businesses/:businessId/clients/import',
  summary:
    'Add or update clients from a spreadsheet; rows are matched by phone, `dryRun` only checks them',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  query: z.object({ dryRun: z.enum(['true', 'false']).transform((value) => value === 'true') }),
  upload: fileSpec(clientFileMediaTypes, MAX_IMPORT_BYTES),
  response: z.object({
    created: z.number().int(),
    updated: z.number().int(),
    /** Rows that were skipped, with the reason. */
    rejected: z.array(
      z.object({
        row: z.number().int(),
        reason: z.enum(['missing_name', 'invalid_phone', 'invalid_email', 'invalid_tags']),
      }),
    ),
    applied: z.boolean(),
  }),
});

export type ClientSummary = z.infer<typeof clientSummarySchema>;
export type ClientCard = z.infer<typeof clientCardSchema>;
export type ClientNote = z.infer<typeof clientNoteSchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type ClientPass = z.infer<typeof clientPassSchema>;
export type ClientImportResult = z.infer<typeof importClients.response>;
