import type { NotificationKind, VisitState } from '@mestechko/domain';
import type { Selectable } from 'kysely';
import type { Notifications } from '../../../platform/db/generated/database.js';
import type { KyselyUnitOfWork } from '../../../platform/db/kysely-unit-of-work.js';
import type { IdGenerator } from '../../../shared/application/ports.js';
import type {
  BookingNotificationPlan,
  NotificationOutbox,
  NotificationRecord,
  NotificationStore,
  SkipReason,
  WaitlistOfferPlan,
} from '../application/ports.js';

function toRecord(row: Selectable<Notifications>): NotificationRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    customerId: row.customerId,
    channel: row.channel,
    kind: row.kind,
    bookingId: row.bookingId,
    bookingVersion: row.bookingVersion,
    waitlistEntryId: row.waitlistEntryId,
    offerStartsAt: row.offerStartsAt,
    offerTotalMinor: row.offerTotalMinor,
    dueAt: row.dueAt,
    status: row.status,
    attempts: row.attempts,
  };
}

/**
 * The outbox lives in a platform table; inside a tenant transaction its writes join
 * that transaction, so messages commit or roll back with the change behind them.
 */
export class KyselyNotificationStore implements NotificationOutbox, NotificationStore {
  constructor(
    private readonly unitOfWork: KyselyUnitOfWork,
    private readonly ids: IdGenerator,
  ) {}

  /** Earlier versions' pending messages are withdrawn; replanning a version is a no-op. */
  async replaceForBooking(plan: BookingNotificationPlan): Promise<void> {
    const db = this.unitOfWork.platform();
    await db
      .updateTable('notifications')
      .set({ status: 'cancelled', outcome: 'booking_changed', updatedAt: plan.now })
      .where('bookingId', '=', plan.bookingId)
      .where('bookingVersion', '<>', plan.bookingVersion)
      .where('status', '=', 'pending')
      .execute();
    const recipient = plan.recipient;
    if (!recipient || plan.planned.length === 0) {
      return;
    }
    await db
      .insertInto('notifications')
      .values(
        plan.planned.map((planned) => ({
          id: this.ids.next(),
          businessId: plan.businessId,
          customerId: recipient.customerId,
          channel: recipient.channel,
          kind: planned.kind,
          bookingId: plan.bookingId,
          bookingVersion: plan.bookingVersion,
          dueAt: new Date(planned.dueAt),
          status: 'pending' as const,
          attempts: 0,
          clientKnowsStartsAt: plan.clientKnows ? new Date(plan.clientKnows.startsAt) : null,
          clientKnowsStaffId: plan.clientKnows?.staffId ?? null,
          createdAt: plan.now,
          updatedAt: plan.now,
        })),
      )
      .onConflict((conflict) => conflict.constraint('notifications_booking_kind_key').doNothing())
      .execute();
  }

  async unsentNotice(
    bookingId: string,
    kinds: readonly NotificationKind[],
  ): Promise<{ readonly clientKnows: VisitState | null } | null> {
    if (kinds.length === 0) {
      return null;
    }
    const row = await this.unitOfWork
      .platform()
      .selectFrom('notifications')
      .select(['clientKnowsStartsAt', 'clientKnowsStaffId'])
      .where('bookingId', '=', bookingId)
      .where('kind', 'in', [...kinds])
      .where('status', '=', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .executeTakeFirst();
    if (!row) {
      return null;
    }
    return {
      clientKnows:
        row.clientKnowsStartsAt && row.clientKnowsStaffId
          ? { startsAt: row.clientKnowsStartsAt.getTime(), staffId: row.clientKnowsStaffId }
          : null,
    };
  }

  async offerWaitlistSlot(offer: WaitlistOfferPlan): Promise<boolean> {
    const result = await this.unitOfWork
      .platform()
      .insertInto('notifications')
      .values({
        id: this.ids.next(),
        businessId: offer.businessId,
        customerId: offer.recipient.customerId,
        channel: offer.recipient.channel,
        kind: 'waitlist_offer',
        waitlistEntryId: offer.entryId,
        offerStartsAt: offer.startsAt,
        offerTotalMinor: offer.totalMinor,
        dueAt: offer.now,
        status: 'pending',
        attempts: 0,
        createdAt: offer.now,
        updatedAt: offer.now,
      })
      .onConflict((conflict) => conflict.constraint('notifications_offer_key').doNothing())
      .executeTakeFirst();
    return (result.numInsertedOrUpdatedRows ?? 0n) > 0n;
  }

  async claimDue(now: Date, claimUntil: Date, limit: number): Promise<NotificationRecord[]> {
    const db = this.unitOfWork.platform();
    const rows = await db
      .updateTable('notifications')
      .set((eb) => ({
        status: 'sending',
        claimedUntil: claimUntil,
        attempts: eb('attempts', '+', 1),
        updatedAt: now,
      }))
      .where('id', 'in', (eb) =>
        eb
          .selectFrom('notifications')
          .select('id')
          .where((where) =>
            where.or([
              where.and([where('status', '=', 'pending'), where('dueAt', '<=', now)]),
              where.and([where('status', '=', 'sending'), where('claimedUntil', '<', now)]),
            ]),
          )
          .orderBy('dueAt')
          .limit(limit)
          .forUpdate()
          .skipLocked(),
      )
      .returningAll()
      .execute();
    return rows.map(toRecord);
  }

  async findClaimed(id: string): Promise<NotificationRecord | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('notifications')
      .selectAll()
      .where('id', '=', id)
      .where('status', '=', 'sending')
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  async markSent(id: string, providerMessageId: string, now: Date): Promise<void> {
    await this.unitOfWork
      .platform()
      .updateTable('notifications')
      .set({
        status: 'sent',
        claimedUntil: null,
        sentAt: now,
        providerMessageId,
        outcome: null,
        updatedAt: now,
      })
      .where('id', '=', id)
      .where('status', '=', 'sending')
      .execute();
  }

  async markSkipped(id: string, reason: SkipReason, now: Date): Promise<void> {
    await this.finish(id, 'skipped', reason, now);
  }

  async markFailed(id: string, reason: SkipReason, now: Date): Promise<void> {
    await this.finish(id, 'failed', reason, now);
  }

  async findOffer(entryId: string, startsAt: Date): Promise<NotificationRecord | null> {
    const row = await this.unitOfWork
      .platform()
      .selectFrom('notifications')
      .selectAll()
      .where('waitlistEntryId', '=', entryId)
      .where('offerStartsAt', '=', startsAt)
      .executeTakeFirst();
    return row ? toRecord(row) : null;
  }

  private async finish(
    id: string,
    status: 'skipped' | 'failed',
    reason: SkipReason,
    now: Date,
  ): Promise<void> {
    await this.unitOfWork
      .platform()
      .updateTable('notifications')
      .set({ status, claimedUntil: null, outcome: reason, updatedAt: now })
      .where('id', '=', id)
      .where('status', '=', 'sending')
      .execute();
  }
}
