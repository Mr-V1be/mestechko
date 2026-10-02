/** What a report is built from, for a day or a whole period; sums of days add up. */
export interface PeriodFacts {
  /** Minutes staff were scheduled to work. */
  readonly workingMinutes: number;
  /** Minutes of that time taken by visits that were not cancelled. */
  readonly bookedMinutes: number;
  /** Money received net of refunds, in minor units. */
  readonly revenueMinor: number;
  /** Visits that took place. */
  readonly visits: number;
  readonly noShows: number;
  /** Visits by clients who had visited before. */
  readonly repeatVisits: number;
}

export const emptyFacts: PeriodFacts = {
  workingMinutes: 0,
  bookedMinutes: 0,
  revenueMinor: 0,
  visits: 0,
  noShows: 0,
  repeatVisits: 0,
};

export type MetricUnit = 'share' | 'money';

interface ReportMetricDefinition {
  readonly unit: MetricUnit;
  /** For shares: the part and the whole; the value is their ratio. */
  readonly parts: (facts: PeriodFacts) => { readonly part: number; readonly whole: number };
}

/**
 * Metrics of the business reports. A share is `null` when there is nothing to divide
 * by (no working time, no visits); money is the sum itself.
 */
export const reportMetrics = {
  occupancy: {
    unit: 'share',
    parts: (facts) => ({ part: facts.bookedMinutes, whole: facts.workingMinutes }),
  },
  revenue: {
    unit: 'money',
    parts: (facts) => ({ part: facts.revenueMinor, whole: 1 }),
  },
  no_shows: {
    unit: 'share',
    parts: (facts) => ({ part: facts.noShows, whole: facts.visits + facts.noShows }),
  },
  repeat_visits: {
    unit: 'share',
    parts: (facts) => ({ part: facts.repeatVisits, whole: facts.visits }),
  },
} as const satisfies Record<string, ReportMetricDefinition>;

export type ReportMetric = keyof typeof reportMetrics;

export const reportMetricIds = Object.keys(reportMetrics) as ReportMetric[];

export function addFacts(a: PeriodFacts, b: PeriodFacts): PeriodFacts {
  return {
    workingMinutes: a.workingMinutes + b.workingMinutes,
    bookedMinutes: a.bookedMinutes + b.bookedMinutes,
    revenueMinor: a.revenueMinor + b.revenueMinor,
    visits: a.visits + b.visits,
    noShows: a.noShows + b.noShows,
    repeatVisits: a.repeatVisits + b.repeatVisits,
  };
}

export function metricValue(metric: ReportMetric, facts: PeriodFacts): number | null {
  const definition: ReportMetricDefinition = reportMetrics[metric];
  const { part, whole } = definition.parts(facts);
  if (definition.unit === 'money') {
    return part;
  }
  return whole > 0 ? Math.min(1, part / whole) : null;
}
