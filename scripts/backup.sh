#!/usr/bin/env bash
# Logical backup of the Blickling Fieldbook PostgreSQL database.
# Usage: DATABASE_URL=postgres://... ./scripts/backup.sh [output-dir]
# Produces a timestamped, compressed custom-format dump suitable for pg_restore.
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set" >&2
  exit 1
fi

OUT_DIR="${1:-backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/fieldbook_${STAMP}.dump"

pg_dump --format=custom --compress=6 --no-owner --no-privileges \
  --file "$FILE" "$DATABASE_URL"

# Verify the archive is readable (structure listing) before declaring success.
pg_restore --list "$FILE" >/dev/null

echo "Backup written and verified: $FILE"
echo "Note: uploaded photographs live in object storage, not the database."
echo "They are retained by the soft-delete policy; verify bucket retention separately."
