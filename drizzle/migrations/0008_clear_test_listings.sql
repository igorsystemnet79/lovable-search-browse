-- Clear all current test listings and requests before importing authorized Serbian sources.
-- This intentionally preserves user accounts, profiles, roles, support messages and settings.
-- Follows and listing-change history belong only to the test listings and are cleared too.

BEGIN;

DELETE FROM public.pracenja;
DELETE FROM public.izmene_oglasa;
DELETE FROM public.ponude;
DELETE FROM public.zahtevi;

COMMIT;
