import { planBookingNotifications } from '@slotwise/domain';
import type { Transaction } from 'kysely';
import type { Database } from '../platform/db/database.js';
import type { IdGenerator } from '../shared/application/ports.js';
import type { GeneratedBooking } from './history-generator.js';

/**
 * Synthetic messenger ids of seeded clients: above anything Telegram assigns and apart
 * from demo visitors (9e12 and up), so a real person never maps to a seeded client.
 */
export const SEED_TELEGRAM_ID_BASE = 8_000_000_000_000;
export const SEED_MAX_ID_BASE = 8_500_000_000_000;
/** Clients per business who use MAX and started its bot; the MAX emulator shows them. */
const MAX_CLIENTS_PER_BUSINESS = 8;

/** Clients with visits ahead who booked in the messenger: some of them use MAX. */
export function pickMaxClients(bookings: readonly GeneratedBooking[], now: Date): Set<number> {
  const candidates = [
    ...new Set(
      bookings
        .filter(
          (booking) =>
            booking.source === 'telegram_mini_app' &&
            booking.status === 'confirmed' &&
            booking.plan.start > now.getTime(),
        )
        .map((booking) => booking.clientIndex),
    ),
  ].sort((a, b) => a - b);
  return new Set(candidates.slice(0, MAX_CLIENTS_PER_BUSINESS));
}

/** MAX clients booked through MAX; everything else keeps its source. */
export function withMaxSources(
  bookings: readonly GeneratedBooking[],
  maxClients: ReadonlySet<number>,
): GeneratedBooking[] {
  return bookings.map((booking) =>
    maxClients.has(booking.clientIndex) && booking.source === 'telegram_mini_app'
      ? { ...booking, source: 'max_mini_app' }
      : booking,
  );
}

export interface WrittenBooking {
  readonly id: string;
  readonly customerId: string | null;
  readonly booking: GeneratedBooking;
}

/**
 * Plans the messages MAX clients would have from their upcoming bookings: the notice
 * is due right away, so the emulator fills as soon as a worker runs.
 */
export async function planMaxNotifications(
  tx: Transaction<Database>,
  input: {
    readonly businessId: string;
    readonly written: readonly WrittenBooking[];
    readonly ids: IdGenerator;
    readonly now: Date;
  },
): Promise<number> {
  const rows = input.written.flatMap(({ id, customerId, booking }) =>
    customerId &&
    booking.source === 'max_mini_app' &&
    booking.status === 'confirmed' &&
    booking.plan.start > input.now.getTime()
      ? planBookingNotifications({
          event: 'created',
          startsAt: booking.plan.start,
          now: input.now.getTime(),
          seenByClient: false,
        }).map((planned) => ({
          id: input.ids.next(),
          businessId: input.businessId,
          customerId,
          channel: 'max' as const,
          kind: planned.kind,
          bookingId: id,
          bookingVersion: 1,
          dueAt: new Date(planned.dueAt),
          status: 'pending' as const,
          attempts: 0,
          createdAt: input.now,
          updatedAt: input.now,
        }))
      : [],
  );
  if (rows.length > 0) {
    await tx.insertInto('notifications').values(rows).execute();
  }
  return rows.length;
}
