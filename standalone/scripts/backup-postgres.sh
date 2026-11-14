#!/usr/bin/env bash
set -Eeuo pipefail

# Exportuje kompletnu PostgreSQL bazu (šema + podaci + storage_objects fotografije).
# Potrebno: PostgreSQL 18 client tools (pg_dump, pg_restore), DATABASE_URL i SSL po potrebi.

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "Greška: postavi DATABASE_URL na eksterni PostgreSQL URL." >&2
  exit 1
fi
command -v pg_dump >/dev/null || { echo "Nedostaje pg_dump. Instaliraj PostgreSQL 18 client tools." >&2; exit 1; }
command -v pg_restore >/dev/null || { echo "Nedostaje pg_restore. Instaliraj PostgreSQL 18 client tools." >&2; exit 1; }

BACKUP_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/ponudimi-postgres-$STAMP.dump"

echo "Pravim rezervnu kopiju baze..."
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-privileges --verbose --file="$OUT"

echo "Proveravam integritet arhive..."
pg_restore --list "$OUT" >/dev/null
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$OUT" > "$OUT.sha256"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$OUT" > "$OUT.sha256"
fi

echo "Rezervna kopija je napravljena:"
echo "$OUT"
ls -lh "$OUT"
