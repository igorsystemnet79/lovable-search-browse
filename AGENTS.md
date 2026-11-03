# PonudiMi development notes

- Preserve the existing React pages, visual design, responsive behavior, forms, route names, and Serbian-language copy unless a task explicitly requests a change.
- The application uses the self-hosted API in `standalone/api` and PostgreSQL schema in `standalone/db/init.sql`. Do not add Supabase or Lovable Cloud runtime dependencies.
- Browser data access goes through `src/integrations/standalone/client.ts`; keep API authorization and validation on the server.
- Listing creation uses the shared offer/request dialog. Users may edit and delete only their own listings; administrators have separate privileges.
- Uploaded listing photos must be stored in the persistent upload volume and associated with the listing in `slike_oglasa`.
- Never run destructive cleanup against existing or imported user data without explicit approval. Do not use `docker compose down -v` as a routine restart.
- Secrets belong in `standalone/.env`, never in source code or frontend bundles.
