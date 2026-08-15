# Blickling Fieldbook — Operations Runbook

Concise operator procedures for backup, restore, rollback, incident response
and recovery objectives. Written for a small estate team; no specialist
infrastructure knowledge assumed beyond running shell commands.

## Recovery objectives

- **RPO (data you can afford to lose):** 24 hours — take a daily backup with
  `scripts/backup.sh`. Offline devices additionally hold unsynced field records
  locally until they sync, which in practice softens data loss for field work.
- **RTO (time to recover):** under 1 hour — restore a logical dump and restart
  the API server.

These are targets to review with the estate team, not certified guarantees.

## Backups

- Command: `DATABASE_URL=... ./scripts/backup.sh [output-dir]`
- Produces a compressed `pg_dump` custom-format archive and **verifies it is
  readable** (`pg_restore --list`) before reporting success.
- Store backups off the application host (e.g. download from the workspace or
  copy into a dedicated bucket). A backup on the same disk as the database is
  not a backup.
- Photographs live in object storage, not PostgreSQL. Image deletion is
  soft-delete only (bytes are retained), so the object bucket plus a database
  dump together restore photo state. Verify bucket retention separately.

### Platform (Replit) backups / point-in-time recovery

The hosted PostgreSQL may offer platform-level restore points. **This could
not be verified from inside the environment** — treat platform PITR as an
EXTERNAL ACTION: confirm with the workspace owner in the Replit database pane
before relying on it. Do not skip logical backups on the assumption it exists.

## Restore

1. Rehearse into a scratch database first (see below). Never rehearse into
   production.
2. Real restore:
   `TARGET_DATABASE_URL=... CONFIRM_RESTORE=yes ./scripts/restore.sh backups/<file>.dump`
3. Restart the API server. Startup runs the migration ledger, which verifies
   checksums and applies any migrations newer than the backup.
4. Sanity-check: log in, open Observations, Tasks, Activities and Reports;
   `GET /api/readyz` must return 200.

### Restore rehearsal (do this quarterly)

```
createdb fieldbook_rehearsal            # or CREATE DATABASE via psql
TARGET_DATABASE_URL=postgres://.../fieldbook_rehearsal \
  CONFIRM_RESTORE=yes ./scripts/restore.sh backups/<latest>.dump
psql postgres://.../fieldbook_rehearsal -c "SELECT count(*) FROM observations"
dropdb fieldbook_rehearsal
```

Record the date and outcome of each rehearsal. A backup that has never been
restored is unproven.

## Rollback (bad release)

1. Application code: redeploy the previous git tag/commit. The migration
   ledger is append-only; migrations are written to be additive
   (columns/tables are added, never dropped), so the previous app version runs
   safely against the newer schema.
2. If a migration itself caused the incident: restore the most recent backup
   taken before the release (accepting the RPO gap) and redeploy the previous
   code version.
3. Never edit an applied migration — startup fails loudly on checksum
   mismatch by design.

## Session revocation & account recovery

- **Disable a user / lost phone:** an administrator sets the user inactive in
  Users. This bumps the user's session version and deletes their sessions —
  all logged-in devices are signed out immediately. The PWA's offline lease
  expires within 8 hours and locally cached data on the device is wiped when
  the lease lapses or sign-in fails.
- **Password reset:** an administrator sets a temporary password (Users →
  edit). The account is forced to change it at next login and all existing
  sessions are revoked.
- **Suspected credential compromise:** disable the account first (revokes
  sessions), investigate `audit_events` (`auth_failure`, `auth_login`), then
  re-enable with a new temporary password.

## Incident response (checklist)

1. **Triage:** `GET /api/healthz` (process up?) then `GET /api/readyz`
   (database reachable?). Check deployment logs for `request errored` entries
   with request ids.
2. **Contain:** if data corruption is suspected, take an immediate backup
   *before* any fix — even corrupt state is evidence and may hold recent work.
3. **Investigate:** structured logs (pino JSON) include request ids and error
   stacks but no passwords, session values or image bytes. `audit_events`
   records who did what and when.
4. **Recover:** fix forward for code bugs; restore per above for data loss.
5. **Record:** date, symptom, cause, fix, and any follow-up in the project
   log. Review whether RPO/RTO held.

## Routine checks

- Weekly: confirm the latest backup file exists and `pg_restore --list` reads it.
- After every deploy: run `./scripts/edge-smoke-test.sh <https-origin>` to
  verify security headers, health endpoints and cross-origin POST rejection at
  the real public edge.
- Quarterly: restore rehearsal (above) and a user-access review (deactivate
  leavers; check administrator list is current).
