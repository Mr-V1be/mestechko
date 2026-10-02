import type { getSchedule, RouteResult, ScheduleAxis } from '@mestechko/contracts';
import {
  datesBetween,
  localDayBounds,
  resolveStaffDay,
  Temporal,
  wallIntervalToInstants,
  workingIntervals,
  type InstantInterval,
  type PlainDate,
  type ProductionCalendar,
  type StaffWorkCalendar,
} from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../../shared/application/application-error.js';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type { BusinessAccess } from '../../../../shared/application/business-access.js';
import type { CatalogReader, LocationView } from '../../../catalog/application/catalog-reader.js';
import type { WorkCalendarReader } from '../../../scheduling/application/ports.js';
import type { ProductionCalendars } from '../../../scheduling/application/production-calendars.js';
import type {
  BusinessContext,
  BusinessContextResolver,
} from '../../../tenancy/application/business-context.js';
import { MAX_AVAILABILITY_DAYS } from '../availability/availability-assembler.js';
import type { CabinetBookingQueries } from './ports.js';
import { scheduleAxisStrategies, type DayHours } from './schedule-axes.js';
import { staffFilterOf } from './staff-scope.js';

type Schedule = RouteResult<typeof getSchedule>;

export interface ScheduleQuery {
  readonly locationId: string;
  readonly from: string;
  readonly to: string;
  readonly axis: ScheduleAxis;
}

/** Day or week of a location per staff member or resource, with working hours shaded. */
export class ScheduleView {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly catalog: CatalogReader,
    private readonly workCalendars: WorkCalendarReader,
    private readonly productionCalendars: ProductionCalendars,
    private readonly queries: CabinetBookingQueries,
    private readonly avatars: AvatarUrls,
  ) {}

  async execute(access: BusinessAccess, query: ScheduleQuery): Promise<Schedule> {
    const context = await this.businesses.byId(access.businessId);
    const ownStaffId = staffFilterOf(access);
    const from = Temporal.PlainDate.from(query.from);
    const to = Temporal.PlainDate.from(query.to);
    const days = from.until(to, { largestUnit: 'days' }).days;
    if (days < 0 || days >= MAX_AVAILABILITY_DAYS) {
      throw new ApplicationError('validation_failed', 'Invalid schedule range');
    }
    return this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const location = await this.catalog.findLocation(query.locationId);
        if (!location) {
          throw notFound('Location');
        }
        const window: InstantInterval = {
          start: localDayBounds(from, location.timeZone).start,
          end: localDayBounds(to, location.timeZone).end,
        };
        const [assigned, items, resources] = await Promise.all([
          this.workCalendars.staffAssignedTo(location.id, { from, to }),
          this.queries.scheduleItems(location.id, window, ownStaffId),
          this.catalog.listResources(location.id),
        ]);
        const staffIds = ownStaffId
          ? [ownStaffId]
          : [...new Set([...assigned, ...items.map((item) => item.staffId)])];
        const staff = await this.catalog.listStaff(staffIds);
        const staffHours = await this.staffHours(
          context,
          location,
          staff.map((member) => member.id),
          from,
          to,
        );
        const layout = scheduleAxisStrategies[query.axis].layout({
          staff,
          resources,
          staffHours,
          items,
          avatars: this.avatars,
          resourceTerm: (resource) =>
            context.vertical.resourceTypes.find((type) => type.id === resource.typeId)?.term ??
            resource.typeId,
        });
        return {
          timeZone: location.timeZone,
          columns: layout.columns,
          workingHours: layout.workingHours.map((entry) => ({
            columnId: entry.columnId,
            date: entry.date,
            intervals: entry.intervals.map((interval) => ({
              start: new Date(interval.start).toISOString(),
              end: new Date(interval.end).toISOString(),
            })),
          })),
          bookings: layout.bookings,
        };
      },
      { readOnly: true },
    );
  }

  private async staffHours(
    context: BusinessContext,
    location: LocationView,
    staffIds: readonly string[],
    from: PlainDate,
    to: PlainDate,
  ): Promise<Map<string, DayHours[]>> {
    const calendars = await this.workCalendars.forStaff(staffIds, { from, to });
    const years = [...new Set([from.year, to.year])];
    const calendar = await this.productionCalendars.calendarFor(
      context.business.countryCode,
      years,
    );
    const dates = datesBetween(from, to);
    return new Map(
      staffIds.map((staffId) => [
        staffId,
        dates.map((date) => ({
          date: date.toString(),
          intervals: this.workingTime(calendars.get(staffId), date, location, context, calendar),
        })),
      ]),
    );
  }

  private workingTime(
    workCalendar: StaffWorkCalendar | undefined,
    date: PlainDate,
    location: LocationView,
    context: BusinessContext,
    calendar: ProductionCalendar,
  ): InstantInterval[] {
    const template = workCalendar
      ? resolveStaffDay(workCalendar, date, location.id, {
          calendar,
          policy: context.rules.calendarPolicy,
        })
      : null;
    if (!template) {
      return [];
    }
    return workingIntervals(template)
      .map((interval) => wallIntervalToInstants(date, interval, location.timeZone))
      .filter((interval): interval is InstantInterval => interval !== null);
  }
}
