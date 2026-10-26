import {
  openBookingStatuses,
  timeOccupyingStatuses,
  type HoldReason,
  type InstantInterval,
} from '@slotwise/domain';
import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { currencyCode } from '../../../platform/db/column-parsers.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  CabinetBookingDetailsView,
  CabinetBookingFilter,
  CabinetBookingQueries,
  CabinetBookingView,
  ClientVisitStats,
  ScheduleItemView,
} from '../application/cabinet/ports.js';
import type { BookingHold, Page } from '../application/ports.js';
import { decodeCursor, encodeCursor } from './cursor.js';

const LIKE_SPECIALS = /[\\%_]/g;
const MIN_PHONE_DIGITS = 3;

function holdOf(reason: HoldReason | null, expiresAt: Date | null): BookingHold | null {
  return reason && expiresAt ? { reason, expiresAt } : null;
}

function containsPattern(search: string): string {
  return `%${search.replace(LIKE_SPECIALS, (match) => `\\${match}`)}%`;
}

export class KyselyCabinetBookingQueries implements CabinetBookingQueries {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async scheduleItems(
    locationId: string,
    window: InstantInterval,
    staffId: string | null,
  ): Promise<ScheduleItemView[]> {
    const range = sql`tstzrange(${new Date(window.start)}, ${new Date(window.end)}, '[)')`;
    let query = this.unitOfWork
      .tenant()
      .selectFrom('bookingItems as i')
      .innerJoin('bookings as b', 'b.id', 'i.bookingId')
      .innerJoin('clients as c', 'c.id', 'b.clientId')
      .innerJoin('staffMembers as s', 's.id', 'i.staffId')
      .select([
        'i.bookingId',
        'b.version',
        'i.status',
        'b.holdReason',
        'b.holdExpiresAt',
        'i.staffId',
        's.displayName as staffName',
        'i.resourceId',
        'i.serviceName',
        'c.displayName as clientName',
        'i.startsAt',
        'i.endsAt',
        sql<Date>`lower(i.occupied)`.as('occupiedStart'),
        sql<Date>`upper(i.occupied)`.as('occupiedEnd'),
      ])
      .where('b.locationId', '=', locationId)
      .where('i.status', 'in', timeOccupyingStatuses)
      .where(sql<boolean>`i.occupied && ${range}`)
      .orderBy('i.startsAt')
      .orderBy('i.position');
    if (staffId) {
      query = query.where('i.staffId', '=', staffId);
    }
    const rows = await query.execute();
    return rows.map(({ occupiedStart, occupiedEnd, holdReason, holdExpiresAt, ...row }) => ({
      ...row,
      hold: holdOf(holdReason, holdExpiresAt),
      occupied: { start: occupiedStart.getTime(), end: occupiedEnd.getTime() },
    }));
  }

  async list(
    filter: CabinetBookingFilter,
    page: { readonly cursor: string | null; readonly limit: number },
  ): Promise<Page<CabinetBookingView>> {
    const keyset = decodeCursor(page.cursor);
    let query = this.rowQuery()
      .where('b.startsAt', '>=', filter.from)
      .where('b.startsAt', '<', filter.to)
      .orderBy('b.startsAt')
      .orderBy('b.id')
      .limit(page.limit + 1);
    if (filter.status) {
      query = query.where('b.status', '=', filter.status);
    }
    if (filter.staffId) {
      query = query.where('b.staffId', '=', filter.staffId);
    }
    if (filter.locationId) {
      query = query.where('b.locationId', '=', filter.locationId);
    }
    if (filter.search) {
      const pattern = containsPattern(filter.search);
      // Phones are stored as E.164 digits; people type them with spaces and dashes.
      const digits = filter.search.replace(/\D/g, '');
      query = query.where((eb) =>
        eb.or([
          eb('c.displayName', 'ilike', pattern),
          ...(digits.length >= MIN_PHONE_DIGITS
            ? [eb('c.phone', 'like', containsPattern(digits))]
            : []),
        ]),
      );
    }
    if (keyset) {
      query = query.where((eb) =>
        eb(eb.refTuple('b.startsAt', 'b.id'), '>', eb.tuple(keyset.at, keyset.id)),
      );
    }
    const rows = await query.execute();
    const visible = rows.slice(0, page.limit);
    const last = visible.at(-1);
    return {
      items: visible.map((row) => this.toView(row)),
      nextCursor:
        rows.length > page.limit && last ? encodeCursor({ at: last.startsAt, id: last.id }) : null,
    };
  }

  async details(
    bookingId: string,
    staffId: string | null,
  ): Promise<CabinetBookingDetailsView | null> {
    let query = this.rowQuery()
      .select(['b.clientComment', 'b.createdAt', 'b.attendanceConfirmedAt'])
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('bookingEvents as e')
            .leftJoin('users as u', 'u.id', 'e.actorUserId')
            .leftJoin('staffMembers as ps', 'ps.id', 'e.previousStaffId')
            .select([
              'e.kind',
              'e.actor',
              'e.channel',
              'u.displayName as actorName',
              'e.occurredAt',
              'e.previousStartsAt',
              'ps.displayName as previousStaffName',
            ])
            .whereRef('e.bookingId', '=', 'b.id')
            .orderBy('e.occurredAt'),
        ).as('history'),
      )
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('bookingItems as i')
            .leftJoin('resources as r', 'r.id', 'i.resourceId')
            .select([
              'i.staffId',
              'i.serviceId',
              'i.serviceName',
              'i.startsAt',
              'i.endsAt',
              'i.priceMinor',
              'r.name as resourceName',
            ])
            .whereRef('i.bookingId', '=', 'b.id')
            .orderBy('i.position'),
        ).as('items'),
      )
      .where('b.id', '=', bookingId);
    if (staffId) {
      query = query.where('b.staffId', '=', staffId);
    }
    const row = await query.executeTakeFirst();
    if (!row) {
      return null;
    }
    return {
      ...this.toView(row),
      comment: row.clientComment,
      createdAt: row.createdAt,
      attendanceConfirmedAt: row.attendanceConfirmedAt,
      // JSON aggregation returns timestamps as strings.
      history: row.history.map((entry) => ({
        ...entry,
        occurredAt: new Date(entry.occurredAt),
        previousStartsAt: entry.previousStartsAt ? new Date(entry.previousStartsAt) : null,
      })),
      items: row.items.map((item) => ({
        ...item,
        startsAt: new Date(item.startsAt),
        endsAt: new Date(item.endsAt),
      })),
    };
  }

  async forClient(
    clientId: string,
    scope: 'upcoming' | 'past',
    now: Date,
    limit: number,
  ): Promise<CabinetBookingView[]> {
    const upcoming = scope === 'upcoming';
    const rows = await this.rowQuery()
      .where('b.clientId', '=', clientId)
      .where((eb) =>
        upcoming
          ? eb.and([eb('b.status', 'in', openBookingStatuses), eb('b.endsAt', '>', now)])
          : eb.or([eb('b.status', 'not in', openBookingStatuses), eb('b.endsAt', '<=', now)]),
      )
      .orderBy('b.startsAt', upcoming ? 'asc' : 'desc')
      .orderBy('b.id', upcoming ? 'asc' : 'desc')
      .limit(limit)
      .execute();
    return rows.map((row) => this.toView(row));
  }

  async clientStats(
    clientIds: readonly string[],
    now: Date,
  ): Promise<Map<string, ClientVisitStats>> {
    if (clientIds.length === 0) {
      return new Map();
    }
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('bookings')
      .select((eb) => [
        'clientId',
        eb.fn.countAll<string>().filterWhere('status', '=', 'completed').as('visits'),
        eb.fn.countAll<string>().filterWhere('status', '=', 'no_show').as('noShows'),
        eb.fn.countAll<string>().filterWhere('status', '=', 'cancelled').as('cancellations'),
        eb.fn
          .sum<string | null>('totalPriceMinor')
          .filterWhere('status', '=', 'completed')
          .as('spentMinor'),
        eb.fn
          .max<Date | null>('startsAt')
          .filterWhere('status', '=', 'completed')
          .as('lastVisitAt'),
        eb.fn
          .min<Date | null>('startsAt')
          .filterWhere((inner) =>
            inner.and([inner('status', 'in', openBookingStatuses), inner('endsAt', '>', now)]),
          )
          .as('nextVisitAt'),
      ])
      .where('clientId', 'in', clientIds)
      .groupBy('clientId')
      .execute();
    return new Map(
      rows.map((row) => [
        row.clientId,
        {
          visits: Number(row.visits),
          noShows: Number(row.noShows),
          cancellations: Number(row.cancellations),
          spentMinor: Number(row.spentMinor ?? 0),
          lastVisitAt: row.lastVisitAt,
          nextVisitAt: row.nextVisitAt,
        },
      ]),
    );
  }

  private rowQuery() {
    return this.unitOfWork
      .tenant()
      .selectFrom('bookings as b')
      .innerJoin('clients as c', 'c.id', 'b.clientId')
      .innerJoin('staffMembers as s', 's.id', 'b.staffId')
      .innerJoin('locations as l', 'l.id', 'b.locationId')
      .select([
        'b.id',
        'b.version',
        'b.status',
        'b.holdReason',
        'b.holdExpiresAt',
        'b.depositMinor',
        'b.source',
        'b.startsAt',
        'b.endsAt',
        'b.totalPriceMinor',
        'b.currency',
        'l.timeZone',
        'l.id as locationId',
        'l.name as locationName',
        'c.id as clientId',
        'c.displayName as clientName',
        'c.phone as clientPhone',
        'c.customerId as clientCustomerId',
        's.id as staffId',
        's.displayName as staffName',
        's.title as staffTitle',
        's.avatarSeed as staffAvatarSeed',
      ])
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('bookingItems as i')
            .select(['i.serviceId as id', 'i.serviceName as name'])
            .whereRef('i.bookingId', '=', 'b.id')
            .orderBy('i.position'),
        ).as('services'),
      );
  }

  private toView(
    row: Awaited<ReturnType<ReturnType<typeof this.rowQuery>['executeTakeFirstOrThrow']>>,
  ): CabinetBookingView {
    return {
      id: row.id,
      version: row.version,
      status: row.status,
      hold: holdOf(row.holdReason, row.holdExpiresAt),
      depositMinor: row.depositMinor,
      source: row.source,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      timeZone: row.timeZone,
      client: {
        id: row.clientId,
        displayName: row.clientName,
        phone: row.clientPhone,
        customerId: row.clientCustomerId,
      },
      staff: {
        id: row.staffId,
        displayName: row.staffName,
        title: row.staffTitle,
        avatarSeed: row.staffAvatarSeed,
      },
      location: { id: row.locationId, name: row.locationName },
      services: row.services,
      totalPriceMinor: row.totalPriceMinor,
      currency: currencyCode(row.currency),
    };
  }
}
