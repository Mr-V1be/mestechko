import { reportMetricIds } from '@slotwise/domain';
import { z } from 'zod';
import { currencySchema, localDateSchema, uuidSchema } from '../../primitives.js';
import { defineRoute } from '../../route.js';
import { cabinetParamsSchema } from './schedule.js';

/** Facts of a day or a period; metrics are computed from them. */
export const reportFactsSchema = z.object({
  workingMinutes: z.number().int(),
  bookedMinutes: z.number().int(),
  revenueMinor: z.number().int(),
  visits: z.number().int(),
  noShows: z.number().int(),
  repeatVisits: z.number().int(),
});

export const getBusinessReport = defineRoute({
  method: 'GET',
  path: '/v1/cabinet/businesses/:businessId/reports',
  summary: 'Occupancy, revenue, no-shows and repeat visits per day of a period',
  tag: 'cabinet',
  auth: 'session',
  status: 200,
  params: cabinetParamsSchema,
  query: z.object({
    from: localDateSchema,
    to: localDateSchema,
    locationId: uuidSchema.optional(),
    staffId: uuidSchema.optional(),
  }),
  response: z.object({
    currency: currencySchema,
    metrics: z.array(z.enum(reportMetricIds)),
    total: reportFactsSchema,
    /** The same length of time just before, for comparison. */
    previous: reportFactsSchema,
    /** Metrics the earlier period is a fair comparison for; the rest show no change. */
    comparable: z.array(z.enum(reportMetricIds)),
    days: z.array(reportFactsSchema.extend({ date: localDateSchema })),
    staff: z.array(reportFactsSchema.extend({ staffId: uuidSchema, displayName: z.string() })),
  }),
});

export type ReportFacts = z.infer<typeof reportFactsSchema>;
export type BusinessReport = z.infer<typeof getBusinessReport.response>;
