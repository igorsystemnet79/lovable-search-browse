# Pravna provera pre javnog/komercijalnog puštanja PonudiMi

Ovaj spisak je deo razvojne dokumentacije. Nije zamena za pravni savet. Pre objavljivanja konačnih pravnih tekstova potrebno je da operator Platforme potvrdi podatke i izvrši pravnu proveru prema propisima Republike Srbije.

## Obavezno dopuniti Politiku privatnosti

- [ ] Pun poslovni naziv operatora (ili ime i prezime ako je operator fizičko lice), pravna forma i registracioni podaci.
- [ ] Sedište i puna poštanska adresa operatora.
- [ ] Kontakt e-mail i kanal za zahteve u vezi sa podacima o ličnosti.
- [ ] Kontakt lica za zaštitu podataka, ako je imenovanje obavezno ili je lice imenovano.
- [ ] Konkretna svrha i pravni osnov obrade za svaku kategoriju podataka.
- [ ] Rokovi čuvanja naloga, oglasa, zahteva, poruka, prijava, evidencije administratora, logova i rezervnih kopija.
- [ ] Stvarni spisak obrađivača (hosting, baza, e-mail/SMS, analitika, skladištenje slika) i njihove uloge.
- [ ] Lokacije obrade i eventualni međunarodni prenosi, uz odgovarajuće zaštitne mehanizme.
- [ ] Postupak i rokovi za ostvarivanje prava korisnika i podnošenje pritužbe.
- [ ] Proveriti da li se koriste kolačići ili analitika koji zahtevaju poseban izbor korisnika.

## Pravilnik o ponašanju

- [ ] Pravno proveriti zabranjene kategorije, postupanje sa nezakonitim sadržajem i obaveze operatora.
- [ ] Potvrditi postupak prijave, privremenog skrivanja oglasa, blokiranja naloga i žalbe.
- [ ] Definisati kontakt i rok za odgovor na žalbe korisnika.
- [ ] Potvrditi pravila za poslovne korisnike, profesionalne oglašivače, recenzije i intelektualnu svojinu.
- [ ] Ako ostaje zahtev da fizička lica budu proverena ličnom kartom, implementirati poseban, bezbedan postupak provere identiteta i utvrditi pravni osnov i rok čuvanja. Trenutna registracija beleži samo izjavu o punoletstvu; ona ne predstavlja proveru lične karte. Ne tražiti kopije dokumenata kroz privatne poruke.
- [ ] Jasno objasniti da se privatne poruke ne prikazuju javno, ali da ovlašćeni administrator može izvršiti opravdan i evidentiran pregled radi bezbednosti, prijave, spora, podrške ili zakonskog zahteva.

## Evidencija prihvatanja

Registracija zahteva potvrdu prihvatanja Pravilnika i potvrdu da je korisnik upoznat sa Politikom privatnosti. API odbija registraciju bez obe potvrde. Baza čuva vreme prihvatanja, verziju pravilnika i vreme potvrde politike privatnosti.

## Kontrole administratorskog pristupa porukama

- Administrator mora uneti konkretan razlog od najmanje 10 karaktera pre otvaranja privatnog razgovora.
- Razlog, administrator, razgovor i vreme pristupa upisuju se u message_admin_access_log i admin_audit_log.
- Pristup je ograničen na administratorsku ulogu; moderator nema automatsko pravo da čita privatne razgovore.
- Pre produkcije testirati da običan korisnik i moderator ne mogu pozvati administratorske API rute.

## Napomena za izdanje

Tekstovi u src/lib/platform-rules.ts predstavljaju radnu početnu verziju. Politika privatnosti na javnoj stranici namerno je označena kao nacrt dok se ne unesu stvarni podaci operatora, obrađivači i rokovi čuvanja. Nemojte je predstavljati kao konačno pravno mišljenje ili potvrdu potpune usklađenosti dok se navedene stavke ne zatvore.
