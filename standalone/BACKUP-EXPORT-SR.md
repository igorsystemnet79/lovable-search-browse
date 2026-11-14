# Privremeni administratorski izvoz PonudiMi

API endpoint: GET /api/admin/backup/export

## Zaštita
- Zahteva važeću prijavu i postojeću administratorsku ulogu.
- Isključen je po podrazumevanom podešavanju. Privremeno ga uključuje samo promenljiva ENABLE_ADMIN_BACKUP_EXPORT=true.
- Ograničenje: najviše dva izvoza u jednom satu.
- Izvorna baza se samo čita; izvoz ne briše i ne menja postojeće podatke.
- ZIP sadrži lične podatke i heširane lozinke. Čuvati privatno.

## Preduslov
Na Render API servisu mora postojati pg_dump (PostgreSQL client tools). Endpoint vraća HTTP 503 i ne pravi nepotpun ZIP ako alat nije dostupan. Verzija pg_dump treba da odgovara glavnoj verziji PostgreSQL servera.

Za Docker Alpine image dodati:
```dockerfile
RUN apk add --no-cache postgresql-client
```

Render servis PonudiMi-Test-API trenutno koristi Native Node runtime i build komandu `cd standalone/api && npm install`. Pre aktiviranja endpointa treba obezbediti pg_dump u tom runtime okruženju. Nemoj menjati postojeće DATABASE_URL ili druge tajne.

## Sadržaj ZIP-a
- database/ponudimi.sql — pg_dump SQL sa šemama, tabelama, sekvencama, funkcijama i podacima dostupnim DB korisniku.
- application/ — izvorni kod repozitorijuma, bez .git, node_modules, backup foldera i svih .env fajlova.
- uploads/ — lokalne upload datoteke ako postoje.
- PostgreSQL storage_objects fotografije su u SQL dump-u.
- r2/objects/ i r2-index.json — R2 objekti i mapa originalnih ključeva ako je R2 uključen.
- BACKUP-MANIFEST.json i RESTORE-INSTRUCTIONS.txt.

## Izvoz
1. Administrator se prijavi u PonudiMi i dobije važeći Bearer token.
2. U Render Environment privremeno postavi ENABLE_ADMIN_BACKUP_EXPORT=true.
3. Sačekaj restart/deploy API servisa.
4. U administratorskom panelu otvori karticu „Izvoz baze“ i pritisni „Preuzmi kompletnu ZIP kopiju“. Dugme šalje važeći Bearer token i pokreće preuzimanje na telefonu ili računaru.
5. Proveri manifest i sve očekivane direktorijume.
6. Odmah ukloni ENABLE_ADMIN_BACKUP_EXPORT ili ga postavi na false i restartuj servis.

## Vraćanje
1. Napravi praznu PostgreSQL bazu kompatibilne verzije.
2. Učitaj SQL: `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/ponudimi.sql`.
3. Kopiraj uploads/ u podešeni UPLOAD_DIR ako je korišćeno lokalno skladište.
4. Za R2 vrati svaki objekat na originalni ključ prema r2-index.json.
5. Proveri vraćanje u privremenoj test instalaciji pre prebacivanja javnog domena.

## Status
Ovo je početna implementacija. Preuzimanje i vraćanje ZIP-a još nisu end-to-end testirani na stvarnoj Render bazi. Potpunost se potvrđuje tek nakon uspešnog SQL restore testa i provere fotografija/kataloga.
