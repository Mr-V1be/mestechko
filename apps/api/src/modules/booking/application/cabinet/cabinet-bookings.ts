import type { CabinetBookingDetails, CabinetBookingRow } from '@mestechko/contracts';
import { localDayBounds, Temporal, type BookingStatus } from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../../shared/application/application-error.js';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { BusinessAccess } from '../../../../shared/application/business-access.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type { CatalogReader } from '../../../catalog/application/catalog-reader.js';
import type { BusinessContextResolver } from '../../../tenancy/application/business-context.js';
import type {
  CabinetBookingDetailsView,
  CabinetBookingQueries,
  CabinetBookingView,
} from './ports.js';
import { staffFilterOf } from './staff-scope.js';

const DEFAULT_PAGE_SIZE = 50;
const MAX_LIST_DAYS = 92;

export interface CabinetBookingListQuery {
  readonly from: string;
  readonly to: string;
  readonly status: BookingStatus | null;
  readonly staffId: string | null;
  readonly locationId: string | null;
  readonly search: string | null;
  readonly cursor: string | null;
  readonly limit: number | null;
}

function toRow(view: CabinetBookingView, avatars: AvatarUrls): CabinetBookingRow {
  return {
    id: view.id,
    status: view.status,
    source: view.source,
    start: view.startsAt.toISOString(),
    end: view.endsAt.toISOString(),
    timeZone: view.timeZone,
    client: view.client,
    staff: {
      id: view.staff.id,
      displayName: view.staff.displayName,
      title: view.staff.title,
      avatarUrl: avatars.forSeed(view.staff.avatarSeed),
    },
    location: view.location,
    services: [...view.services],
    total: { amountMinor: view.totalPriceMinor, currency: view.currency },
  };
}

function toDetails(view: CabinetBookingDetailsView, avatars: AvatarUrls): CabinetBookingDetails {
  return {
    ...toRow(view, avatars),
    comment: view.comment,
    createdAt: view.createdAt.toISOString(),
    attendanceConfirmedAt: view.attendanceConfirmedAt?.toISOString() ?? null,
    history: view.history.map((entry) => ({
      kind: entry.kind,
      actor: entry.actor,
      channel: entry.channel,
      at: entry.occurredAt.toISOString(),
      previousStart: entry.previousStartsAt?.toISOString() ?? null,
    })),
    items: view.items.map((item) => ({
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      start: item.startsAt.toISOString(),
      end: item.endsAt.toISOString(),
      price: { amountMinor: item.priceMinor, currency: view.currency },
      resourceName: item.resourceName,
    })),
  };
}

/** Bookings list of the cabinet with filters and keyset pagination. */
export class CabinetBookings {
  constructor(
    private readonly businesses: BusinessContextResolver,
    private readonly unitOfWork: UnitOfWork,
    private readonly catalog: CatalogReader,
    private readonly queries: CabinetBookingQueries,
    private readonly avatars: AvatarUrls,
  ) {}

  async list(
    access: BusinessAccess,
    query: CabinetBookingListQuery,
  ): Promise<{ items: CabinetBookingRow[]; nextCursor: string | null }> {
    const { business } = await this.businesses.byId(access.businessId);
    const ownStaffId = staffFilterOf(access);
    const from = Temporal.PlainDate.from(query.from);
    const to = Temporal.PlainDate.from(query.to);
    const days = from.until(to, { largestUnit: 'days' }).days;
    if (days < 0 || days >= MAX_LIST_DAYS) {
      throw new ApplicationError('validation_failed', 'Invalid period');
    }
    return this.unitOfWork.inTenant(
      business.id,
      async () => {
        const locations = await this.catalog.listLocations();
        const zoneLocation =
          locations.find((location) => location.id === query.locationId) ?? locations[0];
        if (!zoneLocation) {
          return { items: [], nextCursor: null };
        }
        // Periods are local dates of the business; its main location defines the zone.
        const page = await this.queries.list(
          {
            from: new Date(localDayBounds(from, zoneLocation.timeZone).start),
            to: new Date(localDayBounds(to, zoneLocation.timeZone).end),
            status: query.status,
            staffId: ownStaffId ?? query.staffId,
            locationId: query.locationId,
            search: query.search,
          },
          { cursor: query.cursor, limit: query.limit ?? DEFAULT_PAGE_SIZE },
        );
        return {
          items: page.items.map((view) => toRow(view, this.avatars)),
          nextCursor: page.nextCursor,
        };
      },
      { readOnly: true },
    );
  }

  async details(access: BusinessAccess, bookingId: string): Promise<CabinetBookingDetails> {
    const { business } = await this.businesses.byId(access.businessId);
    const ownStaffId = staffFilterOf(access);
    const view = await this.unitOfWork.inTenant(
      business.id,
      () => this.queries.details(bookingId, ownStaffId),
      {
        readOnly: true,
      },
    );
    if (!view) {
      throw notFound('Booking');
    }
    return toDetails(view, this.avatars);
  }
}
