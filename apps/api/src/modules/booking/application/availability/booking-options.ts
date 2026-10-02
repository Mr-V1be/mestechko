import type {
  AvailableDay,
  BookingQuoteView,
  ServiceCategory,
  StaffOption,
} from '@mestechko/contracts';
import {
  earliestSlotByStaff,
  findAvailability,
  localDateOf,
  planBookingOptions,
  priceRange,
  quoteBooking,
  Temporal,
  type Clock,
  type CurrencyCode,
  type Money,
} from '@mestechko/domain';
import { notFound } from '../../../../shared/application/application-error.js';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type {
  CatalogReader,
  ServiceView,
  StaffServiceTerms,
} from '../../../catalog/application/catalog-reader.js';
import type { WorkCalendarReader } from '../../../scheduling/application/ports.js';
import type { BusinessContextResolver } from '../../../tenancy/application/business-context.js';
import type { AssembledAvailability, AvailabilityAssembler } from './availability-assembler.js';
import { pricePlans } from './plan-pricing.js';

/** How far ahead the staff step looks for each person's nearest free time. */
const NEAREST_SLOT_LOOKAHEAD_DAYS = 14;

const toIso = (epoch: number): string => new Date(epoch).toISOString();

/** Free starts per day in the location's time zone, as clients receive them. */
export function availableDaysOf(assembled: AssembledAvailability): {
  timeZone: string;
  days: AvailableDay[];
} {
  return {
    timeZone: assembled.location.timeZone,
    days: findAvailability(assembled.request).map((day) => ({
      date: day.date.toString(),
      slots: day.slots.map((slot) => ({ start: toIso(slot.start) })),
    })),
  };
}

function priceOf(
  service: ServiceView,
  terms: readonly StaffServiceTerms[],
  currency: CurrencyCode,
) {
  const prices = terms
    .filter((term) => term.serviceId === service.id)
    .map((term) => term.priceMinor ?? service.priceMinor);
  const lowest = prices.length > 0 ? Math.min(...prices) : service.priceMinor;
  return {
    price: { amountMinor: lowest, currency },
    priceVaries: prices.some((price) => price !== lowest),
  };
}

/** What a client can book: services, staff with nearest free time, and free slots. */
export class BookingOptions {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly catalog: CatalogReader,
    private readonly workCalendars: WorkCalendarReader,
    private readonly assembler: AvailabilityAssembler,
    private readonly avatars: AvatarUrls,
    private readonly clock: Clock,
  ) {}

  async services(slug: string, locationId: string): Promise<ServiceCategory[]> {
    const context = await this.businesses.bySlug(slug);
    const { business, rules } = context;
    return this.unitOfWork.inTenant(
      business.id,
      async () => {
        const location = await this.catalog.findLocation(locationId);
        if (!location) {
          return [];
        }
        const today = localDateOf(this.clock.now().epochMilliseconds, location.timeZone);
        const window = { from: today, to: today.add({ days: rules.horizonDays }) };
        const [services, assigned, resources] = await Promise.all([
          this.catalog.listServices(),
          this.workCalendars.staffAssignedTo(location.id, window),
          this.catalog.listResources(location.id),
        ]);
        const terms = (
          await this.catalog.listStaffTerms(services.map((service) => service.id))
        ).filter((term) => assigned.has(term.staffId));
        const resourceTypes = new Set(resources.map((resource) => resource.typeId));
        const bookable = services.filter(
          (service) =>
            terms.some((term) => term.serviceId === service.id) &&
            (service.resourceTypeId === null || resourceTypes.has(service.resourceTypeId)),
        );
        const categories = new Map<string, ServiceCategory>();
        for (const service of bookable) {
          const category = categories.get(service.categoryId) ?? {
            id: service.categoryId,
            name: service.categoryName,
            services: [],
          };
          category.services.push({
            id: service.id,
            name: service.name,
            description: service.description,
            durationMinutes: service.durationMinutes,
            ...priceOf(service, terms, business.currency),
            providerIds: terms
              .filter((term) => term.serviceId === service.id)
              .map((term) => term.staffId),
          });
          categories.set(service.categoryId, category);
        }
        return [...categories.values()];
      },
      { readOnly: true },
    );
  }

  async staff(
    slug: string,
    locationId: string,
    serviceIds: readonly string[],
  ): Promise<{ anyNextSlot: string | null; staff: StaffOption[] }> {
    const context = await this.businesses.bySlug(slug);
    return this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const now = this.clock.now();
        const location = await this.catalog.findLocation(locationId);
        if (!location) {
          throw notFound('Location');
        }
        const today = localDateOf(now.epochMilliseconds, location.timeZone);
        const lookahead = Math.min(NEAREST_SLOT_LOOKAHEAD_DAYS, context.rules.horizonDays);
        const assembled = await this.assembler.assemble({
          context,
          locationId,
          serviceIds,
          staffId: null,
          from: today,
          to: today.add({ days: lookahead }),
          now,
        });
        const earliest = earliestSlotByStaff(assembled.request);
        const nextSlots = [...earliest.values()];
        return {
          anyNextSlot: nextSlots.length > 0 ? toIso(Math.min(...nextSlots)) : null,
          staff: assembled.staff.map((member) => {
            const next = earliest.get(member.id);
            return {
              id: member.id,
              displayName: member.displayName,
              title: member.title,
              avatarUrl: this.avatars.forSeed(member.avatarSeed),
              nextSlot: next === undefined ? null : toIso(next),
              total: this.totalFor(
                member.id,
                assembled.services,
                assembled.terms,
                context.business.currency,
              ),
            };
          }),
        };
      },
      { readOnly: true },
    );
  }

  async availability(
    slug: string,
    query: {
      readonly locationId: string;
      readonly serviceIds: readonly string[];
      readonly staffId: string | null;
      readonly from: string;
      readonly to: string;
    },
  ): Promise<{ timeZone: string; days: AvailableDay[] }> {
    const context = await this.businesses.bySlug(slug);
    return this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const assembled = await this.assembler.assemble({
          context,
          locationId: query.locationId,
          serviceIds: query.serviceIds,
          staffId: query.staffId,
          from: Temporal.PlainDate.from(query.from),
          to: Temporal.PlainDate.from(query.to),
          now: this.clock.now(),
        });
        return availableDaysOf(assembled);
      },
      { readOnly: true },
    );
  }

  /** Who would be booked at the start and the exact price, before the client confirms. */
  async quote(
    slug: string,
    query: {
      readonly locationId: string;
      readonly serviceIds: readonly string[];
      readonly staffId: string | null;
      readonly start: string;
    },
  ): Promise<BookingQuoteView> {
    const context = await this.businesses.bySlug(slug);
    return this.unitOfWork.inTenant(
      context.business.id,
      async () => {
        const location = await this.catalog.findLocation(query.locationId);
        if (!location) {
          throw notFound('Location');
        }
        const start = Date.parse(query.start);
        const date = localDateOf(start, location.timeZone);
        const assembled = await this.assembler.assemble({
          context,
          locationId: location.id,
          serviceIds: query.serviceIds,
          staffId: query.staffId,
          from: date,
          to: date,
          now: this.clock.now(),
        });
        const priced = pricePlans(
          planBookingOptions(assembled.request, start),
          assembled,
          context.business.currency,
        );
        const first = priced[0];
        const staff = first
          ? assembled.staff.find((member) => member.id === first.plan.staffId)
          : undefined;
        return {
          available: first !== undefined,
          assigned:
            first && staff
              ? {
                  staff: {
                    id: staff.id,
                    displayName: staff.displayName,
                    title: staff.title,
                    avatarUrl: this.avatars.forSeed(staff.avatarSeed),
                  },
                  total: first.total,
                  end: toIso(first.plan.end),
                }
              : null,
          priceRange: priceRange(priced.map((option) => option.total)),
          assignmentRule: query.staffId === null ? context.rules.staffAssignment : null,
        };
      },
      { readOnly: true },
    );
  }

  private totalFor(
    staffId: string,
    services: readonly ServiceView[],
    terms: readonly StaffServiceTerms[],
    currency: CurrencyCode,
  ): Money {
    return quoteBooking(
      services.map((service) => ({
        serviceId: service.id,
        basePriceMinor: service.priceMinor,
        staffPriceMinor:
          terms.find((term) => term.staffId === staffId && term.serviceId === service.id)
            ?.priceMinor ?? null,
      })),
      currency,
    ).total;
  }
}
