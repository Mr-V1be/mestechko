import type { CabinetBookingDetails, CabinetBookingRow } from '@mestechko/contracts';
import {
  businessBookingActionIds,
  businessBookingActions,
  localDayBounds,
  Temporal,
  type BookingStatus,
  type Clock,
} from '@mestechko/domain';
import { ApplicationError, notFound } from '../../../../shared/application/application-error.js';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { BusinessAccess } from '../../../../shared/application/business-access.js';
import type { UnitOfWork } from '../../../../shared/application/unit-of-work.js';
import type { CatalogReader } from '../../../catalog/application/catalog-reader.js';
import type { LedgerStore, SettlementEntryView } from '../../../loyalty/application/ports.js';
import type { PaymentRecord } from '../../../payments/application/ports.js';
import type { Prepayments } from '../../../payments/application/prepayments.js';
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

interface DetailsExtras {
  readonly payment: PaymentRecord | null;
  readonly settlement: readonly SettlementEntryView[];
  readonly now: number;
}

function toDetails(
  view: CabinetBookingDetailsView,
  avatars: AvatarUrls,
  extras: DetailsExtras,
): CabinetBookingDetails {
  const money = (amountMinor: number) => ({ amountMinor, currency: view.currency });
  const state = { status: view.status, startsAt: view.startsAt.getTime() };
  return {
    ...toRow(view, avatars),
    version: view.version,
    hold: view.hold
      ? { reason: view.hold.reason, expiresAt: view.hold.expiresAt.toISOString() }
      : null,
    deposit: view.depositMinor > 0 ? money(view.depositMinor) : null,
    payment: extras.payment
      ? {
          status: extras.payment.status,
          amount: money(extras.payment.amountMinor),
          refunded: money(extras.payment.refundedMinor),
        }
      : null,
    settlement:
      extras.settlement.length > 0
        ? { entries: extras.settlement.map((entry) => ({ ...entry })) }
        : null,
    actions: Object.fromEntries(
      businessBookingActionIds.map((action) => [
        action,
        businessBookingActions[action].isAvailable(state, extras.now),
      ]),
    ) as CabinetBookingDetails['actions'],
    comment: view.comment,
    createdAt: view.createdAt.toISOString(),
    attendanceConfirmedAt: view.attendanceConfirmedAt?.toISOString() ?? null,
    history: view.history.map((entry) => ({
      kind: entry.kind,
      actor: entry.actor,
      channel: entry.channel,
      actorName: entry.actorName,
      at: entry.occurredAt.toISOString(),
      previousStart: entry.previousStartsAt?.toISOString() ?? null,
      previousStaffName: entry.previousStaffName,
    })),
    items: view.items.map((item) => ({
      staffId: item.staffId,
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
    private readonly prepayments: Prepayments,
    private readonly ledger: LedgerStore,
    private readonly avatars: AvatarUrls,
    private readonly clock: Clock,
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
    return this.unitOfWork.inTenant(business.id, () => this.detailsInTenant(access, bookingId), {
      readOnly: true,
    });
  }

  /** Details within the caller's tenant transaction, e.g. right after a change. */
  async detailsInTenant(access: BusinessAccess, bookingId: string): Promise<CabinetBookingDetails> {
    const view = await this.queries.details(bookingId, staffFilterOf(access));
    if (!view) {
      throw notFound('Booking');
    }
    const [payment, settlement] = await Promise.all([
      this.prepayments.ofBooking(bookingId),
      this.ledger.settlementOf(bookingId),
    ]);
    return toDetails(view, this.avatars, {
      payment,
      settlement,
      now: this.clock.now().epochMilliseconds,
    });
  }
}
