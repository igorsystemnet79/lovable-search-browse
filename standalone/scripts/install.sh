#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
command -v docker >/dev/null 2>&1 || { echo "Docker nije instaliran. Instaliraj Docker Engine i Compose v2." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 nije dostupan." >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "OpenSSL je potreban za generisanje sigurnih lozinki." >&2; exit 1; }
if [ -f .env ]; then
  echo "Postojeći .env nije menjan. Proveravam obavezne vrednosti i pokrećem instalaciju."
else
  printf "Domen platforme (npr. ponudimi.rs; za lokalni test unesi :80): "
  read DOMAIN
  DOMAIN=${DOMAIN:-:80}
  case "$DOMAIN" in :80|localhost) ;; *[!A-Za-z0-9.-]*|"") echo "Domen sadrži nedozvoljene znakove." >&2; exit 1 ;; esac
  printf "Email adresa za administratorski nalog (uloga se dodeljuje ručno na serveru): "
  read ADMIN_EMAIL
  case "$ADMIN_EMAIL" in *@*.*) ;; *) echo "Unesi ispravnu email adresu administratora." >&2; exit 1 ;; esac
  if [ "$DOMAIN" = ":80" ] || [ "$DOMAIN" = "localhost" ]; then PUBLIC_APP_URL="http://localhost"; DOMAIN=":80"; else PUBLIC_APP_URL="https://${DOMAIN}"; fi
  POSTGRES_PASSWORD="$(openssl rand -hex 32)"
  JWT_SECRET="$(openssl rand -hex 48)"
  cat > .env <<ENV
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
ADMIN_EMAIL=${ADMIN_EMAIL}
DOMAIN=${DOMAIN}
PUBLIC_APP_URL=${PUBLIC_APP_URL}
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
APR_API_URL=
APR_API_KEY=
ENV
  chmod 600 .env
  echo "Kreirana je konfiguracija .env sa novim tajnama."
fi
echo "Pokrećem PonudiMi servise. Prvo pokretanje može potrajati zbog preuzimanja Docker image-a i izgradnje aplikacije."
docker compose up -d --build
echo "Instalacija je pokrenuta. Prvo registruj nalog sa adresom iz ADMIN_EMAIL, pa mu dodeli admin prava komandom: docker compose exec api node grant-admin.mjs ADRESA_IZ_ADMIN_EMAIL"
echo "Status proveri komandom: docker compose ps"
