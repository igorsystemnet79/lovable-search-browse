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
5. Za oporavak lozinke i automatske e-mail podsetnike o isteku paketa (10 dana unapred), dopuni `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` i `SMTP_FROM` u `.env`, pa pokreni `docker compose up -d`.
6. Ako imaš zvaničan APR API pristup, dopuni `APR_API_URL` i `APR_API_KEY` u `.env`, pa ponovo pokreni `docker compose up -d`.

Caddy automatski pribavlja i obnavlja TLS sertifikat za javni domen. Za lokalni `localhost` koristi se HTTP.

## Registracija i podaci korisnika

Registracija traži ime, prezime i jedinstveno korisničko ime (3–30 znakova; slova, brojevi, tačka, donja crta ili crtica). Korisničko ime se čuva malim slovima i proverava se njegova jedinstvenost. Lozinke se čuvaju isključivo kao bcrypt hash i nikada nisu vidljive administratoru. U administratorskoj tabeli prikazuje se maskirana oznaka i objašnjenje zaštite lozinke.

Pri pokretanju API-ja `standalone/db/init.sql` automatski dodaje kolone `prezime` i `korisnicko_ime` u postojeću bazu, vraća prezime iz ranije sačuvanih registracionih metapodataka gde je dostupno i postavlja jedinstveni indeks za korisnička imena. Za ovu izmenu nije potrebno ručno izvršavati SQL.

## Pravila, punoletstvo i privatnost

Registracija zahteva potvrdu prihvatanja pravila platforme, upoznavanje sa obaveštenjem o privatnosti i samostalnu potvrdu da korisnik ima najmanje 18 godina. API odbija registraciju ako ove potvrde nisu prosleđene. U bazi se čuvaju verzija pravila, verzija obaveštenja, vreme prihvatanja, potvrda punoletstva, IP adresa i User-Agent radi evidencije prihvatanja.

Stranica „Obaveštenje o privatnosti“ je radna verzija. Pre javnog puštanja obavezno uneti puno poslovno ime i adresu rukovaoca, matični broj/PIB, kontakt za privatnost, stvarne hosting i druge obrađivače, lokacije obrade i konkretne rokove čuvanja; zatim pribaviti pravnu proveru. Potvrda punoletstva je samostalna izjava korisnika i nije provera identiteta ličnom kartom.

## Status prodavca i rangiranje pretrage

Pri registraciji korisnik se izjašnjava da li ponude objavljuje kao trgovac u okviru registrovane delatnosti ili kao privatno lice. Status se čuva na profilu, prenosi na ponude i prikazuje uz ponudu. Administrator može da ispravi status, a izmena se prenosi na postojeće ponude. Za postojeće naloge status ostaje „nije potvrđen“ dok ga korisnik/administrator ne utvrdi.

Stranica „Kriterijumi rangiranja“ objašnjava parametre pretrage: najnovije, najstarije, cena/budžet rastuće i opadajuće. Filteri ključne reči, lokacije, kategorije, raspona cene i valute određuju skup rezultata. Istaknute ponude prikazuju se odvojeno i ne menjaju redosled standardne pretrage. Uz svaku ponudu postoji i link ka obaveštenju koje objašnjava status prodavca i podelu obaveza između prodavca i platforme.

Ovo su tehničke funkcije za transparentnost onlajn tržišta. Pre javnog puštanja potrebno je pravno proveriti klasifikaciju trgovca za različite tipove korisnika, raspodelu obaveza između platforme i prodavca, informacije pre zaključenja ugovora i postupak za reklamacije/prijave.

## Prvi administratorski nalog

Prvi nalog registrovan sa adresom navedenom u `ADMIN_EMAIL` automatski dobija administratorsku ulogu. Registruj ga kroz stranicu Registracija nakon prvog pokretanja. Nemoj javno deliti tu adresu ili tajne iz `.env` fajla.

## Podaci i fotografije

- PostgreSQL podaci su u Docker volumenu `postgres_data`.
- Fotografije se podrazumevano čuvaju na lokalnom disku u Docker volumenu `uploads_data`.
- Po oglasu je dozvoljeno do 7 fotografija; ulazni fajl može imati do 20 MB. API ih obrađuje na serveru i čuva kao JPEG dimenzija 800 × 600 px, bez minimalne rezolucije i uz tehničku granicu od 100 MP radi stabilnosti.
- Za Render i druge platforme bez trajnog diska može se uključiti S3-kompatibilno skladište, uključujući Cloudflare R2, kroz promenljive `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` i `S3_REGION`.
- API isporučuje fotografije preko iste javne putanje bez obzira na to da li su na lokalnom disku ili u R2. PostgreSQL tabela `slike_oglasa` čuva vezu fotografije sa oglasom, putanju ili URL i redosled. Sama binarna slika se ne upisuje u PostgreSQL.
- Pri prelasku na sopstveni server isključuju se S3 promenljive i koristi se trajni disk; postojeće fotografije iz R2 treba prethodno kopirati na server i ažurirati njihove putanje u bazi.
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

Paketi pravnih lica imaju cene 10 € mesečno, 20 € za tri meseca, 50 € za šest meseci i 100 € za 12 meseci. Paket može biti aktiviran samo za APR-verifikovano pravno lice nakon evidentirane uplate ili administratorskog oslobađanja. API proverava pakete na svakih šest sati i šalje e-mail podsetnik 10 dana pre isteka kada su SMTP podešavanja dostupna. SMS podsetnici nisu uključeni jer SMS provajder još nije konfigurisan.

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
