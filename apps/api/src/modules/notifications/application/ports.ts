import type {
  MessengerChannel,
  NotificationKind,
  PlannedNotification,
  VisitState,
} from '@slotwise/domain';

/** Who receives the messages of a booking, and through which messenger. */
export interface NotificationRecipient {
  readonly customerId: string;
  readonly channel: MessengerChannel;
}

export interface BookingNotificationPlan {
  readonly businessId: string;
  readonly bookingId: string;
  readonly bookingVersion: number;
  /** `null` when the client has no messenger: pending messages are still withdrawn. */
  readonly recipient: NotificationRecipient | null;
  readonly planned: readonly PlannedNotification[];
  /** What the client was last told about the visit; kept for a change taken back. */
  readonly clientKnows: VisitState | null;
  readonly now: Date;
}

export interface WaitlistOfferPlan {
  readonly businessId: string;
  readonly entryId: string;
  readonly recipient: NotificationRecipient;
  readonly startsAt: Date;
  readonly totalMinor: number;
  readonly now: Date;
}

/**
 * Outgoing messages written in the same transaction as the change that causes them,
 * so a committed change always has its messages and a rolled back one has none.
 */
export interface NotificationOutbox {
  /** Withdraws the booking's pending messages and plans those of its current version. */
  replaceForBooking(plan: BookingNotificationPlan): Promise<void>;
  /**
   * A notice about the booking that has not gone out yet, and what the client knew
   * before it; `null` when everything the client should hear was sent.
   */
  unsentNotice(
    bookingId: string,
    kinds: readonly NotificationKind[],
  ): Promise<{ readonly clientKnows: VisitState | null } | null>;
  /** Plans an offer once per entry and start; `false` when it was offered before. */
  offerWaitlistSlot(offer: WaitlistOfferPlan): Promise<boolean>;
}

export type NotificationStatus =
  'pending' | 'sending' | 'sent' | 'skipped' | 'cancelled' | 'failed';

export interface NotificationRecord {
  readonly id: string;
  readonly businessId: string;
  readonly customerId: string;
  readonly channel: MessengerChannel;
  readonly kind: NotificationKind;
  readonly bookingId: string | null;
  readonly bookingVersion: number | null;
  readonly waitlistEntryId: string | null;
  readonly offerStartsAt: Date | null;
  readonly offerTotalMinor: number | null;
  readonly dueAt: Date;
  readonly status: NotificationStatus;
  readonly attempts: number;
}

/** Why a message was not delivered; stored for support and metrics. */
export type SkipReason =
  | 'no_permission'
  | 'channel_unavailable'
  | 'recipient_blocked'
  | 'booking_changed'
  | 'stale'
  | 'offer_closed'
  | 'attempts_exhausted';

/** Delivery-side access to the outbox. Platform-wide: rows of every tenant. */
export interface NotificationStore {
  /**
   * Claims due messages (and ones whose previous claim expired) for delivery.
   * Concurrent dispatchers never claim the same row.
   */
  claimDue(now: Date, claimUntil: Date, limit: number): Promise<NotificationRecord[]>;
  findClaimed(id: string): Promise<NotificationRecord | null>;
  markSent(id: string, providerMessageId: string, now: Date): Promise<void>;
  markSkipped(id: string, reason: SkipReason, now: Date): Promise<void>;
  markFailed(id: string, reason: SkipReason, now: Date): Promise<void>;
  /** Offer previously planned for an entry and start, with the price it shows. */
  findOffer(entryId: string, startsAt: Date): Promise<NotificationRecord | null>;
}

export const NOTIFICATION_OUTBOX = Symbol('NOTIFICATION_OUTBOX');
export const NOTIFICATION_STORE = Symbol('NOTIFICATION_STORE');
