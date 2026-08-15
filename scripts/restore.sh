#!/usr/bin/env bash
# Restore a Blickling Fieldbook backup into a target database.
# Usage: TARGET_DATABASE_URL=postgres://... ./scripts/restore.sh backups/fieldbook_YYYYMMDDTHHMMSSZ.dump
#
# SAFETY: restore into a FRESHLY CREATED, EMPTY database and repoint the app.
# `pg_restore --clean` only drops objects that exist in the archive — tables
# created after the backup was taken would survive a restore into a live
# database and can break later migrations or retain data that should be gone.
# Recreate the target first (e.g. `dropdb`/`createdb` or DROP/CREATE DATABASE).
set -euo pipefail

FILE="${1:?Usage: restore.sh <dump-file>}"
if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "TARGET_DATABASE_URL must be set (deliberately distinct from DATABASE_URL to avoid accidents)" >&2
  exit 1
fi
if [[ "${CONFIRM_RESTORE:-}" != "yes" ]]; then
  echo "Set CONFIRM_RESTORE=yes to confirm you intend to overwrite the target database." >&2
  exit 1
fi

pg_restore --clean --if-exists --no-owner --no-privileges \
  --dbname "$TARGET_DATABASE_URL" "$FILE"

echo "Restore complete from $FILE"
echo "Now start the API server against the target database; the migration ledger"
echo "will verify checksums and apply anything newer than the backup."
