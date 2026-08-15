#!/usr/bin/env bash
# Restore a Blickling Fieldbook backup into a target database.
# Usage: TARGET_DATABASE_URL=postgres://... ./scripts/restore.sh backups/fieldbook_YYYYMMDDTHHMMSSZ.dump
#
# SAFETY: this replaces the contents of the target database. For a restore
# rehearsal, always point TARGET_DATABASE_URL at a scratch database first.
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
