# PonudiMi — samostalna instalacija

Ovaj paket pokreće frontend, sopstveni API, PostgreSQL i trajno čuvanje fotografija. Aplikacija ne zahteva nalog na spoljašnjoj BaaS platformi niti Lovable Cloud. Postojeći React interfejs, rute i stilovi ostaju osnova platforme; podaci se čuvaju na serveru.

## Potrebno

- Linux VPS ili drugi server sa Docker Engine i Docker Compose v2
- preporučeno najmanje 2 CPU jezgra, 4 GB RAM i dovoljno trajnog diska
- domen usmeren na IP servera za automatski HTTPS; za lokalno testiranje može `localhost`
- otvoreni portovi 80 i 443 (HTTPS)

## Instalacija

1. Raspakuj ZIP na server.
2. Uđi u direktorijum `standalone`.
3. Pokreni `./scripts/install.sh`. Skripta proverava Docker Compose, traži domen i email prvog administratora, automatski generiše jake tajne i pokreće servise.
4. Za lokalni test unesi `:80` i otvori `http://localhost`. Za javnu instalaciju unesi svoj domen (npr. `ponudimi.rs`), usmeri DNS na server i otvori `https://TVOJ-DOMEN`.
5. Ako želiš oporavak lozinke emailom, nakon instalacije dopuni SMTP vrednosti u `.env` i pokreni `docker compose up -d`.
6. Ako imaš zvaničan APR API pristup, dopuni `APR_API_URL` i `APR_API_KEY` u `.env`, pa ponovo pokreni `docker compose up -d`.

Caddy automatski pribavlja i obnavlja TLS sertifikat za javni domen. Za lokalni `localhost` koristi se HTTP.

## Prvi administratorski nalog

Administratorska prava se ne dodeljuju automatski samo na osnovu e-mail adrese. Prvo registruj nalog sa adresom podešenom u `ADMIN_EMAIL`, a zatim na serveru, iz direktorijuma `standalone`, pokreni:

```bash
docker compose exec api node grant-admin.mjs admin@example.com
```

Umesto `admin@example.com` unesi tačnu adresu iz `ADMIN_EMAIL`. Komanda radi samo za tu adresu i zahteva pristup serveru/Docker-u. Time se sprečava da neko drugi registracijom tuđe e-mail adrese dobije administratorska prava. Nemoj javno deliti tu adresu ili tajne iz `.env` fajla.

## Podaci i fotografije

- PostgreSQL podaci su u Docker volumenu `postgres_data`.
- Fotografije se podrazumevano čuvaju na lokalnom disku u Docker volumenu `uploads_data`.
- Za Render i druge platforme bez trajnog diska može se uključiti S3-kompatibilno skladište, uključujući Cloudflare R2, kroz promenljive `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` i `S3_REGION`.
- API isporučuje fotografije preko iste javne putanje bez obzira na izabrano skladište. Kada S3 promenljive nisu podešene, binarni sadržaj fotografije (`bytea`) čuva se u PostgreSQL tabeli `storage_objects`, zajedno sa tipom sadržaja i ključem objekta. Kada je S3/R2 podešen, binarni sadržaj se čuva u tom skladištu. PostgreSQL tabela `slike_oglasa` u oba slučaja čuva vezu fotografije sa oglasom, ključ/putanju i redosled. Zato backup baze obuhvata fotografije u podrazumevanom PostgreSQL režimu; kod R2 režima backup fotografija mora obuhvatiti i R2 bucket.
- Pri prelasku na sopstveni server isključuju se S3 promenljive i koristi se trajni disk; postojeće fotografije iz R2 treba prethodno kopirati na server i ažurirati njihove putanje u bazi.
- Caddy sertifikati i podešavanja su u `caddy_data` i `caddy_config`.
- Brisanje volumena može trajno obrisati podatke. Nemoj koristiti `docker compose down -v` osim ako namerno želiš potpuno brisanje instalacije.

## Backup i vraćanje

**Automatski backup:** Docker Compose pokreće i servis `backup`. On pravi kopiju PostgreSQL baze i arhivu fotografija odmah nakon pokretanja, a zatim ponavlja postupak na svakih 24 sata. Fajlovi se čuvaju u `standalone/backups`, a lokalne kopije starije od 14 dana automatski se brišu. Ako backup ne uspe, servis beleži grešku u svom logu i pokušava ponovo nakon sledećeg intervala.

Provera statusa i logova:

```bash
docker compose ps backup
docker compose logs --tail=100 backup
ls -lh backups/
```

Interval se može promeniti promenljivom `BACKUP_INTERVAL_SECONDS` u `.env` (podrazumevano `86400` sekundi).

**Važno:** automatska kopija na istom serveru nije dovoljna zaštita od kvara ili gubitka celog servera. Redovno kopiraj oba backup fajla na drugu lokaciju (drugi server ili privatno skladište). Za ručno pokretanje dodatne kopije koristi:

```bash
./scripts/backup.sh
```

Skripta pravi dva fajla u `standalone/backups`: SQL kopiju PostgreSQL baze i arhivu fotografija.

Za vraćanje na odgovarajuću instalaciju koristi:

```bash
./scripts/restore.sh backups/ponudimi-db-DATUM.sql backups/ponudimi-fotografije-DATUM.tar.gz
```

Skripta traži potvrdu pre upisa. SQL vraćanje radi u postojeću bazu i može promeniti njene podatke; koristi ga samo kada namerno vraćaš backup. Nemoj brisati Docker volumene.

## Google prijava (OAuth)

Google prijava koristi sopstveni API i ne zahteva Supabase. U Google Cloud Console napravi OAuth 2.0 Client ID tipa **Web application**. Kao Authorized redirect URI unesi tačno:

```text
https://ponudimi-test-api.onrender.com/api/auth/google/callback
```

Za drugu instalaciju zameni domen stvarnim javnim domenom API-ja. U Render Environment ili `.env` postavi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (mora biti identičan URI-ju u Google Cloud) i `PUBLIC_APP_URL=https://ponudimi-novo.onrender.com`. OAuth prijava povezuje samo postojeći PonudiMi nalog sa potpuno istom, Google-potvrđenom e-mail adresom; ako nalog ne postoji, korisnik prvo mora da se registruje redovnim postupkom, uključujući potvrdu telefona. Tajna klijenta nikada se ne unosi u frontend niti commit-uje u GitHub.

## Oporavak lozinke i integracije

Oporavak lozinke šalje jednokratni link koji važi jedan sat. Za to moraju biti podešeni SMTP podaci. APR sinhronizacija radi samo kada dobiješ i uneseš važeći pristup APR API servisu. Google OAuth nije uključen u ovu samostalnu verziju; email i lozinka rade bez spoljnog identiteta.

## Migracija starih naloga i podataka

Nova instalacija ne povezuje se sa starom Supabase bazom. Ne pokreći Supabase migracije `0000`–`0009` nad ovom bazom. Migracija postojećih naloga zahteva izvoz korisnika i podataka iz izvornog Supabase projekta; lozinke se ne mogu bezbedno preuzeti kao običan tekst, pa korisnici mogu morati da postave nove lozinke. ZIP ne briše niti menja staru aktivnu instalaciju.

## Provera

- `docker compose ps` — proveri da su servisi pokrenuti.
- `curl http://localhost/api/health` — API status (na serveru).
- `docker compose logs -f web api db caddy` — pregled logova.

## Cloudflare R2 (opciono)

Za R2 napravi privatni bucket i S3 API token sa pravima čitanja i upisa samo za taj bucket. U Render API servisu postavi endpoint oblika `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`, naziv bucket-a, Access Key ID, Secret Access Key i region `auto`. Tajne vrednosti unose se isključivo u Render Environment, ne u GitHub. Bez kompletne konfiguracije API koristi lokalni disk. R2 i dalje zahteva praćenje besplatnih kvota i eventualnih troškova ako se one prekorače.

## Status provere

Provereni su JavaScript sintaksa API servera, JSON konfiguracije, Compose YAML i shell sintaksa instalacionih/backup skripti. Kompletna Docker izgradnja i end-to-end test prijave, oglasa, fotografija i administratorskog panela moraju se izvršiti na serveru sa Docker Engine; to okruženje nije bilo dostupno tokom pripreme ovog paketa. Zato prvu instalaciju obavezno testiraj pre prebacivanja javnog domena i nemoj je smatrati potvrđenom produkcionom verzijom dok se testovi ne završe.

## Bezbednost

Promeni sve početne tajne pre pokretanja. Ne izlaži PostgreSQL port internetu. Redovno čuvaj backup baze i fotografija. Obezbedi ažuriranje operativnog sistema i Docker image-a.

## Potvrda identiteta korisnika (e-mail + SMS)

Registracija fizičkih i pravnih lica traži ime, prezime, e-mail, mobilni telefon i mesto. Ulica i broj su opcioni. Novi nalog se ne može koristiti za prijavu dok korisnik ne potvrdi e-mail link i SMS kod. Oznaka „Verifikovan korisnik“ prikazuje se tek kada su obe provere završene.

Za slanje e-mail potvrde podesi postojeće SMTP promenljive. Za SMS kodove koristi Twilio Verify i u `.env` (ili Render Environment) unesi sledeće vrednosti:

```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=VA...
```

U Twilio konzoli napravi Verify Service sa SMS kanalom. Telefoni se čuvaju u međunarodnom formatu E.164; za Srbiju je podržan format `+3816xxxxxxx`, a lokalni unos `06xxxxxxx` automatski se normalizuje. Nikada ne stavljaj Twilio tajne u frontend ili javni GitHub repozitorijum.

Jedinstvenost e-maila obezbeđuje baza. Verifikovani broj telefona ima jedinstveni indeks; ime, prezime i mesto koji liče na postojeći profil samo označavaju nalog za administratorsku proveru i ne izazivaju automatsko blokiranje. Postojeći nalozi i oglasi se ne brišu. Postojeći korisnici bez SMS potvrde dobijaju SMS korak pri sledećoj prijavi, a nepotvrđeni e-mail može ponovo dobiti potvrdu.