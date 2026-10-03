/**
 * A reminder in a MAX client's chat, true to the calendar: «через 2 часа» for a visit
 * two hours ahead today, «завтра» for a visit tomorrow. A seeded MAX visit is used when
 * one fits; otherwise the front desk books one. The reminder is then made due at once.
 */
import type { Page } from 'playwright';
import { psql } from './demo-db.ts';

const MS_PER_HOUR = 3_600_000;
const DELIVERY_TIMEOUT_MS = 90_000;

const reminderTitles = {
  reminder_2h: 'Через 2 часа у вас запись',
  reminder_24h: 'Завтра у вас запись',
} as const;

export type ReminderKind = keyof typeof reminderTitles;

interface Visit {
  readonly bookingId: string;
  readonly clientName: string;
  readonly kind: ReminderKind;
}

export interface PreparedReminder extends Visit {
  /** The first line of the message, to find it in the chat. */
  readonly title: string;
}

const kindOf = (value: string): ReminderKind =>
  value === 'reminder_2h' ? 'reminder_2h' : 'reminder_24h';

/** A seeded visit of a MAX client tomorrow (preferred) or two hours ahead today. */
function seededVisit(database: string, slug: string, used: readonly string[]): Visit | null {
  const fresh =
    used.length > 0 ? `AND b.id NOT IN (${used.map((id) => `'${id}'`).join(', ')})` : '';
  const row = psql(
    database,
    `SELECT visit FROM (
       SELECT b.id || '|' || c.display_name || '|' ||
         CASE WHEN date(b.starts_at AT TIME ZONE 'Europe/Moscow') = date(now() AT TIME ZONE 'Europe/Moscow') + 1
           THEN 'reminder_24h' ELSE 'reminder_2h' END AS visit,
         b.starts_at AS starts
       FROM bookings b
       JOIN clients c ON c.id = b.client_id
       JOIN businesses s ON s.id = b.business_id
       WHERE s.slug = '${slug}' AND b.status = 'confirmed' AND b.source = 'max_mini_app' ${fresh}
         AND (
           (date(b.starts_at AT TIME ZONE 'Europe/Moscow') = date(now() AT TIME ZONE 'Europe/Moscow') + 1
             AND b.starts_at > now() + interval '3 hours')
           OR b.starts_at BETWEEN now() + interval '2 hours' AND now() + interval '165 minutes'
         )
     ) v
     ORDER BY visit LIKE '%reminder_24h' DESC, starts
     LIMIT 1`,
  );
  if (!row) {
    return null;
  }
  const [bookingId = '', clientName = '', kind = ''] = row.split('|');
  return { bookingId, clientName, kind: kindOf(kind) };
}

/** The front desk books a MAX client for tomorrow, wherever there is free time. */
async function deskVisit(page: Page, business: string, index: number): Promise<Visit> {
  const businessId = business.split('/b/')[1] ?? '';
  return page.evaluate(
    async ({ businessId, index, minAhead }) => {
      const json = async (path: string, init?: RequestInit) => {
        const response = await fetch(`/api${path}`, { credentials: 'include', ...init });
        if (!response.ok) {
          throw new Error(`${path}: ${String(response.status)}`);
        }
        return response.json() as Promise<Record<string, unknown>>;
      };
      // The emulator knows who talks to the bot in MAX; the client card is found by name.
      const chats = (await json(`/v1/cabinet/businesses/${businessId}/max-emulator/chats`))
        .chats as { clientName: string }[];
      const name = chats[index]?.clientName ?? '';
      const clients = (
        await json(
          `/v1/cabinet/businesses/${businessId}/clients?search=${encodeURIComponent(name)}`,
        )
      ).items as { id: string; displayName: string; messenger: string | null }[];
      const client = clients.find(
        (candidate) => candidate.messenger === 'max' && candidate.displayName === name,
      );
      const overview = (await json(`/v1/cabinet/businesses/${businessId}/overview`)) as {
        business: { slug: string };
        locations: { id: string }[];
      };
      const slug = overview.business.slug;
      const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(
        Date.now() + 86_400_000,
      );
      for (const location of overview.locations) {
        const services = (await json(
          `/v1/public/businesses/${slug}/services?locationId=${location.id}`,
        )) as { categories: { services: { id: string }[] }[] };
        for (const service of services.categories.flatMap((category) => category.services)) {
          const days = (await json(
            `/v1/public/businesses/${slug}/availability?locationId=${location.id}&serviceIds=${service.id}&from=${day}&to=${day}`,
          )) as { days: { slots: { start: string }[] }[] };
          const start = days.days
            .flatMap((entry) => entry.slots)
            .find((slot) => Date.parse(slot.start) - Date.now() > minAhead)?.start;
          if (!start || !client) {
            continue;
          }
          const quote = (await json(
            `/v1/public/businesses/${slug}/quote?locationId=${location.id}&serviceIds=${service.id}&start=${encodeURIComponent(start)}`,
          )) as { assigned: { staff: { id: string } } | null };
          const booked = await json(`/v1/cabinet/businesses/${businessId}/bookings`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'idempotency-key': crypto.randomUUID(),
            },
            body: JSON.stringify({
              locationId: location.id,
              staffId: quote.assigned?.staff.id,
              serviceIds: [service.id],
              start,
              client: { kind: 'existing', clientId: client.id },
              comment: null,
            }),
          });
          return {
            bookingId: booked.id as string,
            clientName: client.displayName,
            kind: 'reminder_24h' as const,
          };
        }
      }
      throw new Error('No MAX client visit to remind of: no free time tomorrow');
    },
    { businessId, index, minAhead: 3 * MS_PER_HOUR },
  );
}

export async function prepareReminder(
  page: Page,
  business: string,
  database: string,
  /** Visits reminded of earlier in the run: each recording answers a fresh one. */
  used: readonly string[] = [],
): Promise<PreparedReminder> {
  const slug = psql(
    database,
    `SELECT slug FROM businesses WHERE id = '${business.split('/b/')[1] ?? ''}'`,
  );
  const visit = seededVisit(database, slug, used) ?? (await deskVisit(page, business, used.length));
  // The reminder of this visit, due now, sent anew if it already went out.
  psql(
    database,
    `INSERT INTO notifications (id, business_id, customer_id, channel, kind, booking_id, booking_version, due_at, status, attempts, created_at, updated_at)
     SELECT gen_random_uuid(), n.business_id, n.customer_id, n.channel, '${visit.kind}', n.booking_id, b.version, now(), 'pending', 0, now(), now()
     FROM notifications n JOIN bookings b ON b.id = n.booking_id
     WHERE n.booking_id = '${visit.bookingId}' AND n.kind = 'booking_created'
     ORDER BY n.created_at DESC LIMIT 1
     ON CONFLICT ON CONSTRAINT notifications_booking_kind_key
     DO UPDATE SET due_at = now(), status = 'pending', sent_at = NULL, attempts = 0`,
  );
  const deadline = Date.now() + DELIVERY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const sent = psql(
      database,
      `SELECT count(*) FROM notifications WHERE booking_id = '${visit.bookingId}' AND kind = '${visit.kind}' AND status = 'sent'`,
    );
    if (sent === '1') {
      return { ...visit, title: reminderTitles[visit.kind] };
    }
    await page.waitForTimeout(3_000);
  }
  throw new Error('The reminder was not delivered in time');
}
