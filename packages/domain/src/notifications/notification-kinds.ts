import type { BookingAction } from '../booking/booking-actions.js';
import type { BookingLifecycleEvent } from '../booking/booking-events.js';
import { MS_PER_MINUTE } from '../time/instant-interval.js';

/** When a notification of the kind is due. */
export type NotificationSchedule =
  | { readonly kind: 'on_event'; readonly events: readonly BookingLifecycleEvent[] }
  | { readonly kind: 'before_start'; readonly minutes: number }
  | { readonly kind: 'on_waitlist_match' };

interface NotificationKindDefinition {
  readonly schedule: NotificationSchedule;
  /** Booking actions the message offers; each is shown only while available. */
  readonly actions: readonly BookingAction[];
  /** A message delivered later than this after it was due would mislead; it is dropped. */
  readonly staleAfterMinutes: number;
}

/**
 * Messages the platform sends to clients. A new kind is a new entry here (plus its
 * texts); planning, delivery and rendering read their behaviour from the registry.
 */
export const notificationKinds = {
  booking_created: {
    schedule: { kind: 'on_event', events: ['created', 'confirmed'] },
    actions: ['reschedule', 'cancel'],
    staleAfterMinutes: 12 * 60,
  },
  booking_rescheduled: {
    schedule: { kind: 'on_event', events: ['rescheduled'] },
    actions: ['reschedule', 'cancel'],
    staleAfterMinutes: 12 * 60,
  },
  booking_cancelled: {
    schedule: { kind: 'on_event', events: ['cancelled'] },
    actions: [],
    staleAfterMinutes: 12 * 60,
  },
  reminder_24h: {
    schedule: { kind: 'before_start', minutes: 24 * 60 },
    actions: ['reschedule', 'cancel'],
    staleAfterMinutes: 2 * 60,
  },
  reminder_2h: {
    schedule: { kind: 'before_start', minutes: 2 * 60 },
    actions: ['confirm_attendance', 'cancel'],
    staleAfterMinutes: 30,
  },
  waitlist_offer: {
    schedule: { kind: 'on_waitlist_match' },
    actions: [],
    staleAfterMinutes: 60,
  },
} as const satisfies Record<string, NotificationKindDefinition>;

export type NotificationKind = keyof typeof notificationKinds;

export const notificationKindIds = Object.keys(notificationKinds) as NotificationKind[];

/**
 * A reminder this close to the event that planned it would repeat the message the
 * client has just received, so it is skipped.
 */
export const REMINDER_MIN_LEAD_MINUTES = 60;

/** Lifecycle events after which the visit is still ahead and reminders apply. */
const ACTIVE_EVENTS: ReadonlySet<BookingLifecycleEvent> = new Set([
  'created',
  'confirmed',
  'rescheduled',
]);

export interface PlannedNotification {
  readonly kind: NotificationKind;
  /** Epoch milliseconds. */
  readonly dueAt: number;
}

export interface NotificationPlanInput {
  readonly event: BookingLifecycleEvent;
  /** Epoch milliseconds of the visit start. */
  readonly startsAt: number;
  readonly now: number;
  /**
   * The client already sees the outcome where they made the change (e.g. the chat
   * message they pressed a button in), so the event notice is not sent again.
   */
  readonly seenByClient: boolean;
}

/** Notifications a booking event brings: an immediate notice and future reminders. */
export function planBookingNotifications(input: NotificationPlanInput): PlannedNotification[] {
  return notificationKindIds.flatMap((kind): PlannedNotification[] => {
    const schedule: NotificationSchedule = notificationKinds[kind].schedule;
    if (schedule.kind === 'on_event') {
      return schedule.events.includes(input.event) && !input.seenByClient
        ? [{ kind, dueAt: input.now }]
        : [];
    }
    if (schedule.kind === 'before_start' && ACTIVE_EVENTS.has(input.event)) {
      const dueAt = input.startsAt - schedule.minutes * MS_PER_MINUTE;
      return dueAt - input.now >= REMINDER_MIN_LEAD_MINUTES * MS_PER_MINUTE
        ? [{ kind, dueAt }]
        : [];
    }
    return [];
  });
}

/** Whether a message that was due at `dueAt` is too late to deliver at `now`. */
export function isNotificationStale(kind: NotificationKind, dueAt: number, now: number): boolean {
  return now - dueAt > notificationKinds[kind].staleAfterMinutes * MS_PER_MINUTE;
}
