# Privremeni administratorski izvoz PonudiMi

Ovaj endpoint je namenjen jednokratnom prenosu postojeće Render instalacije na sopstveni server.

## Bezbednosni uslovi
- Dostupan je samo prijavljenom administratoru (auth + postojeća admin provera).
- Isključen je dok se u Render Environment ne postavi ENABLE_ADMIN_BACKUP_EXPORT=true.
- Ograničen je na najviše dva izvoza u satu.
- ZIP sadrži PostgreSQL SQL dump, lokalne upload datoteke, R2 objekte (ako je R2 podešen), aplikacioni izvor kada je dostupan i manifest.
- Arhiva sadrži lične podatke i heširane lozinke. Čuvati je privatno.

## Preduslov na Render API servisu
Na sistemu mora biti dostupan pg_dump (PostgreSQL client tools). Endpoint vraća HTTP 503 i ne pravi nepotpunu kopiju ako alat nije instaliran. Verziju alata treba uskladiti sa glavnom verzijom PostgreSQL servera.

Za Docker Alpine image dodati u Dockerfile:
```dockerfile
RUN apk add --no-cache postgresql-client
```

Za Render Native Node servis obezbediti PostgreSQL client tools u build/runtime okruženju pre korišćenja endpointa.

## Postupak izvoza
1. Proveriti da je administrator uspešno prijavljen u PonudiMi.
2. U Render Environment privremeno dodati ENABLE_ADMIN_BACKUP_EXPORT=true.
3. Sačekati uspešan deploy/restart API servisa.
4. Pozvati GET /api/admin/backup/export sa važećim Bearer tokenom administratora. Endpoint vraća ZIP direktno; UI dugme za preuzimanje može se dodati naknadno.
5. Proveriti BACKUP-MANIFEST.json, SQL dump, application/, uploads/ i eventualni r2-index.json / r2/objects/.
6. Odmah ukloniti promenljivu ili postaviti ENABLE_ADMIN_BACKUP_EXPORT=false i restartovati servis.

## Vraćanje
- Napraviti praznu PostgreSQL bazu odgovarajuće podržane verzije.
- Vratiti SQL komandom: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/ponudimi.sql
- Vratiti uploads/ u podešeni UPLOAD_DIR.
- Ako je korišćen R2, vratiti svaki objekat iz r2/objects/ na originalni ključ prema r2-index.json.
- Aplikacioni izvor je u application/; instalaciono uputstvo ostaje u standalone dokumentaciji.

## Ograničenja i provera
Ovaj endpoint ne menja niti briše podatke u izvornoj bazi. Izvoz se smatra potpunim tek kada ZIP može da se otvori, manifest odgovara sadržaju i SQL može da se učita u privremenu test bazu. Samo uspešno preuzimanje ZIP-a nije dokaz da je restore uspešan.
