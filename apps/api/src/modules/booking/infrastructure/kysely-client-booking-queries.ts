import { openBookingStatuses, type BookingStatus, type HoldReason } from '@slotwise/domain';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import { currencyCode } from '../../../platform/db/column-parsers.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  ClientBookingQueries,
  ClientBookingScope,
  ClientBookingView,
  Page,
} from '../application/ports.js';
import { decodeCursor, encodeCursor } from './cursor.js';

interface ScopeDefinition {
  readonly upcoming: boolean;
  readonly direction: 'asc' | 'desc';
  readonly after: '>' | '<';
}

const scopes: Record<ClientBookingScope, ScopeDefinition> = {
  upcoming: { upcoming: true, direction: 'asc', after: '>' },
  past: { upcoming: false, direction: 'desc', after: '<' },
};

export class KyselyClientBookingQueries implements ClientBookingQueries {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async findIdByIdempotencyKey(clientId: string, key: string): Promise<string | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('bookings')
      .select('id')
      .where('clientId', '=', clientId)
      .where('idempotencyKey', '=', key)
      .executeTakeFirst();
    return row?.id ?? null;
  }

  async clientOf(bookingId: string): Promise<string | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('bookings')
      .select('clientId')
      .where('id', '=', bookingId)
      .executeTakeFirst();
    return row?.clientId ?? null;
  }

  async get(clientId: string, bookingId: string): Promise<ClientBookingView | null> {
    const row = await this.query(clientId).where('b.id', '=', bookingId).executeTakeFirst();
    return row ? this.toView(row) : null;
  }

  async list(
    clientId: string,
    scope: ClientBookingScope,
    now: Date,
    page: { readonly cursor: string | null; readonly limit: number },
  ): Promise<Page<ClientBookingView>> {
    const definition = scopes[scope];
    const keyset = decodeCursor(page.cursor);
    let query = this.query(clientId)
      .where((eb) => {
        const upcoming = eb.and([
          eb('b.status', 'in', openBookingStatuses),
          eb('b.endsAt', '>', now),
        ]);
        return definition.upcoming ? upcoming : eb.not(upcoming);
      })
      .orderBy('b.startsAt', definition.direction)
      .orderBy('b.id', definition.direction)
      .limit(page.limit + 1);
    if (keyset) {
      query = query.where((eb) =>
        eb(eb.refTuple('b.startsAt', 'b.id'), definition.after, eb.tuple(keyset.at, keyset.id)),
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

  private query(clientId: string) {
    return this.unitOfWork
      .tenant()
      .selectFrom('bookings as b')
      .innerJoin('locations as l', 'l.id', 'b.locationId')
      .innerJoin('staffMembers as s', 's.id', 'b.staffId')
      .select([
        'b.id',
        'b.status',
        'b.holdReason',
        'b.holdExpiresAt',
        'b.depositMinor',
        'b.version',
        'b.startsAt',
        'b.endsAt',
        'b.attendanceConfirmedAt',
        'b.totalPriceMinor',
        'b.currency',
        'b.clientComment',
        'b.createdAt',
        'l.id as locationId',
        'l.name as locationName',
        'l.address as locationAddress',
        'l.timeZone as locationTimeZone',
        's.id as staffId',
        's.displayName as staffName',
        's.title as staffTitle',
        's.avatarSeed as staffAvatarSeed',
      ])
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('bookingItems as i')
            .select([
              'i.serviceId as id',
              'i.serviceName as name',
              'i.durationMinutes',
              'i.priceMinor',
            ])
            .whereRef('i.bookingId', '=', 'b.id')
            .orderBy('i.position'),
        ).as('services'),
      )
      .where('b.clientId', '=', clientId);
  }

  private toView(row: {
    id: string;
    status: BookingStatus;
    holdReason: HoldReason | null;
    holdExpiresAt: Date | null;
    depositMinor: number;
    version: number;
    startsAt: Date;
    endsAt: Date;
    attendanceConfirmedAt: Date | null;
    totalPriceMinor: number;
    currency: string;
    clientComment: string | null;
    createdAt: Date;
    locationId: string;
    locationName: string;
    locationAddress: string;
    locationTimeZone: string;
    staffId: string;
    staffName: string;
    staffTitle: string | null;
    staffAvatarSeed: string;
    services: { id: string; name: string; durationMinutes: number; priceMinor: number }[];
  }): ClientBookingView {
    return {
      id: row.id,
      status: row.status,
      hold:
        row.holdReason && row.holdExpiresAt
          ? { reason: row.holdReason, expiresAt: row.holdExpiresAt }
          : null,
      depositMinor: row.depositMinor,
      version: row.version,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      attendanceConfirmedAt: row.attendanceConfirmedAt,
      location: {
        id: row.locationId,
        name: row.locationName,
        address: row.locationAddress,
        timeZone: row.locationTimeZone,
      },
      staff: {
        id: row.staffId,
        displayName: row.staffName,
        title: row.staffTitle,
        avatarSeed: row.staffAvatarSeed,
      },
      services: row.services,
      totalPriceMinor: row.totalPriceMinor,
      currency: currencyCode(row.currency),
      comment: row.clientComment,
      createdAt: row.createdAt,
    };
  }
}
