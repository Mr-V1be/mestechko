import type { WaitlistOfferStatus, WaitlistStatus } from '@slotwise/domain';
import { sql } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/postgres';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type {
  NewWaitlistEntry,
  WaitlistEntryRecord,
  WaitlistEntryView,
  WaitlistOfferRecord,
  WaitlistStore,
} from '../application/ports.js';

const offerColumns = ['o.id', 'o.entryId', 'o.bookingId', 'o.startsAt', 'o.status'] as const;

interface EntryRow {
  id: string;
  clientId: string;
  customerId: string | null;
  locationId: string;
  staffId: string | null;
  desiredDate: string;
  windowStartMinute: number;
  windowEndMinute: number;
  channel: WaitlistEntryRecord['channel'];
  status: WaitlistStatus;
  createdAt: Date;
  services: { id: string; name: string }[];
}

function toRecord(row: EntryRow): WaitlistEntryRecord {
  return {
    id: row.id,
    clientId: row.clientId,
    customerId: row.customerId,
    locationId: row.locationId,
    staffId: row.staffId,
    serviceIds: row.services.map((service) => service.id),
    date: row.desiredDate,
    window: { startMinute: row.windowStartMinute, endMinute: row.windowEndMinute },
    channel: row.channel,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export class KyselyWaitlistStore implements WaitlistStore {
  constructor(private readonly unitOfWork: KyselyUnitOfWork) {}

  async saveOpen(entry: NewWaitlistEntry): Promise<string> {
    const db = this.unitOfWork.tenant();
    const businessId = this.unitOfWork.currentBusinessId();
    const existing = await db
      .selectFrom('waitlistEntries')
      .select('id')
      .where('clientId', '=', entry.clientId)
      .where('locationId', '=', entry.locationId)
      .where('desiredDate', '=', entry.date)
      .where('status', '=', 'active')
      .forUpdate()
      .executeTakeFirst();
    const id = existing?.id ?? entry.id;
    if (existing) {
      await db
        .updateTable('waitlistEntries')
        .set({
          staffId: entry.staffId,
          windowStartMinute: entry.window.startMinute,
          windowEndMinute: entry.window.endMinute,
          channel: entry.channel,
          updatedAt: entry.now,
        })
        .where('id', '=', id)
        .execute();
      await db.deleteFrom('waitlistEntryServices').where('entryId', '=', id).execute();
    } else {
      await db
        .insertInto('waitlistEntries')
        .values({
          id,
          businessId,
          clientId: entry.clientId,
          locationId: entry.locationId,
          staffId: entry.staffId,
          desiredDate: entry.date,
          windowStartMinute: entry.window.startMinute,
          windowEndMinute: entry.window.endMinute,
          channel: entry.channel,
          status: 'active',
          bookingId: null,
          createdAt: entry.now,
          updatedAt: entry.now,
        })
        .execute();
    }
    await db
      .insertInto('waitlistEntryServices')
      .values(
        entry.serviceIds.map((serviceId, position) => ({
          businessId,
          entryId: id,
          position,
          serviceId,
        })),
      )
      .execute();
    return id;
  }

  async find(entryId: string): Promise<WaitlistEntryView | null> {
    const row = await this.views().where('w.id', '=', entryId).executeTakeFirst();
    return row ? this.toView(row) : null;
  }

  async listOpenForClient(clientId: string, fromDate: string): Promise<WaitlistEntryView[]> {
    const rows = await this.views()
      .where('w.clientId', '=', clientId)
      .where('w.status', '=', 'active')
      .where('w.desiredDate', '>=', fromDate)
      .orderBy('w.desiredDate')
      .orderBy('w.windowStartMinute')
      .execute();
    return rows.map((row) => this.toView(row));
  }

  async listOpenForDay(locationId: string, date: string): Promise<WaitlistEntryRecord[]> {
    const rows = await this.views()
      .where('w.locationId', '=', locationId)
      .where('w.desiredDate', '=', date)
      .where('w.status', '=', 'active')
      .orderBy('w.createdAt')
      .execute();
    return rows.map(toRecord);
  }

  async cancel(entryId: string, clientId: string, now: Date): Promise<boolean> {
    const result = await this.unitOfWork
      .tenant()
      .updateTable('waitlistEntries')
      .set({ status: 'cancelled', updatedAt: now })
      .where('id', '=', entryId)
      .where('clientId', '=', clientId)
      .where('status', '=', 'active')
      .executeTakeFirst();
    return result.numUpdatedRows > 0n;
  }

  async markBooked(entryId: string, bookingId: string, now: Date): Promise<void> {
    await this.unitOfWork
      .tenant()
      .updateTable('waitlistEntries')
      .set({ status: 'booked', bookingId, updatedAt: now })
      .where('id', '=', entryId)
      .where('status', '=', 'active')
      .execute();
  }

  async offeredStarts(entryIds: readonly string[]): Promise<Map<string, Set<number>>> {
    if (entryIds.length === 0) {
      return new Map();
    }
    const rows = await this.unitOfWork
      .tenant()
      .selectFrom('waitlistOffers')
      .select(['entryId', 'startsAt'])
      .where('entryId', 'in', entryIds)
      .execute();
    const offered = new Map<string, Set<number>>();
    for (const row of rows) {
      offered.set(row.entryId, (offered.get(row.entryId) ?? new Set()).add(row.startsAt.getTime()));
    }
    return offered;
  }

  pendingOffers(locationId: string, date: string): Promise<WaitlistOfferRecord[]> {
    return this.unitOfWork
      .tenant()
      .selectFrom('waitlistOffers as o')
      .innerJoin('waitlistEntries as w', 'w.id', 'o.entryId')
      .select(offerColumns)
      .where('w.locationId', '=', locationId)
      .where('w.desiredDate', '=', date)
      .where('o.status', '=', 'pending')
      .execute();
  }

  async pendingOfferOf(entryId: string): Promise<WaitlistOfferRecord | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('waitlistOffers as o')
      .select(offerColumns)
      .where('o.entryId', '=', entryId)
      .where('o.status', '=', 'pending')
      .executeTakeFirst();
    return row ?? null;
  }

  async findOffer(entryId: string, startsAt: Date): Promise<WaitlistOfferRecord | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('waitlistOffers as o')
      .select(offerColumns)
      .where('o.entryId', '=', entryId)
      .where('o.startsAt', '=', startsAt)
      .executeTakeFirst();
    return row ?? null;
  }

  async offerOfBooking(bookingId: string): Promise<WaitlistOfferRecord | null> {
    const row = await this.unitOfWork
      .tenant()
      .selectFrom('waitlistOffers as o')
      .select(offerColumns)
      .where('o.bookingId', '=', bookingId)
      .orderBy('o.createdAt', 'desc')
      .executeTakeFirst();
    return row ?? null;
  }

  async insertOffer(offer: Omit<WaitlistOfferRecord, 'status'>, now: Date): Promise<void> {
    await this.unitOfWork
      .tenant()
      .insertInto('waitlistOffers')
      .values({
        ...offer,
        businessId: this.unitOfWork.currentBusinessId(),
        status: 'pending',
        createdAt: now,
        respondedAt: null,
      })
      .execute();
  }

  async closeOffer(offerId: string, status: WaitlistOfferStatus, now: Date): Promise<void> {
    await this.unitOfWork
      .tenant()
      .updateTable('waitlistOffers')
      .set({ status, respondedAt: now })
      .where('id', '=', offerId)
      .where('status', '=', 'pending')
      .execute();
  }

  private views() {
    return this.unitOfWork
      .tenant()
      .selectFrom('waitlistEntries as w')
      .innerJoin('clients as c', 'c.id', 'w.clientId')
      .innerJoin('locations as l', 'l.id', 'w.locationId')
      .leftJoin('staffMembers as s', 's.id', 'w.staffId')
      .select([
        'w.id',
        'w.clientId',
        'c.customerId',
        'w.locationId',
        'w.staffId',
        sql<string>`to_char(w.desired_date, 'YYYY-MM-DD')`.as('desiredDate'),
        'w.windowStartMinute',
        'w.windowEndMinute',
        'w.channel',
        'w.status',
        'w.createdAt',
        'l.name as locationName',
        'l.address as locationAddress',
        'l.timeZone as locationTimeZone',
        's.displayName as staffName',
      ])
      .select((eb) =>
        jsonArrayFrom(
          eb
            .selectFrom('waitlistEntryServices as ws')
            .innerJoin('services as sv', 'sv.id', 'ws.serviceId')
            .select(['sv.id', 'sv.name'])
            .whereRef('ws.entryId', '=', 'w.id')
            .orderBy('ws.position'),
        ).as('services'),
      );
  }

  private toView(
    row: EntryRow & {
      locationName: string;
      locationAddress: string;
      locationTimeZone: string;
      staffName: string | null;
    },
  ): WaitlistEntryView {
    return {
      ...toRecord(row),
      location: {
        id: row.locationId,
        name: row.locationName,
        address: row.locationAddress,
        timeZone: row.locationTimeZone,
      },
      staff: row.staffId && row.staffName ? { id: row.staffId, displayName: row.staffName } : null,
      services: row.services,
    };
  }
}
