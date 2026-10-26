import type { BusinessReport, ReportFacts } from '@slotwise/contracts';
import {
  addFacts,
  comparableMetrics,
  datesBetween,
  emptyFacts,
  localDayBounds,
  reportMetricIds,
  resolveStaffDay,
  Temporal,
  workingIntervals,
  type CalendarContext,
  type PeriodFacts,
  type PlainDate,
  type StaffWorkCalendar,
} from '@slotwise/domain';
import { ApplicationError, notFound } from '../../../shared/application/application-error.js';
import type { CatalogReader, LocationView } from '../../catalog/application/catalog-reader.js';
import type { WorkCalendarReader } from '../../scheduling/application/ports.js';
import type { ProductionCalendars } from '../../scheduling/application/production-calendars.js';
import type { BusinessContext } from '../../tenancy/application/business-context.js';
import type { ReportFactsSource, ReportFilter } from './ports.js';

const MAX_REPORT_DAYS = 366;

export interface ReportQuery {
  readonly from: string;
  readonly to: string;
  readonly locationId: string | null;
  readonly staffId: string | null;
}

interface PeriodBreakdown {
  readonly byDay: Map<string, PeriodFacts>;
  readonly byStaff: Map<string, PeriodFacts>;
}

const add = (map: Map<string, PeriodFacts>, key: string, facts: Partial<PeriodFacts>) => {
  map.set(key, addFacts(map.get(key) ?? emptyFacts, { ...emptyFacts, ...facts }));
};

const total = (facts: Iterable<PeriodFacts>) => [...facts].reduce(addFacts, emptyFacts);

const view = (facts: PeriodFacts): ReportFacts => ({ ...facts });

/**
 * Occupancy, revenue, no-shows and repeat visits of a period, per day and per staff
 * member, with the same length of time before it for comparison — for the metrics the
 * records support (see `comparableMetrics`). Working time comes from the schedules, the
 * rest from the reporting read model. Runs inside the caller's tenant unit of work.
 */
export class BusinessReports {
  constructor(
    private readonly source: ReportFactsSource,
    private readonly catalog: CatalogReader,
    private readonly workCalendars: WorkCalendarReader,
    private readonly calendars: ProductionCalendars,
  ) {}

  async report(context: BusinessContext, query: ReportQuery): Promise<BusinessReport> {
    const from = Temporal.PlainDate.from(query.from);
    const to = Temporal.PlainDate.from(query.to);
    const days = from.until(to, { largestUnit: 'days' }).days + 1;
    if (days < 1 || days > MAX_REPORT_DAYS) {
      throw new ApplicationError('validation_failed', 'A report covers 1 to 366 days');
    }
    const locations = await this.locationsOf(query.locationId);
    const staff = (await this.catalog.listStaff()).filter(
      (member) => query.staffId === null || member.id === query.staffId,
    );
    const filter: ReportFilter = { locationId: query.locationId, staffId: query.staffId };
    const previousTo = from.subtract({ days: 1 });
    const previousFrom = previousTo.subtract({ days: days - 1 });
    const timeZone = locations[0]?.timeZone ?? (await this.catalog.homeTimeZone());
    const [current, previous, firstRecord] = await Promise.all([
      this.breakdown(context, { from, to }, locations, staff, filter),
      this.breakdown(context, { from: previousFrom, to: previousTo }, locations, staff, filter),
      this.source.firstRecord(timeZone),
    ]);
    return {
      currency: context.business.currency,
      metrics: reportMetricIds,
      total: view(total(current.byDay.values())),
      previous: view(total(previous.byDay.values())),
      comparable: comparableMetrics({
        firstRecord: firstRecord === null ? null : Temporal.PlainDate.from(firstRecord),
        previousFrom,
        days,
      }),
      days: datesBetween(from, to).map((date) => ({
        date: date.toString(),
        ...view(current.byDay.get(date.toString()) ?? emptyFacts),
      })),
      staff: staff.map((member) => ({
        staffId: member.id,
        displayName: member.displayName,
        ...view(current.byStaff.get(member.id) ?? emptyFacts),
      })),
    };
  }

  private async breakdown(
    context: BusinessContext,
    range: { readonly from: PlainDate; readonly to: PlainDate },
    locations: readonly LocationView[],
    staff: readonly { readonly id: string }[],
    filter: ReportFilter,
  ): Promise<PeriodBreakdown> {
    const timeZone = locations[0]?.timeZone ?? (await this.catalog.homeTimeZone());
    const window = {
      start: new Date(localDayBounds(range.from, timeZone).start),
      end: new Date(localDayBounds(range.to, timeZone).end),
      timeZone,
    };
    const [visits, revenue, working] = await Promise.all([
      this.source.visits(window, filter),
      this.source.revenue(window, filter),
      this.workingMinutes(context, range, locations, staff),
    ]);
    const byDay = new Map<string, PeriodFacts>();
    const byStaff = new Map<string, PeriodFacts>();
    for (const entry of working) {
      add(byDay, entry.date, { workingMinutes: entry.minutes });
      add(byStaff, entry.staffId, { workingMinutes: entry.minutes });
    }
    for (const fact of visits) {
      const { date, staffId, ...facts } = fact;
      add(byDay, date, facts);
      add(byStaff, staffId, facts);
    }
    for (const money of revenue) {
      add(byDay, money.date, { revenueMinor: money.amountMinor });
      if (money.staffId) {
        add(byStaff, money.staffId, { revenueMinor: money.amountMinor });
      }
    }
    return { byDay, byStaff };
  }

  /** Scheduled minutes of each staff member per day across the reported locations. */
  private async workingMinutes(
    context: BusinessContext,
    range: { readonly from: PlainDate; readonly to: PlainDate },
    locations: readonly LocationView[],
    staff: readonly { readonly id: string }[],
  ): Promise<{ date: string; staffId: string; minutes: number }[]> {
    const dates = datesBetween(range.from, range.to);
    const calendars = await this.workCalendars.forStaff(
      staff.map((member) => member.id),
      range,
    );
    const calendarContext: CalendarContext = {
      calendar: await this.calendars.calendarFor(context.business.countryCode, [
        ...new Set(dates.map((date) => date.year)),
      ]),
      policy: context.rules.calendarPolicy,
    };
    return staff.flatMap((member) => {
      const calendar: StaffWorkCalendar = calendars.get(member.id) ?? {
        assignments: [],
        overrides: [],
        absences: [],
      };
      return dates.map((date) => ({
        date: date.toString(),
        staffId: member.id,
        minutes: locations.reduce((sum, location) => {
          const day = resolveStaffDay(calendar, date, location.id, calendarContext);
          return (
            sum +
            (day
              ? workingIntervals(day).reduce(
                  (minutes, interval) => minutes + interval.end - interval.start,
                  0,
                )
              : 0)
          );
        }, 0),
      }));
    });
  }

  private async locationsOf(locationId: string | null): Promise<LocationView[]> {
    if (locationId === null) {
      return this.catalog.listLocations();
    }
    const location = await this.catalog.findLocation(locationId);
    if (!location) {
      throw notFound('Location');
    }
    return [location];
  }
}
