/** A period split into the local days of a time zone. */
export interface ReportWindow {
  readonly start: Date;
  readonly end: Date;
  readonly timeZone: string;
}

export interface ReportFilter {
  readonly locationId: string | null;
  readonly staffId: string | null;
}

/** What happened on one local day with one staff member. */
export interface DailyVisitFacts {
  readonly date: string;
  readonly staffId: string;
  readonly bookedMinutes: number;
  readonly visits: number;
  readonly noShows: number;
  readonly repeatVisits: number;
}

export interface DailyRevenue {
  readonly date: string;
  /** Staff member of the visits the money was paid for; `null` for pass sales. */
  readonly staffId: string | null;
  readonly amountMinor: number;
}

/**
 * The reporting read model: aggregates over bookings and the money ledger of the
 * current tenant. Read-only, so it may join what the modules keep separately.
 */
export interface ReportFactsSource {
  visits(window: ReportWindow, filter: ReportFilter): Promise<DailyVisitFacts[]>;
  revenue(window: ReportWindow, filter: ReportFilter): Promise<DailyRevenue[]>;
}

export const REPORT_FACTS_SOURCE = Symbol('REPORT_FACTS_SOURCE');
