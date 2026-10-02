import { sql, type Kysely } from 'kysely';

/**
 * The business runs itself from the cabinet: held bookings, absences, incompatible
 * services, the client CRM, loyalty and passes on a ledger, prepayments through a
 * payment provider, and sequential waitlist offers.
 *
 * Money and points live only in `ledger_entries`: balances are sums, entries are never
 * changed, and each carries its reason. The provider emulator's tables mirror what a
 * payment provider keeps on its side; the product never reads them.
 */
const up = sql.raw(`
CREATE TYPE hold_reason AS ENUM ('payment', 'waitlist_offer');
CREATE TYPE absence_kind AS ENUM ('vacation', 'sick_leave', 'day_off');
CREATE TYPE ledger_account AS ENUM ('points', 'pass', 'money');
CREATE TYPE ledger_reason AS ENUM (
  'points_accrual', 'points_redemption', 'points_adjustment',
  'pass_sale', 'pass_visit', 'pass_adjustment',
  'prepayment', 'prepayment_refund', 'visit_payment', 'pass_payment'
);
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'cancelled', 'refunded');
CREATE TYPE waitlist_offer_status AS ENUM ('pending', 'accepted', 'declined', 'expired', 'withdrawn');

-- Held bookings and prepayment ----------------------------------------------------------
ALTER TABLE bookings ADD COLUMN hold_reason hold_reason;
ALTER TABLE bookings ADD COLUMN hold_expires_at timestamptz;
ALTER TABLE bookings ADD CONSTRAINT bookings_hold CHECK (
  (status = 'held') = (hold_reason IS NOT NULL)
  AND (hold_reason IS NULL) = (hold_expires_at IS NULL)
);
CREATE INDEX bookings_hold_expiry_idx ON bookings (hold_expires_at) WHERE status = 'held';
-- Prepayment the booking asks for; 0 when none.
ALTER TABLE bookings ADD COLUMN deposit_minor integer NOT NULL DEFAULT 0 CHECK (deposit_minor >= 0);
ALTER TABLE bookings ALTER COLUMN deposit_minor DROP DEFAULT;

-- Held time is taken like confirmed time.
ALTER TABLE booking_items DROP CONSTRAINT booking_items_staff_no_overlap;
ALTER TABLE booking_items DROP CONSTRAINT booking_items_resource_no_overlap;
ALTER TABLE booking_items ADD CONSTRAINT booking_items_staff_no_overlap EXCLUDE USING gist (
  staff_id WITH =,
  occupied WITH &&
) WHERE (status IN ('held', 'confirmed', 'completed', 'no_show'));
ALTER TABLE booking_items ADD CONSTRAINT booking_items_resource_no_overlap EXCLUDE USING gist (
  resource_id WITH =,
  occupied WITH &&
) WHERE (resource_id IS NOT NULL AND status IN ('held', 'confirmed', 'completed', 'no_show'));

-- Who changed a booking from the cabinet, and from whom it moved.
ALTER TABLE booking_events ADD COLUMN previous_staff_id uuid;
ALTER TABLE booking_events ADD CONSTRAINT booking_events_previous_staff_fk
  FOREIGN KEY (business_id, previous_staff_id) REFERENCES staff_members (business_id, id);
ALTER TABLE booking_events ADD CONSTRAINT booking_events_previous_staff
  CHECK (previous_staff_id IS NULL OR kind = 'rescheduled');
ALTER TABLE booking_events ADD COLUMN actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE booking_events ADD CONSTRAINT booking_events_actor_user
  CHECK (actor_user_id IS NULL OR actor = 'business');

-- Expired holds across businesses, for the sweeper that releases them. Returns ids only.
CREATE FUNCTION expired_booking_holds(due_at timestamptz, max_rows integer)
  RETURNS TABLE (business_id uuid, booking_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT b.business_id, b.id FROM bookings b
    WHERE b.status = 'held' AND b.hold_expires_at <= due_at
    ORDER BY b.hold_expires_at
    LIMIT max_rows
  $$;
REVOKE ALL ON FUNCTION expired_booking_holds(timestamptz, integer) FROM PUBLIC;

-- Staff absences ----------------------------------------------------------------------
CREATE TABLE staff_absences (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  kind absence_kind NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  created_at timestamptz NOT NULL,
  CHECK (ends_on >= starts_on AND ends_on - starts_on < 366),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, staff_id) REFERENCES staff_members (business_id, id) ON DELETE CASCADE,
  CONSTRAINT staff_absences_no_overlap EXCLUDE USING gist (
    staff_id WITH =,
    daterange(starts_on, ends_on, '[]') WITH &&
  )
);

-- Catalog: prepayment share and services never booked together ----------------------------
ALTER TABLE services ADD COLUMN deposit_percent integer
  CHECK (deposit_percent IS NULL OR deposit_percent BETWEEN 0 AND 100);

CREATE TABLE service_incompatibilities (
  business_id uuid NOT NULL,
  service_id uuid NOT NULL,
  other_service_id uuid NOT NULL,
  created_at timestamptz NOT NULL,
  -- One row per pair, in id order.
  CHECK (service_id < other_service_id),
  PRIMARY KEY (business_id, service_id, other_service_id),
  FOREIGN KEY (business_id, service_id) REFERENCES services (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, other_service_id) REFERENCES services (business_id, id) ON DELETE CASCADE
);
CREATE INDEX service_incompatibilities_other_idx
  ON service_incompatibilities (business_id, other_service_id);

-- Clients: tags, e-mail and a notes feed ----------------------------------------------------
CREATE FUNCTION valid_client_tags(tags text[]) RETURNS boolean
  LANGUAGE sql IMMUTABLE
  AS $$
    SELECT cardinality(tags) <= 20
      AND coalesce(bool_and(char_length(tag) BETWEEN 1 AND 32 AND tag = btrim(tag)), true)
      AND cardinality(tags) = count(DISTINCT lower(tag))
    FROM unnest(tags) AS tag
  $$;
ALTER TABLE clients ADD COLUMN tags text[] NOT NULL DEFAULT '{}'
  CONSTRAINT clients_tags CHECK (valid_client_tags(tags));
ALTER TABLE clients ALTER COLUMN tags DROP DEFAULT;
ALTER TABLE clients ADD COLUMN email text
  CHECK (email IS NULL OR (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+$'));
CREATE INDEX clients_tags_idx ON clients USING gin (tags);
CREATE INDEX clients_phone_trgm_idx ON clients USING gin (phone gin_trgm_ops);

CREATE TABLE client_notes (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  client_id uuid NOT NULL,
  author_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, client_id) REFERENCES clients (business_id, id) ON DELETE CASCADE
);
CREATE INDEX client_notes_client_idx ON client_notes (business_id, client_id, created_at DESC);
INSERT INTO client_notes (id, business_id, client_id, author_user_id, body, created_at, updated_at)
  SELECT gen_random_uuid(), business_id, id, NULL, notes, updated_at, updated_at
  FROM clients WHERE notes IS NOT NULL;
ALTER TABLE clients DROP COLUMN notes;

-- Loyalty and passes ----------------------------------------------------------------------
-- A business without a row runs no loyalty program.
CREATE TABLE loyalty_programs (
  business_id uuid PRIMARY KEY REFERENCES businesses (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_]*$'),
  accrual_percent integer NOT NULL CHECK (accrual_percent BETWEEN 0 AND 100),
  max_redeem_percent integer NOT NULL CHECK (max_redeem_percent BETWEEN 0 AND 100),
  updated_at timestamptz NOT NULL
);

CREATE TABLE pass_plans (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  visits integer NOT NULL CHECK (visits BETWEEN 1 AND 100),
  validity_days integer NOT NULL CHECK (validity_days BETWEEN 1 AND 730),
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  is_active boolean NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (business_id, id)
);

CREATE TABLE pass_plan_services (
  business_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  service_id uuid NOT NULL,
  PRIMARY KEY (plan_id, service_id),
  FOREIGN KEY (business_id, plan_id) REFERENCES pass_plans (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, service_id) REFERENCES services (business_id, id) ON DELETE CASCADE
);

-- A sold pass keeps its terms; the plan may change or go away later.
CREATE TABLE client_passes (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  client_id uuid NOT NULL,
  plan_id uuid,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  visits integer NOT NULL CHECK (visits BETWEEN 1 AND 100),
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  valid_from date NOT NULL,
  valid_until date NOT NULL,
  sold_at timestamptz NOT NULL,
  sold_by_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  -- Selling twice by repeating the same request sells once.
  idempotency_key uuid NOT NULL,
  CHECK (valid_until >= valid_from),
  UNIQUE (business_id, id),
  CONSTRAINT client_passes_idempotency_key UNIQUE (business_id, idempotency_key),
  FOREIGN KEY (business_id, client_id) REFERENCES clients (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, plan_id) REFERENCES pass_plans (business_id, id) ON DELETE SET NULL (plan_id)
);
CREATE INDEX client_passes_client_idx ON client_passes (business_id, client_id, valid_until);

CREATE TABLE client_pass_services (
  business_id uuid NOT NULL,
  pass_id uuid NOT NULL,
  service_id uuid NOT NULL,
  PRIMARY KEY (pass_id, service_id),
  FOREIGN KEY (business_id, pass_id) REFERENCES client_passes (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, service_id) REFERENCES services (business_id, id) ON DELETE CASCADE
);

-- Payments ------------------------------------------------------------------------------------
CREATE TABLE payments (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  client_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_]*$'),
  provider_payment_id text CHECK (provider_payment_id IS NULL OR char_length(provider_payment_id) BETWEEN 1 AND 128),
  checkout_url text CHECK (checkout_url IS NULL OR char_length(checkout_url) <= 2000),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  status payment_status NOT NULL,
  -- What the business decided to give back, and what the provider confirmed so far.
  refund_requested_minor integer NOT NULL CHECK (refund_requested_minor >= 0),
  refunded_minor integer NOT NULL CHECK (refunded_minor >= 0),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  paid_at timestamptz,
  CHECK (refunded_minor <= refund_requested_minor AND refund_requested_minor <= amount_minor),
  CHECK ((provider_payment_id IS NULL) = (checkout_url IS NULL)),
  CHECK ((status IN ('succeeded', 'refunded')) = (paid_at IS NOT NULL)),
  CHECK (status IN ('succeeded', 'refunded') OR refund_requested_minor = 0),
  -- Refunded means all of it came back; a partial refund leaves the payment succeeded.
  CHECK ((status = 'refunded') = (refunded_minor = amount_minor)),
  UNIQUE (business_id, id),
  UNIQUE (provider, provider_payment_id),
  FOREIGN KEY (business_id, booking_id) REFERENCES bookings (business_id, id),
  FOREIGN KEY (business_id, client_id) REFERENCES clients (business_id, id)
);
-- A booking has at most one payment that is open or holds money.
CREATE UNIQUE INDEX payments_booking_active_key ON payments (booking_id)
  WHERE status IN ('pending', 'succeeded');
CREATE INDEX payments_booking_idx ON payments (business_id, booking_id);

CREATE INDEX payments_refund_due_idx ON payments (updated_at)
  WHERE refund_requested_minor > refunded_minor;

-- Refunds the provider has not confirmed yet, across businesses, for the sweeper that
-- retries them. Returns ids only.
CREATE FUNCTION pending_payment_refunds(max_rows integer)
  RETURNS TABLE (business_id uuid, payment_id uuid)
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$
    SELECT p.business_id, p.id FROM payments p
    WHERE p.refund_requested_minor > p.refunded_minor
    ORDER BY p.updated_at
    LIMIT max_rows
  $$;
REVOKE ALL ON FUNCTION pending_payment_refunds(integer) FROM PUBLIC;

-- Provider notifications already processed; a repeated delivery changes nothing.
CREATE TABLE payment_webhook_events (
  provider text NOT NULL CHECK (provider ~ '^[a-z][a-z0-9_]*$'),
  event_id text NOT NULL CHECK (char_length(event_id) BETWEEN 1 AND 128),
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  payment_id uuid NOT NULL REFERENCES payments (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind ~ '^[a-z][a-z0-9_.]*$'),
  received_at timestamptz NOT NULL,
  PRIMARY KEY (provider, event_id)
);

-- Ledger: points, pass visits and money, in whole units ---------------------------------------
CREATE TABLE ledger_entries (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  client_id uuid NOT NULL,
  account ledger_account NOT NULL,
  reason ledger_reason NOT NULL,
  amount integer NOT NULL CHECK (amount <> 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  pass_id uuid,
  booking_id uuid,
  payment_id uuid,
  note text CHECK (note IS NULL OR char_length(note) BETWEEN 1 AND 300),
  actor_user_id uuid REFERENCES users (id) ON DELETE SET NULL,
  -- Hand-made entries carry the request's key, so repeating it posts once.
  idempotency_key uuid,
  created_at timestamptz NOT NULL,
  CONSTRAINT ledger_entries_reason_account CHECK (account = CASE
    WHEN reason IN ('points_accrual', 'points_redemption', 'points_adjustment') THEN 'points'
    WHEN reason IN ('pass_sale', 'pass_visit', 'pass_adjustment') THEN 'pass'
    ELSE 'money' END::ledger_account),
  CONSTRAINT ledger_entries_reason_sign CHECK (CASE
    WHEN reason IN ('points_accrual', 'pass_sale', 'prepayment', 'visit_payment', 'pass_payment') THEN amount > 0
    WHEN reason IN ('points_redemption', 'pass_visit', 'prepayment_refund') THEN amount < 0
    ELSE true END),
  CHECK ((account = 'money') = (currency IS NOT NULL)),
  CHECK (account <> 'pass' OR pass_id IS NOT NULL),
  CHECK (reason NOT IN ('prepayment', 'prepayment_refund') OR payment_id IS NOT NULL),
  CHECK (reason NOT IN ('pass_sale', 'pass_payment') OR pass_id IS NOT NULL),
  -- Settling a visit or a payment twice is impossible.
  CONSTRAINT ledger_entries_booking_reason UNIQUE (booking_id, reason),
  CONSTRAINT ledger_entries_payment_reason UNIQUE (payment_id, reason),
  CONSTRAINT ledger_entries_idempotency_key UNIQUE (business_id, idempotency_key),
  FOREIGN KEY (business_id, client_id) REFERENCES clients (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, pass_id) REFERENCES client_passes (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, booking_id) REFERENCES bookings (business_id, id),
  FOREIGN KEY (business_id, payment_id) REFERENCES payments (business_id, id)
);
CREATE UNIQUE INDEX ledger_entries_pass_sale_key ON ledger_entries (pass_id, reason)
  WHERE reason IN ('pass_sale', 'pass_payment');
CREATE INDEX ledger_entries_client_idx ON ledger_entries (business_id, client_id, account, created_at);
CREATE INDEX ledger_entries_money_idx ON ledger_entries (business_id, created_at) WHERE account = 'money';

-- Corrections are new entries; entries go away only with their client or business.
CREATE FUNCTION ledger_entries_append_only() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
  BEGIN
    IF TG_OP = 'UPDATE' OR pg_trigger_depth() = 1 THEN
      RAISE EXCEPTION 'Ledger entries are append-only' USING ERRCODE = 'integrity_constraint_violation';
    END IF;
    RETURN OLD;
  END
  $$;
CREATE TRIGGER ledger_entries_append_only BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only();

-- Waitlist: one client at a time ---------------------------------------------------------------
CREATE TABLE waitlist_offers (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  entry_id uuid NOT NULL,
  -- The held booking that keeps the time for the client while the offer waits.
  booking_id uuid NOT NULL,
  starts_at timestamptz NOT NULL,
  status waitlist_offer_status NOT NULL,
  created_at timestamptz NOT NULL,
  responded_at timestamptz,
  CHECK ((status = 'pending') = (responded_at IS NULL)),
  UNIQUE (business_id, id),
  -- A time a client let pass goes to the next in line, never back to them.
  UNIQUE (entry_id, starts_at),
  FOREIGN KEY (business_id, entry_id) REFERENCES waitlist_entries (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, booking_id) REFERENCES bookings (business_id, id) ON DELETE CASCADE
);
CREATE UNIQUE INDEX waitlist_offers_pending_key ON waitlist_offers (entry_id) WHERE status = 'pending';
CREATE INDEX waitlist_offers_booking_idx ON waitlist_offers (business_id, booking_id);

-- Payment provider emulator (platform; the provider's side) -------------------------------------
CREATE TABLE test_pay_payments (
  id text PRIMARY KEY CHECK (id ~ '^tp_[A-Za-z0-9_-]{16,64}$'),
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 1 AND 64),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 250),
  return_url text NOT NULL CHECK (char_length(return_url) BETWEEN 1 AND 2000),
  metadata jsonb NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
  status text NOT NULL CHECK (status IN ('pending', 'succeeded', 'cancelled')),
  refunded_minor integer NOT NULL CHECK (refunded_minor >= 0 AND refunded_minor <= amount_minor),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE test_pay_refunds (
  id text PRIMARY KEY CHECK (id ~ '^tr_[A-Za-z0-9_-]{16,64}$'),
  payment_id text NOT NULL REFERENCES test_pay_payments (id) ON DELETE CASCADE,
  idempotency_key text NOT NULL UNIQUE CHECK (char_length(idempotency_key) BETWEEN 1 AND 64),
  amount_minor integer NOT NULL CHECK (amount_minor > 0),
  created_at timestamptz NOT NULL
);

CREATE TABLE test_pay_events (
  id text PRIMARY KEY CHECK (id ~ '^te_[A-Za-z0-9_-]{16,64}$'),
  payment_id text NOT NULL REFERENCES test_pay_payments (id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('payment.succeeded', 'payment.cancelled', 'refund.succeeded')),
  -- The exact body that is signed and delivered.
  body text NOT NULL,
  attempts integer NOT NULL CHECK (attempts >= 0),
  created_at timestamptz NOT NULL,
  delivered_at timestamptz
);
CREATE INDEX test_pay_events_undelivered_idx ON test_pay_events (created_at) WHERE delivered_at IS NULL;

-- Row-level security ---------------------------------------------------------------------------
DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'staff_absences', 'service_incompatibilities', 'client_notes', 'loyalty_programs',
    'pass_plans', 'pass_plan_services', 'client_passes', 'client_pass_services', 'payments',
    'ledger_entries', 'waitlist_offers'
  ] LOOP
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
DROP TABLE IF EXISTS test_pay_events, test_pay_refunds, test_pay_payments, waitlist_offers,
  ledger_entries, payment_webhook_events, payments, client_pass_services, client_passes,
  pass_plan_services, pass_plans, loyalty_programs, service_incompatibilities, staff_absences;
DROP FUNCTION IF EXISTS ledger_entries_append_only();
DROP FUNCTION IF EXISTS pending_payment_refunds(integer);
ALTER TABLE clients ADD COLUMN notes text CHECK (notes IS NULL OR char_length(notes) <= 2000);
UPDATE clients c SET notes = (
  SELECT left(string_agg(n.body, E'\\n' ORDER BY n.created_at), 2000)
  FROM client_notes n WHERE n.client_id = c.id
);
DROP TABLE IF EXISTS client_notes;
DROP INDEX IF EXISTS clients_phone_trgm_idx;
ALTER TABLE clients DROP COLUMN IF EXISTS email;
ALTER TABLE clients DROP COLUMN IF EXISTS tags;
DROP FUNCTION IF EXISTS valid_client_tags(text[]);
ALTER TABLE services DROP COLUMN IF EXISTS deposit_percent;
DROP FUNCTION IF EXISTS expired_booking_holds(timestamptz, integer);
ALTER TABLE booking_events DROP CONSTRAINT IF EXISTS booking_events_actor_user;
ALTER TABLE booking_events DROP COLUMN IF EXISTS actor_user_id;
ALTER TABLE booking_events DROP CONSTRAINT IF EXISTS booking_events_previous_staff;
ALTER TABLE booking_events DROP CONSTRAINT IF EXISTS booking_events_previous_staff_fk;
ALTER TABLE booking_events DROP COLUMN IF EXISTS previous_staff_id;
DELETE FROM bookings WHERE status = 'held';
ALTER TABLE booking_items DROP CONSTRAINT booking_items_staff_no_overlap;
ALTER TABLE booking_items DROP CONSTRAINT booking_items_resource_no_overlap;
ALTER TABLE booking_items ADD CONSTRAINT booking_items_staff_no_overlap EXCLUDE USING gist (
  staff_id WITH =,
  occupied WITH &&
) WHERE (status IN ('confirmed', 'completed', 'no_show'));
ALTER TABLE booking_items ADD CONSTRAINT booking_items_resource_no_overlap EXCLUDE USING gist (
  resource_id WITH =,
  occupied WITH &&
) WHERE (resource_id IS NOT NULL AND status IN ('confirmed', 'completed', 'no_show'));
ALTER TABLE bookings DROP COLUMN IF EXISTS deposit_minor;
DROP INDEX IF EXISTS bookings_hold_expiry_idx;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_hold;
ALTER TABLE bookings DROP COLUMN IF EXISTS hold_expires_at;
ALTER TABLE bookings DROP COLUMN IF EXISTS hold_reason;
DROP TYPE IF EXISTS waitlist_offer_status, payment_status, ledger_reason, ledger_account,
  absence_kind, hold_reason;
`);

export const businessOperationsMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await up.execute(db);
  },
  async down(db: Kysely<unknown>): Promise<void> {
    await down.execute(db);
  },
};
