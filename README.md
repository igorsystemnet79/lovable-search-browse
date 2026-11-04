# PonudiMi

PonudiMi marketplace aplikacija. Samostalna instalacija i dokumentacija nalaze se u `standalone/`.

## Pravila korišćenja fotografija i sadržaja

Pravila o fotografijama i drugom sadržaju koji korisnici postavljaju nalaze se u [`PRAVILA-KORISCENJA-FOTOGRAFIJA-I-SADRZAJA.md`](PRAVILA-KORISCENJA-FOTOGRAFIJA-I-SADRZAJA.md). Dokument je radni nacrt i treba ga pravno proveriti pre javne primene.

## Samostalna instalacija

Platforma koristi sopstveni Node.js API, PostgreSQL bazu i trajno čuvanje fotografija. Uputstvo na srpskom: [`standalone/README-SR.md`](standalone/README-SR.md).

Za pokretanje je potreban server sa Docker Engine i Docker Compose v2, domenom (za javni HTTPS) i trajnim disk prostorom. Ne koristi se Supabase servis.
