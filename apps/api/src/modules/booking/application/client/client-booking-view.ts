import type { ClientBooking } from '@mestechko/contracts';
import {
  bookingActionIds,
  bookingActions,
  bookingStatuses,
  clientChangeDeadline,
  type ClientBookingState,
  type ClientChangesRule,
} from '@mestechko/domain';
import type { AvatarUrls } from '../../../../shared/application/avatar-urls.js';
import type { PaymentRecord } from '../../../payments/application/ports.js';
import type { ClientBookingView } from '../ports.js';

export function clientStateOf(view: ClientBookingView): ClientBookingState {
  return {
    status: view.status,
    startsAt: view.startsAt.getTime(),
    attendanceConfirmedAt: view.attendanceConfirmedAt?.getTime() ?? null,
  };
}

/** The client's view of a booking, with what they may do with it at `now`. */
export function toClientBooking(
  view: ClientBookingView,
  payment: PaymentRecord | null,
  avatars: AvatarUrls,
  rule: ClientChangesRule,
  now: number,
): ClientBooking {
  const state = clientStateOf(view);
  const money = (amountMinor: number) => ({ amountMinor, currency: view.currency });
  return {
    id: view.id,
    status: view.status,
    hold: view.hold
      ? { reason: view.hold.reason, expiresAt: view.hold.expiresAt.toISOString() }
      : null,
    deposit: view.depositMinor > 0 ? money(view.depositMinor) : null,
    payment: payment
      ? {
          status: payment.status,
          amount: money(payment.amountMinor),
          refunded: money(payment.refundedMinor),
        }
      : null,
    version: view.version,
    start: view.startsAt.toISOString(),
    end: view.endsAt.toISOString(),
    attendanceConfirmed: view.attendanceConfirmedAt !== null,
    changeDeadline: bookingStatuses[view.status].acceptsClientChanges
      ? new Date(clientChangeDeadline(state.startsAt, rule)).toISOString()
      : null,
    actions: Object.fromEntries(
      bookingActionIds.map((action) => [
        action,
        bookingActions[action].isAvailable(state, now, rule),
      ]),
    ) as ClientBooking['actions'],
    location: view.location,
    staff: {
      id: view.staff.id,
      displayName: view.staff.displayName,
      title: view.staff.title,
      avatarUrl: avatars.forSeed(view.staff.avatarSeed),
    },
    services: view.services.map((service) => ({
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      price: { amountMinor: service.priceMinor, currency: view.currency },
    })),
    total: { amountMinor: view.totalPriceMinor, currency: view.currency },
    comment: view.comment,
    createdAt: view.createdAt.toISOString(),
  };
}
