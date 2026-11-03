#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ "$#" -ne 2 ]; then
  echo "Upotreba: ./scripts/restore.sh backups/ponudimi-db-DATUM.sql backups/ponudimi-fotografije-DATUM.tar.gz" >&2
  echo "Vraćanje baze radi se u postojeću bazu; koristi samo kada znaš da želiš da je zameniš/obnoviš." >&2
  exit 2
fi
DB_FILE="$1"
FILES_FILE="$2"
[ -f "$DB_FILE" ] || { echo "SQL backup nije pronađen: $DB_FILE" >&2; exit 1; }
[ -f "$FILES_FILE" ] || { echo "Backup fotografija nije pronađen: $FILES_FILE" >&2; exit 1; }
[ -f .env ] || { echo "Nedostaje .env." >&2; exit 1; }
printf "Ova operacija upisuje podatke u PostgreSQL i dodaje fotografije. Nastaviti? [da/NE] "
read ANSWER
[ "$ANSWER" = "da" ] || { echo "Prekinuto."; exit 1; }
docker compose exec -T db psql -v ON_ERROR_STOP=1 -U ponudimi -d ponudimi < "$DB_FILE"
docker compose run --rm --no-deps -v "$PWD/backups:/backup:ro" --entrypoint sh api -c "tar -xzf '/backup/$(basename "$FILES_FILE")' -C /data/uploads"
echo "Vraćanje je završeno. Proveri platformu i sačuvaj backup pre narednih izmena."
