#!/usr/bin/env sh
set -eu
BACKUP_DIR="${BACKUP_DIR:-/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-/uploads}"
DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${POSTGRES_DB:-ponudimi}"
DB_USER="${POSTGRES_USER:-ponudimi}"
mkdir -p "$BACKUP_DIR"
while true; do
  STAMP="$(date -u +%Y%m%d-%H%M%S)"
  DB_TMP="$BACKUP_DIR/.ponudimi-db-$STAMP.sql.tmp"
  FILES_TMP="$BACKUP_DIR/.ponudimi-fotografije-$STAMP.tar.gz.tmp"
  echo "[$(date -u -Iseconds)] Pokrećem dnevni backup..."
  if PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl > "$DB_TMP" &&
     tar -czf "$FILES_TMP" -C "$UPLOAD_DIR" .; then
    mv "$DB_TMP" "$BACKUP_DIR/ponudimi-db-$STAMP.sql"
    mv "$FILES_TMP" "$BACKUP_DIR/ponudimi-fotografije-$STAMP.tar.gz"
    find "$BACKUP_DIR" -type f -name 'ponudimi-*' -mtime +14 -delete
    echo "[$(date -u -Iseconds)] Backup baze i fotografija uspešno završen."
  else
    rm -f "$DB_TMP" "$FILES_TMP"
    echo "[$(date -u -Iseconds)] GREŠKA: dnevni backup nije uspeo." >&2
  fi
  sleep "${BACKUP_INTERVAL_SECONDS:-86400}"
done
