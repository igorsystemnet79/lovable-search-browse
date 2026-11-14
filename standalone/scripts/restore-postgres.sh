#!/usr/bin/env bash
set -Eeuo pipefail

# Vraća kopiju u PRAZNU PostgreSQL bazu. Ne pokretati nad bazom sa važnim podacima.
if [[ -z "${TARGET_DATABASE_URL:-}" ]]; then
  echo "Greška: postavi TARGET_DATABASE_URL na ciljnu PostgreSQL bazu." >&2
  exit 1
fi
BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || ! -f "$BACKUP_FILE" ]]; then
  echo "Upotreba: TARGET_DATABASE_URL='postgres://...' $0 putanja/do/ponudimi.dump" >&2
  exit 1
fi
if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then
  echo "Oporavak može promeniti sadržaj ciljne baze."
  echo "Za nastavak ponovi komandu sa CONFIRM_RESTORE=YES."
  exit 1
fi
command -v pg_restore >/dev/null || { echo "Nedostaje pg_restore. Instaliraj PostgreSQL client tools." >&2; exit 1; }
pg_restore --list "$BACKUP_FILE" >/dev/null
echo "Vraćam podatke u ciljnu bazu..."
pg_restore --dbname="$TARGET_DATABASE_URL" --no-owner --no-privileges --exit-on-error "$BACKUP_FILE"
echo "Oporavak baze je završen. Proveri broj korisnika, oglasa i fotografija pre prebacivanja aplikacije."
