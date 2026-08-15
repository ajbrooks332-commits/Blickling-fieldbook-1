import { createHash } from "node:crypto";
import { pool } from "@workspace/db";
import { logger } from "./logger";

// Ordered migration ledger. Each entry is applied exactly once and its
// checksum is recorded in schema_migrations. NEVER edit or reorder an entry
// after it has shipped — append a new one instead; startup fails loudly on a
// checksum mismatch. (Entries remain individually idempotent, which lets an
// existing pre-ledger database baseline itself safely on first ledger run.)
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
  `ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS category text`,
  // Categorise the built-in activity types (only where not already set by a manager).
  `UPDATE activity_types SET category = CASE name
      WHEN 'Strimming' THEN 'Grassland management'
      WHEN 'Mowing' THEN 'Grassland management'
      WHEN 'Hedge cutting' THEN 'Hedgerow management'
      WHEN 'Tree work' THEN 'Tree safety'
      WHEN 'Chipping' THEN 'Woodland management'
      WHEN 'Fencing' THEN 'Estate maintenance'
      WHEN 'Path maintenance' THEN 'Access & paths'
      WHEN 'Litter picking' THEN 'Visitor & site care'
      WHEN 'Planting' THEN 'Planting & establishment'
      WHEN 'Watering' THEN 'Planting & establishment'
      WHEN 'Machinery maintenance' THEN 'Machinery & equipment'
      WHEN 'Patrol / inspection' THEN 'Patrols & inspections'
      WHEN 'Visitor support' THEN 'Visitor & site care'
      ELSE 'Other'
    END
    WHERE category IS NULL`,
  // Reconcile case-variant duplicate activity types (e.g. "Strimming" vs "strimming"):
  // repoint logs at the canonical (lowest-id) row, then drop the duplicates, then
  // enforce case-insensitive uniqueness so the API can rely on it.
  `UPDATE activity_logs SET activity_type_id = canon.id
    FROM activity_types dupe
    JOIN (SELECT property_id, lower(name) AS lname, min(id) AS id
          FROM activity_types GROUP BY property_id, lower(name)) canon
      ON canon.property_id = dupe.property_id AND canon.lname = lower(dupe.name)
    WHERE activity_logs.activity_type_id = dupe.id AND dupe.id <> canon.id`,
  // If any case-variant duplicate was active, keep the canonical row active.
  `UPDATE activity_types SET active = true
    FROM (SELECT property_id, lower(name) AS lname, min(id) AS id, bool_or(active) AS any_active
          FROM activity_types GROUP BY property_id, lower(name)) canon
    WHERE activity_types.id = canon.id AND canon.any_active AND NOT activity_types.active`,
  `DELETE FROM activity_types dupe
    USING (SELECT property_id, lower(name) AS lname, min(id) AS id
           FROM activity_types GROUP BY property_id, lower(name)) canon
    WHERE canon.property_id = dupe.property_id AND canon.lname = lower(dupe.name) AND dupe.id <> canon.id`,
  `CREATE UNIQUE INDEX IF NOT EXISTS activity_types_property_lower_name_uq
    ON activity_types(property_id, lower(name))`,
  `CREATE TABLE IF NOT EXISTS activity_log_locations (
    activity_log_id integer NOT NULL REFERENCES activity_logs(id) ON DELETE CASCADE,
    named_location_id integer NOT NULL REFERENCES named_locations(id),
    PRIMARY KEY (activity_log_id, named_location_id)
  )`,
  // Backfill: activities recorded with the old single-location column get a junction row.
  `INSERT INTO activity_log_locations (activity_log_id, named_location_id)
    SELECT id, named_location_id FROM activity_logs
    WHERE named_location_id IS NOT NULL
    ON CONFLICT DO NOTHING`,
  `ALTER TABLE actions ADD COLUMN IF NOT EXISTS named_location_id integer REFERENCES named_locations(id)`,
  // Reconcile case-variant duplicate named locations, then enforce case-insensitive
  // uniqueness so quick-add from the activity tracker is race-safe.
  `UPDATE observations SET named_location_id = canon.id
    FROM named_locations dupe
    JOIN (SELECT property_id, lower(name) AS lname, min(id) AS id
          FROM named_locations GROUP BY property_id, lower(name)) canon
      ON canon.property_id = dupe.property_id AND canon.lname = lower(dupe.name)
    WHERE observations.named_location_id = dupe.id AND dupe.id <> canon.id`,
  `UPDATE activity_logs SET named_location_id = canon.id
    FROM named_locations dupe
    JOIN (SELECT property_id, lower(name) AS lname, min(id) AS id
          FROM named_locations GROUP BY property_id, lower(name)) canon
      ON canon.property_id = dupe.property_id AND canon.lname = lower(dupe.name)
    WHERE activity_logs.named_location_id = dupe.id AND dupe.id <> canon.id`,
  `UPDATE actions SET named_location_id = canon.id
    FROM named_locations dupe
    JOIN (SELECT property_id, lower(name) AS lname, min(id) AS id
          FROM named_locations GROUP BY property_id, lower(name)) canon
      ON canon.property_id = dupe.property_id AND canon.lname = lower(dupe.name)
    WHERE actions.named_location_id = dupe.id AND dupe.id <> canon.id`,
  `INSERT INTO activity_log_locations (activity_log_id, named_location_id)
    SELECT j.activity_log_id, canon.id
    FROM activity_log_locations j
    JOIN named_locations dupe ON dupe.id = j.named_location_id
    JOIN (SELECT property_id, lower(name) AS lname, min(id) AS id
          FROM named_locations GROUP BY property_id, lower(name)) canon
      ON canon.property_id = dupe.property_id AND canon.lname = lower(dupe.name)
    WHERE dupe.id <> canon.id
    ON CONFLICT DO NOTHING`,
  `DELETE FROM activity_log_locations j
    USING named_locations dupe,
          (SELECT property_id, lower(name) AS lname, min(id) AS id
           FROM named_locations GROUP BY property_id, lower(name)) canon
    WHERE j.named_location_id = dupe.id
      AND canon.property_id = dupe.property_id AND canon.lname = lower(dupe.name)
      AND dupe.id <> canon.id`,
  // If any case-variant duplicate was active, keep the canonical row active.
  `UPDATE named_locations SET active = true
    FROM (SELECT property_id, lower(name) AS lname, min(id) AS id, bool_or(active) AS any_active
          FROM named_locations GROUP BY property_id, lower(name)) canon
    WHERE named_locations.id = canon.id AND canon.any_active AND NOT named_locations.active`,
  `DELETE FROM named_locations dupe
    USING (SELECT property_id, lower(name) AS lname, min(id) AS id
           FROM named_locations GROUP BY property_id, lower(name)) canon
    WHERE canon.property_id = dupe.property_id AND canon.lname = lower(dupe.name) AND dupe.id <> canon.id`,
  `CREATE UNIQUE INDEX IF NOT EXISTS named_locations_property_lower_name_uq
    ON named_locations(property_id, lower(name))`,
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
  // Labour model: keep elapsed duration and person-hours distinguishable.
  // hours_status records how labour is accounted for; missing labour is never
  // silently treated as zero person-hours.
  `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS hours_status text NOT NULL DEFAULT 'elapsed_only'`,
  `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS volunteer_count integer`,
  `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS contractor_minutes integer`,
  `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS contractor_hours_unknown boolean NOT NULL DEFAULT false`,
  // Backfill: rows with selected participants represent staff labour.
  `UPDATE activity_logs SET hours_status = 'staff_participants'
    WHERE hours_status = 'elapsed_only'
      AND EXISTS (SELECT 1 FROM activity_log_participants p WHERE p.activity_log_id = activity_logs.id)`,
  `DO $$ BEGIN
    ALTER TABLE activity_logs ADD CONSTRAINT activity_logs_hours_status_check
      CHECK (hours_status IN ('staff_participants', 'elapsed_only', 'contractor_unknown', 'other_unknown'));
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  // Idempotency key for offline-created activities: replaying the same queued
  // record must never create a duplicate.
  `ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS offline_id text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS activity_logs_offline_id_unique ON activity_logs (offline_id) WHERE offline_id IS NOT NULL`,
  // Per-photo idempotency: retrying a partially-failed queued upload must
  // never attach the same photograph twice.
  `ALTER TABLE observation_images ADD COLUMN IF NOT EXISTS photo_uuid text`,
  `ALTER TABLE action_images ADD COLUMN IF NOT EXISTS photo_uuid text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS observation_images_photo_uuid_uq ON observation_images (photo_uuid) WHERE photo_uuid IS NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS action_images_photo_uuid_uq ON action_images (photo_uuid) WHERE photo_uuid IS NOT NULL`,
  // Keep field-event (observed_at), device-created, server-received
  // (created_at) and sync (synced_at) timestamps separately.
  `ALTER TABLE observations ADD COLUMN IF NOT EXISTS device_created_at timestamp`,
  `ALTER TABLE actions ADD COLUMN IF NOT EXISTS device_created_at timestamp`,
  // Recoverable image deletion: rows are soft-deleted and object bytes are
  // never removed before (or after) the database/audit state commits.
  `ALTER TABLE observation_images ADD COLUMN IF NOT EXISTS deleted_at timestamp`,
  `ALTER TABLE observation_images ADD COLUMN IF NOT EXISTS deleted_by_user_id integer REFERENCES users(id)`,
  `ALTER TABLE action_images ADD COLUMN IF NOT EXISTS deleted_at timestamp`,
  `ALTER TABLE action_images ADD COLUMN IF NOT EXISTS deleted_by_user_id integer REFERENCES users(id)`,
  // Proposal flow for reference data: non-manager quick-adds are flagged as
  // proposals for a manager to review; managers create canonical rows directly.
  `ALTER TABLE activity_types ADD COLUMN IF NOT EXISTS proposed boolean NOT NULL DEFAULT false`,
  `ALTER TABLE named_locations ADD COLUMN IF NOT EXISTS proposed boolean NOT NULL DEFAULT false`,
];

const checksum = (statement: string) => createHash("sha256").update(statement).digest("hex");

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialises concurrent startups: the first process migrates, the rest
    // wait on the lock and then see an up-to-date ledger.
    await client.query("SELECT pg_advisory_xact_lock(42424242)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version integer PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamp NOT NULL DEFAULT now()
    )`);
    const { rows } = await client.query<{ version: number; checksum: string }>(
      "SELECT version, checksum FROM schema_migrations ORDER BY version",
    );
    // Verify the ledger: an edited or reordered historical entry is a
    // deployment error, not something to silently re-run.
    for (const applied of rows) {
      const statement = statements[applied.version - 1];
      if (statement === undefined || checksum(statement) !== applied.checksum) {
        throw new Error(
          `Migration ledger mismatch at version ${applied.version}: a previously applied migration was modified or removed. Append new migrations instead of editing history.`,
        );
      }
    }
    const startFrom = rows.length; // versions are contiguous 1..N
    let appliedNow = 0;
    for (let index = startFrom; index < statements.length; index += 1) {
      await client.query(statements[index]);
      await client.query(
        "INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)",
        [index + 1, checksum(statements[index])],
      );
      appliedNow += 1;
    }
    await client.query("COMMIT");
    logger.info({ total: statements.length, applied: appliedNow }, "Database migrations applied");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error({ err: error }, "Database migration failed");
    throw error;
  } finally {
    client.release();
  }
}

// Exposed for migration tests (pre-change fixture + tamper detection).
export const migrationLedger = { statements, checksum };
