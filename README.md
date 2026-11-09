# PonudiMi

PonudiMi marketplace aplikacija. Samostalna instalacija i dokumentacija nalaze se u `standalone/`.

## Samostalna instalacija

Platforma koristi sopstveni Node.js API, PostgreSQL bazu i trajno čuvanje fotografija. Uputstvo na srpskom: [`standalone/README-SR.md`](standalone/README-SR.md).

Za pokretanje je potreban server sa Docker Engine i Docker Compose v2, domenom (za javni HTTPS) i trajnim disk prostorom. Ne koristi se spoljašnji BaaS servis; podaci i autentifikacija rade preko sopstvenog API-ja i PostgreSQL baze.
