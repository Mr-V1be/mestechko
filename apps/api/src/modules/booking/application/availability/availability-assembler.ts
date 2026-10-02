import {
  assertCompatible,
  BusyIndex,
  localDayBounds,
  type AvailabilityRequest,
  type BookingRules,
  type Temporal,
  type PlainDate,
  type ServiceSpec,
} from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../../shared/application/application-error.js';
import type {
  CatalogReader,
  LocationView,
  ServiceView,
  StaffServiceTerms,
  StaffView,
} from '../../../catalog/application/catalog-reader.js';
import type { WorkCalendarReader } from '../../../scheduling/application/ports.js';
import type { ProductionCalendars } from '../../../scheduling/application/production-calendars.js';
import type { BusinessContext } from '../../../tenancy/application/business-context.js';
import type { OccupancyReader } from '../ports.js';

const MS_PER_DAY = 86_400_000;
/** Longest range one availability request may cover. */
export const MAX_AVAILABILITY_DAYS = 31;

export interface AvailabilityScope {
  readonly context: BusinessContext;
  readonly locationId: string;
  readonly serviceIds: readonly string[];
  /** A specific staff member, or `null` for anyone qualified. */
  readonly staffId: string | null;
  readonly from: PlainDate;
  readonly to: PlainDate;
  readonly now: Temporal.Instant;
  /** A booking being rescheduled: its own time does not count as taken. */
  readonly excludeBookingId?: string;
  /** Rules to plan by; the business's online rules unless the front desk books. */
  readonly rules?: BookingRules;
}

export interface AssembledAvailability {
  readonly request: AvailabilityRequest;
  readonly location: LocationView;
  readonly services: readonly ServiceView[];
  readonly staff: readonly StaffView[];
  readonly terms: readonly StaffServiceTerms[];
}

function toServiceSpec(service: ServiceView): ServiceSpec {
  return {
    id: service.id,
    durationMinutes: service.durationMinutes,
    bufferBeforeMinutes: service.bufferBeforeMinutes,
    bufferAfterMinutes: service.bufferAfterMinutes,
    resourceTypeId: service.resourceTypeId,
  };
}

/**
 * Collects everything the availability engine needs from the tenant's data.
 * Must run inside a tenant unit of work.
 */
export class AvailabilityAssembler {
  constructor(
    private readonly catalog: CatalogReader,
    private readonly workCalendars: WorkCalendarReader,
    private readonly productionCalendars: ProductionCalendars,
    private readonly occupancies: OccupancyReader,
  ) {}

  async assemble(scope: AvailabilityScope): Promise<AssembledAvailability> {
    const days = scope.from.until(scope.to, { largestUnit: 'days' }).days;
    if (days < 0 || days >= MAX_AVAILABILITY_DAYS) {
      throw new ApplicationError(
        'validation_failed',
        `A range covers 1 to ${String(MAX_AVAILABILITY_DAYS)} days`,
      );
    }
    const location = await this.catalog.findLocation(scope.locationId);
    if (!location) {
      throw notFound('Location');
    }
    const services = await this.catalog.listServices(scope.serviceIds);
    if (services.length !== new Set(scope.serviceIds).size) {
      throw notFound('Service');
    }
    assertCompatible(scope.serviceIds, await this.catalog.listIncompatibilities(scope.serviceIds));
    const window = { from: scope.from, to: scope.to };
    const terms = await this.catalog.listStaffTerms(scope.serviceIds);
    const assigned = await this.workCalendars.staffAssignedTo(location.id, window);
    const qualified = [...new Set(terms.map((term) => term.staffId))].filter(
      (staffId) =>
        assigned.has(staffId) &&
        (scope.staffId === null || scope.staffId === staffId) &&
        services.every((service) =>
          terms.some((term) => term.staffId === staffId && term.serviceId === service.id),
        ),
    );
    const [staff, calendars, resources] = await Promise.all([
      this.catalog.listStaff(qualified),
      this.workCalendars.forStaff(qualified, window),
      this.catalog.listResources(location.id),
    ]);
    const occupancyWindow = {
      start: localDayBounds(scope.from, location.timeZone).start - MS_PER_DAY,
      end: localDayBounds(scope.to, location.timeZone).end + MS_PER_DAY,
    };
    const busy = await this.occupancies.load(
      staff.map((member) => member.id),
      resources.map((resource) => resource.id),
      occupancyWindow,
      scope.excludeBookingId ?? null,
    );
    const years = [...new Set([scope.from.year, scope.to.year])];
    const calendar = await this.productionCalendars.calendarFor(
      scope.context.business.countryCode,
      years,
    );

    const request: AvailabilityRequest = {
      location: { id: location.id, timeZone: location.timeZone },
      from: scope.from,
      to: scope.to,
      services: services.map(toServiceSpec),
      staff: staff.map((member) => ({
        id: member.id,
        rank: member.rank,
        workCalendar: calendars.get(member.id) ?? { assignments: [], overrides: [], absences: [] },
        serviceTerms: new Map(
          terms
            .filter((term) => term.staffId === member.id)
            .map((term) => [term.serviceId, { durationMinutes: term.durationMinutes }]),
        ),
      })),
      resources: resources.map((resource) => ({ id: resource.id, typeId: resource.typeId })),
      busy: BusyIndex.from(busy),
      calendar,
      rules: scope.rules ?? scope.context.rules,
      now: scope.now,
    };
    return { request, location, services, staff, terms };
  }
}
