import { sql, type Kysely } from 'kysely';

/**
 * Foundation schema: tenants, identities, catalog, schedules and bookings.
 *
 * Tenant tables carry `business_id`, reference each other through composite keys
 * `(business_id, id)` so cross-tenant references are impossible, and are guarded by
 * row-level security bound to the `app.business_id` transaction setting.
 * Double booking is prevented by exclusion constraints on `booking_items.occupied`.
 */
const up = sql.raw(`
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE FUNCTION app_current_business_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.business_id', true), '')::uuid $$;

CREATE TYPE booking_status AS ENUM ('confirmed', 'completed', 'no_show', 'cancelled');
CREATE TYPE booking_source AS ENUM ('telegram_mini_app', 'max_mini_app', 'cabinet', 'widget');
CREATE TYPE membership_role AS ENUM ('owner', 'admin', 'staff');
CREATE TYPE messenger_channel AS ENUM ('telegram', 'max');
CREATE TYPE schedule_pattern_kind AS ENUM ('weekly', 'cycle');
CREATE TYPE schedule_interval_kind AS ENUM ('work', 'break');

-- Platform tables ------------------------------------------------------------

CREATE TABLE businesses (
  id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  vertical_id text NOT NULL CHECK (vertical_id ~ '^[a-z][a-z0-9_]*$'),
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  rules_overrides jsonb NOT NULL CHECK (jsonb_typeof(rules_overrides) = 'object'),
  is_demo boolean NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE user_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CHECK (expires_at > created_at)
);
CREATE INDEX user_sessions_user_idx ON user_sessions (user_id);
CREATE INDEX user_sessions_expiry_idx ON user_sessions (expires_at);

CREATE TABLE customers (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL
);

CREATE TABLE customer_identities (
  channel messenger_channel NOT NULL,
  external_id text NOT NULL CHECK (char_length(external_id) BETWEEN 1 AND 64),
  customer_id uuid NOT NULL REFERENCES customers (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (channel, external_id)
);
CREATE INDEX customer_identities_customer_idx ON customer_identities (customer_id);

CREATE TABLE production_calendar_years (
  country_code text NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  day_kinds text NOT NULL CHECK (day_kinds ~ '^[WNHP]+$' AND char_length(day_kinds) IN (365, 366)),
  source text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  fetched_at timestamptz NOT NULL,
  PRIMARY KEY (country_code, year)
);

-- Tenant tables -----------------------------------------------------------------

CREATE TABLE locations (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  address text NOT NULL CHECK (char_length(address) BETWEEN 1 AND 300),
  time_zone text NOT NULL CHECK (char_length(time_zone) BETWEEN 1 AND 64),
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (business_id, id)
);

CREATE TABLE resources (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  location_id uuid NOT NULL,
  type_id text NOT NULL CHECK (type_id ~ '^[a-z][a-z0-9_]*$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, location_id) REFERENCES locations (business_id, id) ON DELETE CASCADE
);
CREATE INDEX resources_location_idx ON resources (business_id, location_id, type_id);

CREATE TABLE staff_members (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  title text CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 120),
  avatar_seed text NOT NULL CHECK (char_length(avatar_seed) BETWEEN 1 AND 64),
  sort_order integer NOT NULL,
  is_active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (business_id, id)
);

CREATE TABLE memberships (
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role membership_role NOT NULL,
  staff_id uuid,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (business_id, user_id),
  FOREIGN KEY (business_id, staff_id) REFERENCES staff_members (business_id, id) ON DELETE CASCADE,
  CONSTRAINT memberships_staff_profile CHECK (role <> 'staff' OR staff_id IS NOT NULL)
);
CREATE INDEX memberships_user_idx ON memberships (user_id);

CREATE TABLE service_categories (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (business_id, id)
);

CREATE TABLE services (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  category_id uuid NOT NULL,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text CHECK (description IS NULL OR char_length(description) <= 500),
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 720),
  buffer_before_minutes integer NOT NULL CHECK (buffer_before_minutes BETWEEN 0 AND 720),
  buffer_after_minutes integer NOT NULL CHECK (buffer_after_minutes BETWEEN 0 AND 720),
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  resource_type_id text CHECK (resource_type_id IS NULL OR resource_type_id ~ '^[a-z][a-z0-9_]*$'),
  template_key text,
  sort_order integer NOT NULL,
  is_active boolean NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, category_id) REFERENCES service_categories (business_id, id) ON DELETE CASCADE
);

CREATE TABLE staff_services (
  business_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  service_id uuid NOT NULL,
  duration_minutes integer CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 720),
  price_minor integer CHECK (price_minor IS NULL OR price_minor >= 0),
  PRIMARY KEY (staff_id, service_id),
  FOREIGN KEY (business_id, staff_id) REFERENCES staff_members (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, service_id) REFERENCES services (business_id, id) ON DELETE CASCADE
);
CREATE INDEX staff_services_service_idx ON staff_services (service_id);

CREATE TABLE staff_schedules (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  location_id uuid NOT NULL,
  pattern_kind schedule_pattern_kind NOT NULL,
  cycle_length_days integer NOT NULL CHECK (cycle_length_days BETWEEN 1 AND 56),
  anchor_date date,
  valid_from date NOT NULL,
  valid_until date,
  created_at timestamptz NOT NULL,
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CONSTRAINT staff_schedules_pattern_shape CHECK (
    (pattern_kind = 'weekly' AND cycle_length_days = 7 AND anchor_date IS NULL)
    OR (pattern_kind = 'cycle' AND anchor_date IS NOT NULL)
  ),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, staff_id) REFERENCES staff_members (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, location_id) REFERENCES locations (business_id, id) ON DELETE CASCADE,
  -- A person cannot follow two schedules on the same day, in any branch.
  CONSTRAINT staff_schedules_no_overlap EXCLUDE USING gist (
    staff_id WITH =,
    daterange(valid_from, valid_until, '[]') WITH &&
  )
);

CREATE TABLE staff_schedule_intervals (
  business_id uuid NOT NULL,
  schedule_id uuid NOT NULL,
  day_index integer NOT NULL CHECK (day_index BETWEEN 0 AND 55),
  kind schedule_interval_kind NOT NULL,
  start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute integer NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  CHECK (start_minute < end_minute),
  PRIMARY KEY (schedule_id, day_index, kind, start_minute),
  FOREIGN KEY (business_id, schedule_id) REFERENCES staff_schedules (business_id, id) ON DELETE CASCADE
);

CREATE TABLE staff_schedule_overrides (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  on_date date NOT NULL,
  location_id uuid,
  created_at timestamptz NOT NULL,
  UNIQUE (staff_id, on_date),
  UNIQUE (business_id, id),
  FOREIGN KEY (business_id, staff_id) REFERENCES staff_members (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, location_id) REFERENCES locations (business_id, id) ON DELETE CASCADE
);

CREATE TABLE staff_override_intervals (
  business_id uuid NOT NULL,
  override_id uuid NOT NULL,
  kind schedule_interval_kind NOT NULL,
  start_minute integer NOT NULL CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute integer NOT NULL CHECK (end_minute BETWEEN 1 AND 1440),
  CHECK (start_minute < end_minute),
  PRIMARY KEY (override_id, kind, start_minute),
  FOREIGN KEY (business_id, override_id) REFERENCES staff_schedule_overrides (business_id, id) ON DELETE CASCADE
);

CREATE TABLE clients (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers (id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  phone text CHECK (phone IS NULL OR phone ~ '^\\+[1-9][0-9]{6,14}$'),
  notes text CHECK (notes IS NULL OR char_length(notes) <= 2000),
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (business_id, id),
  UNIQUE (business_id, customer_id)
);
CREATE INDEX clients_name_trgm_idx ON clients USING gin (display_name gin_trgm_ops);
CREATE INDEX clients_phone_idx ON clients (business_id, phone);

CREATE TABLE bookings (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  location_id uuid NOT NULL,
  client_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  status booking_status NOT NULL,
  source booking_source NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  total_price_minor integer NOT NULL CHECK (total_price_minor >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  client_comment text CHECK (client_comment IS NULL OR char_length(client_comment) <= 500),
  idempotency_key uuid,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CHECK (ends_at > starts_at),
  UNIQUE (business_id, id),
  UNIQUE (id, status, staff_id),
  CONSTRAINT bookings_idempotency_key UNIQUE (business_id, client_id, idempotency_key),
  FOREIGN KEY (business_id, location_id) REFERENCES locations (business_id, id),
  FOREIGN KEY (business_id, client_id) REFERENCES clients (business_id, id),
  FOREIGN KEY (business_id, staff_id) REFERENCES staff_members (business_id, id)
);
CREATE INDEX bookings_period_idx ON bookings (business_id, starts_at, id);
CREATE INDEX bookings_location_period_idx ON bookings (business_id, location_id, starts_at);
CREATE INDEX bookings_staff_period_idx ON bookings (business_id, staff_id, starts_at);
CREATE INDEX bookings_client_period_idx ON bookings (business_id, client_id, starts_at);

CREATE TABLE booking_items (
  id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  booking_id uuid NOT NULL,
  status booking_status NOT NULL,
  staff_id uuid NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  service_id uuid NOT NULL,
  resource_id uuid,
  service_name text NOT NULL CHECK (char_length(service_name) BETWEEN 1 AND 120),
  duration_minutes integer NOT NULL CHECK (duration_minutes > 0),
  price_minor integer NOT NULL CHECK (price_minor >= 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  occupied tstzrange NOT NULL,
  CHECK (ends_at > starts_at),
  CONSTRAINT booking_items_occupied_bounds CHECK (
    lower_inc(occupied) AND NOT upper_inc(occupied)
    AND NOT lower_inf(occupied) AND NOT upper_inf(occupied)
    AND lower(occupied) <= starts_at AND upper(occupied) >= ends_at
  ),
  UNIQUE (booking_id, position),
  -- Status and staff mirror the booking; the database keeps them in sync.
  FOREIGN KEY (booking_id, status, staff_id) REFERENCES bookings (id, status, staff_id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  FOREIGN KEY (business_id, booking_id) REFERENCES bookings (business_id, id) ON DELETE CASCADE,
  FOREIGN KEY (business_id, service_id) REFERENCES services (business_id, id),
  FOREIGN KEY (business_id, resource_id) REFERENCES resources (business_id, id),
  FOREIGN KEY (business_id, staff_id) REFERENCES staff_members (business_id, id),
  CONSTRAINT booking_items_staff_no_overlap EXCLUDE USING gist (
    staff_id WITH =,
    occupied WITH &&
  ) WHERE (status IN ('confirmed', 'completed', 'no_show')),
  CONSTRAINT booking_items_resource_no_overlap EXCLUDE USING gist (
    resource_id WITH =,
    occupied WITH &&
  ) WHERE (resource_id IS NOT NULL AND status IN ('confirmed', 'completed', 'no_show'))
);
CREATE INDEX booking_items_booking_idx ON booking_items (booking_id);

-- Row-level security ---------------------------------------------------------------

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'locations', 'resources', 'staff_members', 'service_categories', 'services',
    'staff_services', 'staff_schedules', 'staff_schedule_intervals',
    'staff_schedule_overrides', 'staff_override_intervals', 'clients', 'bookings', 'booking_items'
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
DROP TABLE IF EXISTS booking_items, bookings, clients, staff_override_intervals,
  staff_schedule_overrides, staff_schedule_intervals, staff_schedules, staff_services, services,
  service_categories, memberships, staff_members, resources, locations, production_calendar_years,
  customer_identities, customers, user_sessions, users, businesses;
DROP TYPE IF EXISTS schedule_interval_kind, schedule_pattern_kind, messenger_channel,
  membership_role, booking_source, booking_status;
DROP FUNCTION IF EXISTS app_current_business_id();
`);

export const foundationMigration = {
  async up(db: Kysely<unknown>): Promise<void> {
    await up.execute(db);
  },
  async down(db: Kysely<unknown>): Promise<void> {
    await down.execute(db);
  },
};
