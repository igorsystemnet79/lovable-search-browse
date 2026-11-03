#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then echo "Nedostaje standalone/.env. Prvo pokreni instalaciju." >&2; exit 1; fi
mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"
DB_FILE="backups/ponudimi-db-${STAMP}.sql"
FILES_FILE="backups/ponudimi-fotografije-${STAMP}.tar.gz"
echo "Čuvam PostgreSQL bazu u ${DB_FILE}..."
docker compose exec -T db pg_dump -U ponudimi -d ponudimi --no-owner --no-acl > "$DB_FILE"
echo "Čuvam fotografije u ${FILES_FILE}..."
docker compose run --rm --no-deps -v "$PWD/backups:/backup" --entrypoint sh api -c "tar -czf '/backup/$(basename "$FILES_FILE")' -C /data/uploads ."
echo "Backup je završen. Sačuvaj oba fajla na drugoj lokaciji."
