# PonudiMi — rezervna kopija i preseljenje baze

## Šta mora da se sačuva

1. GitHub ZIP aktuelne aplikacije sa grane `main`.
2. PostgreSQL dump napravljen komandom `pg_dump` (sadrži strukturu i podatke).
3. Fotografije:
   - Ako API vraća `storage_backend: postgres`, fotografije u tabeli `storage_objects` ulaze u PostgreSQL dump.
   - Ako API vraća `storage_backend: filesystem`, dodatno arhiviraj sadržaj direktorijuma iz `UPLOAD_DIR`.
   - Ako API vraća `storage_backend: r2`, fotografije su u S3-kompatibilnom bucket-u i moraju se posebno kopirati iz tog bucket-a; sam SQL dump ih ne sadrži.
4. Bezbedna kopija promenljivih okruženja (DATABASE_URL, JWT_SECRET, SMTP i eventualni S3/Google OAuth podaci). Tajne čuvati odvojeno, nikada u javnom ZIP-u ili GitHub repozitorijumu.

## Važno za trenutnu Render bazu

Trenutna baza PonudiMi-Test-Baza je Render Free PostgreSQL, verzija 18. Render Free baze nemaju ugrađene backup-e i ističu 30 dana nakon kreiranja. Ova baza ima datum isteka 3. decembar 2026. godine. Posle isteka je nedostupna; postoji 14 dana za nadogradnju pre brisanja.

Render-ov alat za izvoz u Dashboard-u nije dostupan za Free plan. Potrebno je napraviti logički dump sa `pg_dump`.

## Kako napraviti kopiju sa računara ili novog servera

1. U Render Dashboard-u otvori bazu `PonudiMi-Test-Baza`.
2. U odeljku **Connect** kopiraj **External Database URL**. Ne šalji taj URL nikome i ne upisuj ga u GitHub.
3. U odeljku **Networking / IP allow list** dodaj samo javnu IP adresu računara/servera sa kog ćeš pokrenuti backup, kao CIDR `IP_ADRESA/32`. Ne koristi `0.0.0.0/0`. Kada se backup završi, ukloni privremeni unos.
4. Na računaru/serveru instaliraj PostgreSQL 18 client tools.
5. U terminalu postavi URL kao promenljivu okruženja, uz SSL:
   ```bash
   export DATABASE_URL='postgresql://KORISNIK:LOZINKA@HOST/BAZA?sslmode=require'
   bash standalone/scripts/backup-postgres.sh
   ```
6. Sačuvaj oba fajla iz direktorijuma `backups` (`.dump` i `.dump.sha256`) na telefon i još jednu nezavisnu lokaciju.

**Ne stavljaj URL sa lozinkom u poruku, GitHub, screenshot ili javni dokument.** Ako je URL ikada slučajno podeljen, promeni DB lozinku.

## Fotografije van baze

Proveri `storage_backend` u odgovoru API adrese `/api/health`.

- `postgres`: fotografije su u PostgreSQL tabeli `storage_objects` i uključene su u dump.
- `filesystem`: napravi dodatni arhivski fajl od celog trajnog `UPLOAD_DIR` direktorijuma.
- `r2`: izvezi kompletan S3/R2 bucket uz očuvanje putanja i metapodataka. Ne briši izvorni bucket.

## Vraćanje na novom serveru

1. Napravi novu praznu PostgreSQL 18 bazu.
2. Prenesi dump na novi server.
3. Pokreni:
   ```bash
   TARGET_DATABASE_URL='postgresql://...' CONFIRM_RESTORE=YES \
     bash standalone/scripts/restore-postgres.sh backups/ponudimi-postgres-YYYYMMDDTHHMMSSZ.dump
   ```
4. Postavi API `DATABASE_URL` na novu bazu i vrati iste `JWT_SECRET`, SMTP i druge potrebne promenljive okruženja.
5. Vrati fotografije ako su bile na filesystem-u ili R2.
6. Pokreni platformu i proveri prijavu, registraciju, oglase, zahteve, administraciju, pakete i otvaranje fotografija.
7. Tek nakon uspešne provere menjaj DNS i preusmeri korisnike.

Restore skripta namerno zahteva `CONFIRM_RESTORE=YES` i namenjena je praznoj ciljnoj bazi. Ne koristi je nad bazom koja već sadrži važne podatke.
