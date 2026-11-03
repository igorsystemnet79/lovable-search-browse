# PonudiMi — samostalna instalacija

Ovaj paket pokreće frontend, sopstveni API, PostgreSQL i trajno čuvanje fotografija. Aplikacija ne zahteva Supabase nalog niti Lovable Cloud. Postojeći React interfejs, rute i stilovi ostaju osnova platforme; podaci se čuvaju na serveru.

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

Prvi nalog registrovan sa adresom navedenom u `ADMIN_EMAIL` automatski dobija administratorsku ulogu. Registruj ga kroz stranicu Registracija nakon prvog pokretanja. Nemoj javno deliti tu adresu ili tajne iz `.env` fajla.

## Podaci i fotografije

- PostgreSQL podaci su u Docker volumenu `postgres_data`.
- Fotografije su u Docker volumenu `uploads_data`.
- Caddy sertifikati i podešavanja su u `caddy_data` i `caddy_config`.
- Brisanje volumena može trajno obrisati podatke. Nemoj koristiti `docker compose down -v` osim ako namerno želiš potpuno brisanje instalacije.

## Backup i vraćanje

Iz direktorijuma `standalone` pokreni:

```bash
./scripts/backup.sh
```

Skripta pravi dva fajla u `standalone/backups`: SQL kopiju PostgreSQL baze i arhivu fotografija. Kopiraj oba fajla i na drugu, nezavisnu lokaciju.

Za vraćanje na odgovarajuću instalaciju koristi:

```bash
./scripts/restore.sh backups/ponudimi-db-DATUM.sql backups/ponudimi-fotografije-DATUM.tar.gz
```

Skripta traži potvrdu pre upisa. SQL vraćanje radi u postojeću bazu i može promeniti njene podatke; koristi ga samo kada namerno vraćaš backup. Nemoj brisati Docker volumene.

## Oporavak lozinke i integracije

Oporavak lozinke šalje jednokratni link koji važi jedan sat. Za to moraju biti podešeni SMTP podaci. APR sinhronizacija radi samo kada dobiješ i uneseš važeći pristup APR API servisu. Google OAuth nije uključen u ovu samostalnu verziju; email i lozinka rade bez spoljnog identiteta.

## Migracija starih naloga i podataka

Nova instalacija ne povezuje se sa starom Supabase bazom. Ne pokreći Supabase migracije `0000`–`0009` nad ovom bazom. Migracija postojećih naloga zahteva izvoz korisnika i podataka iz izvornog Supabase projekta; lozinke se ne mogu bezbedno preuzeti kao običan tekst, pa korisnici mogu morati da postave nove lozinke. ZIP ne briše niti menja staru aktivnu instalaciju.

## Provera

- `docker compose ps` — proveri da su servisi pokrenuti.
- `curl http://localhost/api/health` — API status (na serveru).
- `docker compose logs -f web api db caddy` — pregled logova.

## Status provere

Provereni su JavaScript sintaksa API servera, JSON konfiguracije, Compose YAML i shell sintaksa instalacionih/backup skripti. Kompletna Docker izgradnja i end-to-end test prijave, oglasa, fotografija i administratorskog panela moraju se izvršiti na serveru sa Docker Engine; to okruženje nije bilo dostupno tokom pripreme ovog paketa. Zato prvu instalaciju obavezno testiraj pre prebacivanja javnog domena i nemoj je smatrati potvrđenom produkcionom verzijom dok se testovi ne završe.

## Bezbednost

Promeni sve početne tajne pre pokretanja. Ne izlaži PostgreSQL port internetu. Redovno čuvaj backup baze i fotografija. Obezbedi ažuriranje operativnog sistema i Docker image-a.
