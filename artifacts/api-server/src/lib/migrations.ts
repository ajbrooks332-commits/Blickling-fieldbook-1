import { pool } from "@workspace/db";
import { logger } from "./logger";

const statements = [
  `DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('administrator', 'manager', 'team_member');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    CREATE TYPE observation_priority AS ENUM ('low', 'normal', 'high', 'urgent');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    CREATE TYPE observation_status AS ENUM ('draft', 'submitted', 'under_review', 'action_required', 'monitoring', 'resolved', 'closed', 'cancelled');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    CREATE TYPE action_status AS ENUM ('not_started', 'planned', 'in_progress', 'waiting', 'completed', 'cancelled');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN
    CREATE TYPE image_type AS ENUM ('observation', 'progress', 'completion');
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `CREATE TABLE IF NOT EXISTS properties (
    id serial PRIMARY KEY,
    name text NOT NULL,
    description text,
    default_latitude real NOT NULL DEFAULT 52.8406,
    default_longitude real NOT NULL DEFAULT 1.2977,
    default_zoom integer NOT NULL DEFAULT 13,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role user_role NOT NULL DEFAULT 'team_member',
    active boolean NOT NULL DEFAULT true,
    property_id integer REFERENCES properties(id),
    session_version integer NOT NULL DEFAULT 1,
    must_change_password boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    last_login_at timestamp
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id serial PRIMARY KEY,
    property_id integer REFERENCES properties(id),
    name text NOT NULL,
    description text,
    icon text,
    display_colour text,
    sort_order integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS named_locations (
    id serial PRIMARY KEY,
    property_id integer REFERENCES properties(id),
    name text NOT NULL,
    description text,
    latitude real,
    longitude real,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS observations (
    id serial PRIMARY KEY,
    property_id integer REFERENCES properties(id),
    reference_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    category_id integer REFERENCES categories(id),
    priority observation_priority NOT NULL DEFAULT 'normal',
    status observation_status NOT NULL DEFAULT 'submitted',
    observed_at timestamp NOT NULL,
    reported_by_user_id integer REFERENCES users(id),
    latitude real,
    longitude real,
    gps_accuracy_metres real,
    named_location_id integer REFERENCES named_locations(id),
    safety_issue boolean NOT NULL DEFAULT false,
    public_access_affected boolean NOT NULL DEFAULT false,
    machinery_required boolean NOT NULL DEFAULT false,
    specialist_required boolean NOT NULL DEFAULT false,
    follow_up_required boolean NOT NULL DEFAULT false,
    created_offline boolean NOT NULL DEFAULT false,
    offline_id text,
    synced_at timestamp,
    resolved_at timestamp,
    closed_at timestamp,
    deleted_at timestamp,
    deleted_by_user_id integer REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS actions (
    id serial PRIMARY KEY,
    property_id integer REFERENCES properties(id),
    observation_id integer REFERENCES observations(id),
    reference_number text NOT NULL UNIQUE,
    title text NOT NULL,
    description text,
    assigned_to_user_id integer NOT NULL REFERENCES users(id),
    created_by_user_id integer REFERENCES users(id),
    priority observation_priority NOT NULL DEFAULT 'normal',
    status action_status NOT NULL DEFAULT 'not_started',
    due_date timestamp,
    estimated_minutes integer,
    equipment_required boolean NOT NULL DEFAULT false,
    contractor_required boolean NOT NULL DEFAULT false,
    waiting_reason text,
    cancellation_reason text,
    completed_at timestamp,
    completion_note text,
    created_offline boolean NOT NULL DEFAULT false,
    offline_id text,
    synced_at timestamp,
    deleted_at timestamp,
    deleted_by_user_id integer REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS notes (
    id serial PRIMARY KEY,
    observation_id integer REFERENCES observations(id),
    action_id integer REFERENCES actions(id),
    body text NOT NULL,
    offline_id text,
    created_by_user_id integer REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now(),
    CONSTRAINT notes_exactly_one_parent CHECK ((observation_id IS NOT NULL) <> (action_id IS NOT NULL))
  )`,
  `CREATE TABLE IF NOT EXISTS audit_events (
    id serial PRIMARY KEY,
    property_id integer REFERENCES properties(id),
    observation_id integer REFERENCES observations(id),
    action_id integer REFERENCES actions(id),
    user_id integer REFERENCES users(id),
    event_type text NOT NULL,
    field_name text,
    previous_value text,
    new_value text,
    metadata jsonb,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS observation_images (
    id serial PRIMARY KEY,
    observation_id integer NOT NULL REFERENCES observations(id) ON DELETE CASCADE,
    storage_key text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    file_size integer NOT NULL,
    caption text,
    image_type image_type NOT NULL DEFAULT 'observation',
    uploaded_by_user_id integer REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS action_images (
    id serial PRIMARY KEY,
    action_id integer NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
    storage_key text NOT NULL,
    original_filename text NOT NULL,
    mime_type text NOT NULL,
    file_size integer NOT NULL,
    caption text,
    uploaded_by_user_id integer REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS session (
    sid varchar NOT NULL PRIMARY KEY,
    sess json NOT NULL,
    expire timestamp(6) NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS session_expire_idx ON session(expire)`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    setup_completed_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false`,
  `ALTER TABLE observations ADD COLUMN IF NOT EXISTS deleted_at timestamp`,
  `ALTER TABLE observations ADD COLUMN IF NOT EXISTS deleted_by_user_id integer REFERENCES users(id)`,
  `ALTER TABLE observations ADD COLUMN IF NOT EXISTS created_offline boolean NOT NULL DEFAULT false`,
  `ALTER TABLE observations ADD COLUMN IF NOT EXISTS offline_id text`,
  `ALTER TABLE observations ADD COLUMN IF NOT EXISTS synced_at timestamp`,
  `ALTER TABLE actions ADD COLUMN IF NOT EXISTS deleted_at timestamp`,
  `ALTER TABLE actions ADD COLUMN IF NOT EXISTS deleted_by_user_id integer REFERENCES users(id)`,
  `ALTER TABLE actions ADD COLUMN IF NOT EXISTS created_offline boolean NOT NULL DEFAULT false`,
  `ALTER TABLE actions ADD COLUMN IF NOT EXISTS offline_id text`,
  `ALTER TABLE actions ADD COLUMN IF NOT EXISTS synced_at timestamp`,
  `ALTER TABLE notes ADD COLUMN IF NOT EXISTS offline_id text`,
  `CREATE TABLE IF NOT EXISTS upload_grants (
    object_path text PRIMARY KEY,
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    original_filename text NOT NULL,
    expected_mime_type text NOT NULL,
    expected_size integer NOT NULL CHECK (expected_size > 0 AND expected_size <= 10485760),
    expires_at timestamp NOT NULL,
    consumed_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS reference_counters (
    property_id integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    year integer NOT NULL,
    kind text NOT NULL CHECK (kind IN ('observation', 'action')),
    value integer NOT NULL DEFAULT 0,
    PRIMARY KEY (property_id, year, kind)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS observations_property_offline_id_uq
    ON observations(property_id, offline_id) WHERE offline_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS actions_property_offline_id_uq
    ON actions(property_id, offline_id) WHERE offline_id IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS notes_offline_id_uq
    ON notes(offline_id) WHERE offline_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS observations_property_status_created_idx
    ON observations(property_id, status, created_at DESC) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS observations_property_category_idx
    ON observations(property_id, category_id) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS actions_property_status_due_idx
    ON actions(property_id, status, due_date) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS actions_property_assignee_idx
    ON actions(property_id, assigned_to_user_id, status) WHERE deleted_at IS NULL`,
  `CREATE INDEX IF NOT EXISTS audit_events_property_created_idx
    ON audit_events(property_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS upload_grants_expiry_idx ON upload_grants(expires_at)`,
  `CREATE TABLE IF NOT EXISTS activity_types (
    id serial PRIMARY KEY,
    property_id integer REFERENCES properties(id),
    name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS activity_types_property_name_uq
    ON activity_types(property_id, name)`,
  `CREATE TABLE IF NOT EXISTS activity_logs (
    id serial PRIMARY KEY,
    property_id integer NOT NULL REFERENCES properties(id),
    activity_type_id integer NOT NULL REFERENCES activity_types(id),
    named_location_id integer REFERENCES named_locations(id),
    activity_date date NOT NULL,
    duration_minutes integer NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
    notes text,
    recorded_by_user_id integer NOT NULL REFERENCES users(id),
    created_at timestamp NOT NULL DEFAULT now(),
    deleted_at timestamp,
    deleted_by_user_id integer REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS activity_log_participants (
    activity_log_id integer NOT NULL REFERENCES activity_logs(id) ON DELETE CASCADE,
    user_id integer NOT NULL REFERENCES users(id),
    PRIMARY KEY (activity_log_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS activity_logs_property_date_idx
    ON activity_logs(property_id, activity_date DESC) WHERE deleted_at IS NULL`,
  // Self-healing: keep reference counters at least as high as the largest issued reference,
  // so a lost/reset counter can never cause duplicate reference numbers.
  `INSERT INTO reference_counters (property_id, year, kind, value)
    SELECT property_id, split_part(reference_number, '-', 2)::int, 'observation',
           max(split_part(reference_number, '-', 3)::int)
    FROM observations
    WHERE reference_number ~ '^BLK-[0-9]{4}-[0-9]{5}$'
    GROUP BY property_id, split_part(reference_number, '-', 2)::int
    ON CONFLICT (property_id, year, kind)
    DO UPDATE SET value = GREATEST(reference_counters.value, EXCLUDED.value)`,
  `INSERT INTO reference_counters (property_id, year, kind, value)
    SELECT property_id, split_part(reference_number, '-', 2)::int, 'action',
           max(split_part(reference_number, '-', 3)::int)
    FROM actions
    WHERE reference_number ~ '^ACT-[0-9]{4}-[0-9]{5}$'
    GROUP BY property_id, split_part(reference_number, '-', 2)::int
    ON CONFLICT (property_id, year, kind)
    DO UPDATE SET value = GREATEST(reference_counters.value, EXCLUDED.value)`,
];

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(42424242)");
    for (const statement of statements) await client.query(statement);
    await client.query("COMMIT");
    logger.info({ migrations: statements.length }, "Database migrations applied");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ err: error }, "Database migration failed");
    throw error;
  } finally {
    client.release();
  }
}
