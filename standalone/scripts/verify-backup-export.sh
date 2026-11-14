#!/usr/bin/env bash
set -euo pipefail

export ENABLE_ADMIN_BACKUP_EXPORT=true
export ENABLE_ADMIN_BACKUP_IMPORT=true

COMPOSE=(docker compose --env-file standalone/.env.example -f standalone/docker-compose.yml)
WORK_DIR="${RUNNER_TEMP:-/tmp}"
ZIP_FILE="$WORK_DIR/ponudimi-backup-ci.zip"
HEADERS_FILE="$WORK_DIR/ponudimi-backup-ci.headers"
DUMP_FILE="$WORK_DIR/ponudimi-backup-ci.dump"
IMPORT_BODY="$WORK_DIR/ponudimi-backup-import-response.json"
RESTORE_DB="ponudimi_restore_test"
ADMIN_ID="11111111-1111-4111-8111-111111111111"
OFFER_ID="22222222-2222-4222-8222-222222222222"
PRODUCT_ID="33333333-3333-4333-8333-333333333333"
IMAGE_ID="44444444-4444-4444-8444-444444444444"
ADMIN_EMAIL="backup-ci@example.test"

cleanup() {
  "${COMPOSE[@]}" exec -T db dropdb --if-exists -U ponudimi "$RESTORE_DB" >/dev/null 2>&1 || true
  rm -f "$ZIP_FILE" "$HEADERS_FILE" "$DUMP_FILE" "$IMPORT_BODY"
}
trap cleanup EXIT

echo "Seeding isolated backup test records..."
"${COMPOSE[@]}" exec -T db psql -U ponudimi -d ponudimi -v ON_ERROR_STOP=1 <<SQL
INSERT INTO users(id,email,password_hash,metadata)
VALUES ('$ADMIN_ID','$ADMIN_EMAIL','ci-only-not-a-real-password-hash','{}'::jsonb)
ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,password_hash=EXCLUDED.password_hash;
INSERT INTO user_roles(user_id,role)
VALUES ('$ADMIN_ID','admin')
ON CONFLICT(user_id,role) DO NOTHING;
INSERT INTO ponude(id,naslov,kategorija,lokacija,user_id)
VALUES ('$OFFER_ID','PonudiMi backup CI test','Ostalo','CI test','$ADMIN_ID')
ON CONFLICT(id) DO NOTHING;
INSERT INTO storage_objects(object_key,content_type,body)
VALUES ('backup-ci/photo.bin','application/octet-stream',decode('504f4e5544494d49','hex'))
ON CONFLICT(object_key) DO UPDATE SET body=EXCLUDED.body,content_type=EXCLUDED.content_type;
INSERT INTO business_catalog_products(id,user_id,sifra,naziv,kategorija)
VALUES ('$PRODUCT_ID','$ADMIN_ID','BACKUP-CI','PonudiMi backup test proizvod','Test')
ON CONFLICT(user_id,sifra) DO UPDATE SET naziv=EXCLUDED.naziv,kategorija=EXCLUDED.kategorija;
INSERT INTO business_catalog_product_images(id,product_id,storage_path,pozicija)
SELECT '$IMAGE_ID', '$PRODUCT_ID', 'backup-ci/photo.bin', 0
WHERE NOT EXISTS (
  SELECT 1 FROM business_catalog_product_images
  WHERE product_id='$PRODUCT_ID' AND storage_path='backup-ci/photo.bin'
);
SQL

TOKEN=$("${COMPOSE[@]}" exec -T api node -e "const jwt=require('jsonwebtoken');process.stdout.write(jwt.sign({sub:'$ADMIN_ID',email:'$ADMIN_EMAIL',role:'authenticated'},process.env.JWT_SECRET,{expiresIn:'5m'}))")
test -n "$TOKEN"

echo "Requesting protected ZIP export..."
curl --connect-timeout 5 --max-time 180 -fsS \
  -D "$HEADERS_FILE" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost/api/admin/backup/export \
  -o "$ZIP_FILE"

grep -qi '^content-type: application/zip' "$HEADERS_FILE"
test "$(stat -c '%s' "$ZIP_FILE")" -ge 1024
unzip -tqq "$ZIP_FILE"
unzip -l "$ZIP_FILE" | grep -Fq 'database/ponudimi-database.dump'
unzip -l "$ZIP_FILE" | grep -Fq 'application/standalone/api/business-catalog.mjs'
unzip -l "$ZIP_FILE" | grep -Fq 'BACKUP-MANIFEST.json'
unzip -l "$ZIP_FILE" | grep -Fq 'storage/s3-index.json'
if unzip -Z1 "$ZIP_FILE" | grep -Eq '(^|/)\.env([^/]*)(/|$)'; then
  echo "Backup ZIP unexpectedly contains an .env file." >&2
  exit 1
fi
unzip -p "$ZIP_FILE" BACKUP-MANIFEST.json | grep -q '"backend": "postgres"'

unzip -p "$ZIP_FILE" database/ponudimi-database.dump > "$DUMP_FILE"
test -s "$DUMP_FILE"
"${COMPOSE[@]}" exec -T api pg_restore --list < "$DUMP_FILE" > "$WORK_DIR/ponudimi-backup-ci-toc.txt"
grep -q 'business_catalog_products' "$WORK_DIR/ponudimi-backup-ci-toc.txt"

echo "Restoring dump into a separate empty PostgreSQL database..."
"${COMPOSE[@]}" exec -T db dropdb --if-exists -U ponudimi "$RESTORE_DB"
"${COMPOSE[@]}" exec -T db createdb -U ponudimi -O ponudimi "$RESTORE_DB"
SOURCE_DATABASE_URL=$("${COMPOSE[@]}" exec -T api node -e "process.stdout.write(process.env.DATABASE_URL)")
TARGET_DATABASE_URL=$(node -e "const u=new URL(process.argv[1]);u.pathname='/$RESTORE_DB';process.stdout.write(u.toString())" "$SOURCE_DATABASE_URL")
unzip -p "$ZIP_FILE" database/ponudimi-database.dump | \
  "${COMPOSE[@]}" exec -T api pg_restore --no-owner --no-acl --single-transaction --exit-on-error --dbname "$TARGET_DATABASE_URL"

QUERY="SELECT
  (SELECT count(*) FROM users WHERE id='$ADMIN_ID') || ':' ||
  (SELECT count(*) FROM ponude WHERE id='$OFFER_ID') || ':' ||
  (SELECT count(*) FROM storage_objects WHERE object_key='backup-ci/photo.bin' AND body=decode('504f4e5544494d49','hex')) || ':' ||
  (SELECT count(*) FROM business_catalog_products WHERE id='$PRODUCT_ID' AND sifra='BACKUP-CI') || ':' ||
  (SELECT count(*) FROM business_catalog_product_images WHERE id='$IMAGE_ID' AND storage_path='backup-ci/photo.bin');"
SOURCE_COUNTS=$("${COMPOSE[@]}" exec -T api psql "$SOURCE_DATABASE_URL" -Atc "$QUERY")
TARGET_COUNTS=$("${COMPOSE[@]}" exec -T api psql "$TARGET_DATABASE_URL" -Atc "$QUERY")
test "$SOURCE_COUNTS" = "1:1:1:1:1"
test "$TARGET_COUNTS" = "$SOURCE_COUNTS"

echo "Checking that import refuses to overwrite a populated database..."
IMPORT_STATUS=$(curl --connect-timeout 5 --max-time 60 -sS \
  -o "$IMPORT_BODY" -w '%{http_code}' \
  -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -F "backup=@$ZIP_FILE;type=application/zip" \
  http://localhost/api/admin/backup/import)
test "$IMPORT_STATUS" = "409"
grep -q 'ciljna baza već sadrži zapise' "$IMPORT_BODY"
AFTER_IMPORT_COUNTS=$("${COMPOSE[@]}" exec -T api psql "$SOURCE_DATABASE_URL" -Atc "$QUERY")
test "$AFTER_IMPORT_COUNTS" = "$SOURCE_COUNTS"

echo "Checking per-admin export rate limit..."
SECOND_STATUS=$(curl --connect-timeout 5 --max-time 180 -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" http://localhost/api/admin/backup/export)
test "$SECOND_STATUS" = "200"
THIRD_STATUS=$(curl --connect-timeout 5 --max-time 30 -sS -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" http://localhost/api/admin/backup/export)
test "$THIRD_STATUS" = "429"

rm -f "$WORK_DIR/ponudimi-backup-ci-toc.txt"
echo "Backup export, ZIP integrity, PostgreSQL restore, storage/catalog preservation, import safety and rate-limit checks passed."
