import { sql, type Kysely } from 'kysely';

/**
 * Client lifecycle and messaging: booking versions and events, messenger permissions,
 * the notification outbox and the waitlist.
 *
 * `notifications` is a platform table: one bot serves every business, and the
 * dispatcher claims due rows across tenants. Rows still reference their business and
 * booking, so deleting either removes them.
 */
const up = sql.raw(`
ALTER TYPE booking_source ADD VALUE IF NOT EXISTS 'telegram_bot';
ALTER TYPE booking_source ADD VALUE IF NOT EXISTS 'max_bot';

CREATE TYPE booking_event_kind AS ENUM ('rescheduled', 'cancelled', 'attendance_confirmed');
CREATE TYPE booking_actor AS ENUM ('client', 'business', 'system');
CREATE TYPE notification_kind AS ENUM (
  'booking_created', 'booking_rescheduled', 'booking_cancelled',
  'reminder_24h', 'reminder_2h', 'waitlist_offer'
);
CREATE TYPE notification_status AS ENUM (
  'pending', 'sending', 'sent', 'skipped', 'cancelled', 'failed'
);
CREATE TYPE waitlist_status AS ENUM ('active', 'booked', 'cancelled');

-- Bookings: optimistic version and the client-facing state ----------------------------
ALTER TABLE bookings ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
ALTER TABLE bookings ALTER COLUMN version DROP DEFAULT;
ALTER TABLE bookings ADD COLUMN attendance_confirmed_at timestamptz;
ALTER TABLE bookings ADD COLUMN cancelled_at timestamptz;
UPDATE bookings SET cancelled_at = updated_at WHERE status = 'cancelled';
ALTER TABLE bookings ADD CONSTRAINT bookings_cancelled_at
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL));
ALTER TABLE bookings ADD CONSTRAINT bookings_attendance_before_start
  CHECK (attendance_confirmed_at IS NULL OR attendance_confirmed_at < starts_at);

CREATE TABLE booking_events (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  kind booking_event_kind NOT NULL,
  actor booking_actor NOT NULL,
  channel messenger_channel,
  previous_starts_at timestamptz,
  occurred_at timestamptz NOT NULL,
  CHECK ((kind = 'rescheduled') = (previous_starts_at IS NOT NULL)),
  FOREIGN KEY (business_id, booking_id) REFERENCES bookings (business_id, id) ON DELETE CASCADE
);
CREATE INDEX booking_events_booking_idx ON booking_events (business_id, booking_id, occurred_at);

-- Messenger permission: a bot may write only to people who started it -----------------
ALTER TABLE customer_identities ADD COLUMN chat_id text
  CHECK (chat_id IS NULL OR char_length(chat_id) BETWEEN 1 AND 64);
ALTER TABLE customer_identities ADD COLUMN messaging_allowed_at timestamptz;
ALTER TABLE customer_identities ADD CONSTRAINT customer_identities_messaging_chat
  CHECK (messaging_allowed_at IS NULL OR chat_id IS NOT NULL);

-- Waitlist --------------------------------------------------------------------------
CREATE TABLE waitlist_entries (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  location_id uuid NOT NULL,
  staff_id uuid,
  desired_date date NOT NULL,
  window_start_minute integer NOT NULL CHECK (window_start_minute BETWEEN 0 AND 1439),
  window_end_minute integer NOT NULL CHECK (window_end_minute BETWEEN 1 AND 1440),
  channel messenger_channel NOT NULL,
  status waitlist_status NOT NULL,
  booking_id uuid,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK (window_start_minute < window_end_minute),
  CHECK ((status = 'booked') = (booking_id IS NOT NULL)),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, client_id) REFERENCES clients (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, location_id) REFERENCES locations (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, staff_id) REFERENCES staff_members (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, booking_id) REFERENCES bookings (business_id, id) ON DELETE SET NULL
);
-- One open wish per client and day in a location; a second one replaces the first.
CREATE UNIQUE INDEX waitlist_entries_open_key ON waitlist_entries
  (business_id, client_id, location_id, desired_date) WHERE status = 'active';
CREATE INDEX waitlist_entries_match_idx ON waitlist_entries
  (business_id, location_id, desired_date, created_at) WHERE status = 'active';
CREATE INDEX waitlist_entries_client_idx ON waitlist_entries (business_id, client_id, desired_date);

CREATE TABLE waitlist_entry_services (
  business_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  position integer NOT NULL CHECK (position BETWEEN 0 AND 9),
  service_id uuid NOT NULL,
  PRIMARY KEY (entry_id, position),
  FOREIGN KEY (business_id, entry_id) REFERENCES waitlist_entries (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, service_id) REFERENCES services (business_id, id) ON DELETE CASCADE
);

-- Notification outbox (platform) ------------------------------------------------------
CREATE TABLE notifications (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  channel messenger_channel NOT NULL,
  kind notification_kind NOT NULL,
  booking_id uuid,
  booking_version integer,
  waitlist_entry_id uuid,
  offer_starts_at timestamptz,
  -- The price the offer shows; accepting it never books for more.
  offer_total_minor integer CHECK (offer_total_minor IS NULL OR offer_total_minor >= 0),
  due_at timestamptz NOT NULL,
  status notification_status NOT NULL,
  attempts integer NOT NULL CHECK (attempts >= 0),
  claimed_until timestamptz,
  sent_at timestamptz,
  provider_message_id text CHECK (provider_message_id IS NULL OR char_length(provider_message_id) <= 128),
  outcome text CHECK (outcome IS NULL OR outcome ~ '^[a-z][a-z0-9_]*$'),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK ((booking_id IS NULL) = (booking_version IS NULL)),
  CHECK ((waitlist_entry_id IS NULL) = (offer_starts_at IS NULL)),
  CHECK ((waitlist_entry_id IS NULL) = (offer_total_minor IS NULL)),
  CHECK ((kind = 'waitlist_offer') = (waitlist_entry_id IS NOT NULL)),
  CHECK (kind = 'waitlist_offer' OR booking_id IS NOT NULL),
  CHECK ((status = 'sending') = (claimed_until IS NOT NULL)),
  CHECK ((status = 'sent') = (sent_at IS NOT NULL)),
  FOREIGN KEY (business_id, booking_id) REFERENCES bookings (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, waitlist_entry_id)
    REFERENCES waitlist_entries (business_id, id) ON DELETE CASCADE,
  -- Planning is idempotent: one message of a kind per booking version or offer.
  CONSTRAINT notifications_booking_kind_key UNIQUE (booking_id, booking_version, kind),
  CONSTRAINT notifications_offer_key UNIQUE (waitlist_entry_id, offer_starts_at)
);
CREATE INDEX notifications_due_idx ON notifications (due_at) WHERE status = 'pending';
CREATE INDEX notifications_claimed_idx ON notifications (claimed_until) WHERE status = 'sending';
CREATE INDEX notifications_booking_idx ON notifications (booking_id) WHERE status = 'pending';

-- A customer's businesses, for the platform bot that serves them all. Returns ids only.
CREATE FUNCTION customer_business_ids(customer uuid) RETURNS SETOF uuid
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT business_id FROM clients WHERE customer_id = customer $$;
REVOKE ALL ON FUNCTION customer_business_ids(uuid) FROM PUBLIC;

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY['booking_events', 'waitlist_entries', 'waitlist_entry_services']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (business_id = app_current_business_id()) '
      'WITH CHECK (business_id = app_current_business_id())',
      tenant_table
    );
  END LOOP;
END
$$;
`);

const down = sql.raw(`
DROP FUNCTION IF EXISTS customer_business_ids(uuid);
DROP TABLE IF EXISTS notifications, waitlist_entry_services, waitlist_entries, booking_events;
ALTER TABLE customer_identities DROP CONSTRAINT IF EXISTS customer_identities_messaging_chat;
ALTER TABLE customer_identities DROP COLUMN IF EXISTS messaging_allowed_at;
ALTER TABLE customer_identities DROP COLUMN IF EXISTS chat_id;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_attendance_before_start;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_cancelled_at;
ALTER TABLE bookings DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE bookings DROP COLUMN IF EXISTS attendance_confirmed_at;
ALTER TABLE bookings DROP COLUMN IF EXISTS version;
DROP TYPE IF EXISTS waitlist_status, notification_status, notification_kind, booking_actor,
  booking_event_kind;
`);

export const clientLifecycleMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await up.execute(db);
  },
  async down(db: Kysely<unknown>): Promise<void> {
    await down.execute(db);
  },
};
