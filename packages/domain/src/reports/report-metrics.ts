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

/** Which way a change is an improvement: more occupancy is welcome, more no-shows are not. */
export type MetricImprovement = 'higher' | 'lower';

interface ReportMetricDefinition {
  readonly unit: MetricUnit;
  readonly better: MetricImprovement;
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
    better: 'higher',
    parts: (facts) => ({ part: facts.bookedMinutes, whole: facts.workingMinutes }),
  },
  revenue: {
    unit: 'money',
    better: 'higher',
    parts: (facts) => ({ part: facts.revenueMinor, whole: 1 }),
  },
  no_shows: {
    unit: 'share',
    better: 'lower',
    parts: (facts) => ({ part: facts.noShows, whole: facts.visits + facts.noShows }),
  },
  repeat_visits: {
    unit: 'share',
    better: 'higher',
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

/**
 * How a metric moved against an earlier period: shares in points of the whole
 * (0.02 is two percentage points), money relative to before (0.08 is eight percent).
 */
export interface MetricChange {
  readonly measure: 'points' | 'relative';
  readonly amount: number;
  /** `null` while nothing moved. */
  readonly improved: boolean | null;
}

/** `null` when one of the periods has no value or money has nothing to compare with. */
export function metricChange(
  metric: ReportMetric,
  current: PeriodFacts,
  previous: PeriodFacts,
): MetricChange | null {
  const definition: ReportMetricDefinition = reportMetrics[metric];
  const now = metricValue(metric, current);
  const before = metricValue(metric, previous);
  if (now === null || before === null) {
    return null;
  }
  if (definition.unit === 'money' && before === 0) {
    return null;
  }
  const amount = definition.unit === 'money' ? (now - before) / before : now - before;
  return {
    measure: definition.unit === 'money' ? 'relative' : 'points',
    amount,
    improved: amount === 0 ? null : amount > 0 === (definition.better === 'higher'),
  };
}
