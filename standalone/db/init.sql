CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE TABLE IF NOT EXISTS storage_objects (
 object_key text PRIMARY KEY, content_type text NOT NULL, body bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL,
 password_hash text NOT NULL, email_confirmed_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(), session_version integer NOT NULL DEFAULT 0 CHECK (session_version >= 0)
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS profiles (
 id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 ime text, telefon text, grad text, adresa text, tip_lica text NOT NULL DEFAULT 'fizicko' CHECK (tip_lica IN ('fizicko','pravno')),
 naziv_firme text, pib text CHECK (pib IS NULL OR pib ~ '^[0-9]{9}$'),
 firma_verifikovana boolean NOT NULL DEFAULT false, blokiran boolean NOT NULL DEFAULT false, email text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS user_roles (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 role text NOT NULL CHECK (role IN ('admin','moderator','user')), UNIQUE(user_id,role)
);
CREATE TABLE IF NOT EXISTS ponude (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), naslov text NOT NULL, opis text, kategorija text NOT NULL, lokacija text NOT NULL,
 cena numeric, valuta text NOT NULL DEFAULT 'EUR', emoji text, istaknuto boolean NOT NULL DEFAULT false,
 zavrseno boolean NOT NULL DEFAULT false, pauziran boolean NOT NULL DEFAULT false, user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 kontakt_ime text, telefon text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
CREATE TABLE IF NOT EXISTS zahtevi (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), naslov text NOT NULL, opis text, kategorija text NOT NULL, lokacija text NOT NULL,
 budzet numeric, valuta text NOT NULL DEFAULT 'EUR', zavrseno boolean NOT NULL DEFAULT false, pauziran boolean NOT NULL DEFAULT false,
 user_id uuid REFERENCES users(id) ON DELETE SET NULL, kontakt_ime text, telefon text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz
);
ALTER TABLE ponude ADD COLUMN IF NOT EXISTS pauziran boolean NOT NULL DEFAULT false;
ALTER TABLE zahtevi ADD COLUMN IF NOT EXISTS pauziran boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS pracenja (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 ponuda_id uuid REFERENCES ponude(id) ON DELETE CASCADE, zahtev_id uuid REFERENCES zahtevi(id) ON DELETE CASCADE,
 pocetna_cena numeric, pocetni_budzet numeric,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT pracenja_jedan_oglas CHECK ((ponuda_id IS NOT NULL)::int + (zahtev_id IS NOT NULL)::int = 1)
);
ALTER TABLE pracenja ALTER COLUMN ponuda_id DROP NOT NULL;
ALTER TABLE pracenja ADD COLUMN IF NOT EXISTS zahtev_id uuid REFERENCES zahtevi(id) ON DELETE CASCADE;
ALTER TABLE pracenja ADD COLUMN IF NOT EXISTS pocetni_budzet numeric;
ALTER TABLE pracenja DROP CONSTRAINT IF EXISTS pracenja_jedan_oglas;
ALTER TABLE pracenja ADD CONSTRAINT pracenja_jedan_oglas CHECK ((ponuda_id IS NOT NULL)::int + (zahtev_id IS NOT NULL)::int = 1);
CREATE UNIQUE INDEX IF NOT EXISTS pracenja_user_ponuda_unique ON pracenja(user_id,ponuda_id) WHERE ponuda_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS pracenja_user_zahtev_unique ON pracenja(user_id,zahtev_id) WHERE zahtev_id IS NOT NULL;
-- Additive moderation state: existing listings remain visible and are never deleted.
ALTER TABLE ponude ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'visible' CHECK (moderation_status IN ('visible','hidden'));
ALTER TABLE zahtevi ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'visible' CHECK (moderation_status IN ('visible','hidden'));
ALTER TABLE ponude ADD COLUMN IF NOT EXISTS moderation_reason text;
ALTER TABLE zahtevi ADD COLUMN IF NOT EXISTS moderation_reason text;
ALTER TABLE ponude ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE zahtevi ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ponude ADD COLUMN IF NOT EXISTS moderated_at timestamptz;
ALTER TABLE zahtevi ADD COLUMN IF NOT EXISTS moderated_at timestamptz;
CREATE INDEX IF NOT EXISTS ponude_moderation_status_idx ON ponude(moderation_status,created_at DESC);
CREATE INDEX IF NOT EXISTS zahtevi_moderation_status_idx ON zahtevi(moderation_status,created_at DESC);
CREATE TABLE IF NOT EXISTS moderation_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 listing_table text NOT NULL CHECK (listing_table IN ('ponude','zahtevi','users')),
 listing_id uuid NOT NULL,
 actor_id uuid,
 action text NOT NULL CHECK (action IN ('hide','restore','block_user','unblock_user')),
 reason_code text NOT NULL,
 note text,
 previous_status text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderation_actions_created_idx ON moderation_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS moderation_actions_listing_idx ON moderation_actions(listing_table,listing_id,created_at DESC);

CREATE TABLE IF NOT EXISTS moderator_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tabela text NOT NULL CHECK (tabela IN ('ponude','zahtevi')),
 oglas_id uuid NOT NULL,
 moderator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 trenutni_podaci jsonb NOT NULL,
 predlozeni_podaci jsonb NOT NULL,
 status text NOT NULL DEFAULT 'na_cekanju' CHECK (status IN ('na_cekanju','odobreno','odbijeno')),
 admin_napomena text,
 odlucio_id uuid REFERENCES users(id) ON DELETE SET NULL,
 odluceno_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS moderator_proposals_status_idx ON moderator_proposals(status,created_at DESC);
CREATE INDEX IF NOT EXISTS moderator_proposals_moderator_idx ON moderator_proposals(moderator_id,created_at DESC);
CREATE TABLE IF NOT EXISTS izmene_oglasa (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), oglas_id uuid NOT NULL, tabela text NOT NULL,
 opis text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS slike_oglasa (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ponuda_id uuid REFERENCES ponude(id) ON DELETE CASCADE,
 zahtev_id uuid REFERENCES zahtevi(id) ON DELETE CASCADE, storage_path text, external_url text,
 pozicija smallint NOT NULL DEFAULT 0 CHECK (pozicija BETWEEN 0 AND 6), created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((ponuda_id IS NOT NULL)::int + (zahtev_id IS NOT NULL)::int = 1),
 CHECK ((storage_path IS NOT NULL)::int + (external_url IS NOT NULL)::int = 1)
);
CREATE TABLE IF NOT EXISTS poruke_podrske (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ime text NOT NULL, email text NOT NULL,
 poruka text NOT NULL CHECK (char_length(poruka) BETWEEN 1 AND 2000), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS prijave_oglasa (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tabela text NOT NULL CHECK (tabela IN ('ponude','zahtevi')),
 oglas_id uuid NOT NULL,
 prijavio_id uuid REFERENCES users(id) ON DELETE SET NULL,
 razlog text NOT NULL CHECK (razlog IN ('sumnja_na_prevaru','netacni_podaci','neispravan_kontakt','neprimeren_sadrzaj','dupliran_oglas','ostalo')),
 detalji text CHECK (detalji IS NULL OR char_length(detalji) <= 1000),
 status text NOT NULL DEFAULT 'na_cekanju' CHECK (status IN ('na_cekanju','pregledano','odbijeno')),
 admin_napomena text,
 odlucio_id uuid REFERENCES users(id) ON DELETE SET NULL,
 odluceno_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prijave_oglasa_status_idx ON prijave_oglasa(status,created_at DESC);
CREATE INDEX IF NOT EXISTS prijave_oglasa_listing_idx ON prijave_oglasa(tabela,oglas_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS prijave_oglasa_jedna_otvorena_po_korisniku
 ON prijave_oglasa(prijavio_id,tabela,oglas_id) WHERE prijavio_id IS NOT NULL AND status='na_cekanju';

CREATE TABLE IF NOT EXISTS apr_firme (
 pib text PRIMARY KEY CHECK (pib ~ '^[0-9]{9}$'), maticni_broj text, naziv text NOT NULL,
 sediste text, adresa text, status text, synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS apr_sinhronizacije (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), pokrenuo uuid REFERENCES users(id) ON DELETE SET NULL, broj_firmi int NOT NULL DEFAULT 0,
 uspeh boolean NOT NULL DEFAULT false, poruka text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ponude_created_idx ON ponude(created_at DESC);
CREATE INDEX IF NOT EXISTS zahtevi_created_idx ON zahtevi(created_at DESC);
CREATE INDEX IF NOT EXISTS ponude_user_idx ON ponude(user_id);
CREATE INDEX IF NOT EXISTS zahtevi_user_idx ON zahtevi(user_id);
CREATE INDEX IF NOT EXISTS slike_ponuda_idx ON slike_oglasa(ponuda_id,pozicija);
CREATE INDEX IF NOT EXISTS slike_zahtev_idx ON slike_oglasa(zahtev_id,pozicija);

CREATE TABLE IF NOT EXISTS password_resets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_resets_expiry_idx ON password_resets(expires_at);

-- Search normalization preserves the Serbian-language smart-search behavior.
CREATE OR REPLACE FUNCTION normalizuj(t text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT lower(unaccent(replace(replace(coalesce(t, ''), 'đ', 'dj'), 'Đ', 'dj')))
$$;
CREATE OR REPLACE FUNCTION koren_reci(w text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN char_length(w) <= 3 THEN w
    ELSE CASE WHEN char_length(r) >= 3 THEN r ELSE left(w, 3) END END
  FROM (SELECT regexp_replace(w, '(icama|icima|ovima|evima|ijama|icom|icu|ica|ice|ici|ama|ima|om|em|og|eg|oj|ih|im|ji|ju|ja|je|u|a|e|i|o)$', '') AS r) s
$$;
CREATE OR REPLACE FUNCTION pretraga_uslov(tekst text, q text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(bool_and(normalizuj(tekst) LIKE '%' || koren_reci(w) || '%'), true)
  FROM regexp_split_to_table(normalizuj(q), '[^a-z0-9]+') w WHERE w <> ''
$$;

-- Record meaningful changes to an offer/request for the public edit history.
CREATE OR REPLACE FUNCTION log_izmene_oglasa() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  iznos_old numeric;
  iznos_new numeric;
  promene text[] := '{}';
BEGIN
  IF TG_TABLE_NAME = 'ponude' THEN
    iznos_old := OLD.cena; iznos_new := NEW.cena;
  ELSE
    iznos_old := OLD.budzet; iznos_new := NEW.budzet;
  END IF;
  IF iznos_old IS DISTINCT FROM iznos_new THEN
    promene := array_append(promene, 'Cena/budžet: ' || coalesce(iznos_old::text, 'po dogovoru') || ' → ' || coalesce(iznos_new::text, 'po dogovoru') || ' ' || NEW.valuta);
  END IF;
  IF OLD.naslov IS DISTINCT FROM NEW.naslov THEN promene := array_append(promene, 'Naslov: ' || NEW.naslov); END IF;
  IF OLD.opis IS DISTINCT FROM NEW.opis THEN promene := array_append(promene, 'Opis je izmenjen'); END IF;
  IF OLD.lokacija IS DISTINCT FROM NEW.lokacija THEN promene := array_append(promene, 'Lokacija: ' || NEW.lokacija); END IF;
  IF OLD.telefon IS DISTINCT FROM NEW.telefon OR OLD.kontakt_ime IS DISTINCT FROM NEW.kontakt_ime THEN promene := array_append(promene, 'Kontakt je izmenjen'); END IF;
  IF OLD.zavrseno IS DISTINCT FROM NEW.zavrseno THEN
    promene := array_append(promene, CASE WHEN NEW.zavrseno THEN 'Oglas je završen' ELSE 'Oglas je ponovo aktivan' END);
  END IF;
  IF OLD.pauziran IS DISTINCT FROM NEW.pauziran THEN
    promene := array_append(promene, CASE WHEN NEW.pauziran THEN 'Oglas je pauziran' ELSE 'Oglas je ponovo aktiviran nakon pauze' END);
  END IF;
  IF cardinality(promene) > 0 THEN
    NEW.updated_at := now();
    INSERT INTO izmene_oglasa(oglas_id,tabela,opis) VALUES(NEW.id,TG_TABLE_NAME,array_to_string(promene,' · '));
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ponude_izmene ON ponude;
CREATE TRIGGER ponude_izmene BEFORE UPDATE ON ponude FOR EACH ROW EXECUTE FUNCTION log_izmene_oglasa();
DROP TRIGGER IF EXISTS zahtevi_izmene ON zahtevi;
CREATE TRIGGER zahtevi_izmene BEFORE UPDATE ON zahtevi FOR EACH ROW EXECUTE FUNCTION log_izmene_oglasa();

CREATE OR REPLACE FUNCTION proveri_broj_slika_oglasa() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE broj integer;
BEGIN
  IF NEW.ponuda_id IS NOT NULL THEN
    SELECT count(*) INTO broj FROM slike_oglasa WHERE ponuda_id=NEW.ponuda_id AND id<>coalesce(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid);
  ELSE
    SELECT count(*) INTO broj FROM slike_oglasa WHERE zahtev_id=NEW.zahtev_id AND id<>coalesce(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid);
  END IF;
  IF broj >= 7 THEN RAISE EXCEPTION 'Oglas može imati najviše 7 fotografija.'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS ogranicenje_broj_slika_oglasa ON slike_oglasa;
CREATE TRIGGER ogranicenje_broj_slika_oglasa BEFORE INSERT OR UPDATE OF ponuda_id,zahtev_id ON slike_oglasa FOR EACH ROW EXECUTE FUNCTION proveri_broj_slika_oglasa();

-- Audit trail for the internal AI administrator. No secrets or message bodies are stored.
CREATE TABLE IF NOT EXISTS admin_ai_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_ai_audit_created_idx ON admin_ai_audit(created_at DESC);


-- Token usage and actual API cost per administrator conversation.
CREATE TABLE IF NOT EXISTS chatgpt_usage (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL,
 admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
 model text NOT NULL,
 input_tokens bigint NOT NULL DEFAULT 0,
 output_tokens bigint NOT NULL DEFAULT 0,
 cached_input_tokens bigint NOT NULL DEFAULT 0,
 input_cost_usd numeric(14,8) NOT NULL DEFAULT 0,
 output_cost_usd numeric(14,8) NOT NULL DEFAULT 0,
 total_cost_usd numeric(14,8) NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chatgpt_usage_admin_created_idx ON chatgpt_usage(admin_id,created_at DESC);
CREATE INDEX IF NOT EXISTS chatgpt_usage_conversation_idx ON chatgpt_usage(admin_id,conversation_id,created_at);


-- Account identity verification (safe additive migration; existing records remain intact).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prezime text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefon_normalizovan text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefon_verifikovan_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS duplikat_sumnja boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS verifikacija_zapoceta_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_verified_phone_unique
 ON profiles(telefon_normalizovan)
 WHERE telefon_verifikovan_at IS NOT NULL AND telefon_normalizovan IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_duplicate_review_idx
 ON profiles(duplikat_sumnja,created_at DESC) WHERE duplikat_sumnja=true;
CREATE TABLE IF NOT EXISTS email_verification_tokens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL,
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_verification_tokens_user_idx ON email_verification_tokens(user_id,expires_at DESC);

-- Normalize legacy phone numbers for the new verification flow without marking them verified.
UPDATE profiles
SET telefon_normalizovan = CASE
  WHEN regexp_replace(coalesce(telefon,''),'[^0-9]','','g') ~ '^06[0-9]{7,8}$'
    THEN '+381' || substring(regexp_replace(telefon,'[^0-9]','','g') from 2)
  WHEN regexp_replace(coalesce(telefon,''),'[^0-9]','','g') ~ '^3816[0-9]{7,8}$'
    THEN '+' || regexp_replace(telefon,'[^0-9]','','g')
  WHEN regexp_replace(coalesce(telefon,''),'[^0-9]','','g') ~ '^003816[0-9]{7,8}$'
    THEN '+' || substring(regexp_replace(telefon,'[^0-9]','','g') from 3)
  ELSE telefon_normalizovan
END
WHERE telefon_normalizovan IS NULL AND telefon IS NOT NULL;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
UPDATE profiles p SET email_confirmed_at=u.email_confirmed_at FROM users u WHERE u.id=p.id AND p.email_confirmed_at IS DISTINCT FROM u.email_confirmed_at;

-- The previous standalone registration stamped email_confirmed_at at account creation
-- without sending a confirmation link. Reset those legacy timestamps exactly once so
-- existing accounts must complete the new real email + SMS verification flow.
CREATE TABLE IF NOT EXISTS app_migrations (
 migration_key text PRIMARY KEY,
 applied_at timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM app_migrations WHERE migration_key='2026-11-account-verification-reset') THEN
  UPDATE users SET email_confirmed_at=NULL;
  UPDATE profiles SET email_confirmed_at=NULL;
  INSERT INTO app_migrations(migration_key) VALUES('2026-11-account-verification-reset');
 END IF;
END $$;


-- Platform rules and version history used by the public site and admin panel.
CREATE TABLE IF NOT EXISTS platform_rules (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton=true),
 sadrzaj text NOT NULL,
 version integer NOT NULL DEFAULT 1,
 published_by uuid REFERENCES users(id) ON DELETE SET NULL,
 published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_rules_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 sadrzaj text NOT NULL,
 version integer NOT NULL UNIQUE,
 published_by uuid REFERENCES users(id) ON DELETE SET NULL,
 published_at timestamptz NOT NULL DEFAULT now()
);

-- Global platform maintenance switch, controlled only by administrators.
CREATE TABLE IF NOT EXISTS platform_settings (
 id smallint PRIMARY KEY CHECK (id=1),
 maintenance_enabled boolean NOT NULL DEFAULT false,
 maintenance_message text NOT NULL DEFAULT 'Platforma je u fazi izrade ili prepravke. Molimo vas za strpljenje.',
 updated_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO platform_settings(id,maintenance_enabled,maintenance_message) VALUES(1,false,'Platforma je u fazi izrade ili prepravke. Molimo vas za strpljenje.') ON CONFLICT(id) DO NOTHING;


-- Encrypted TOTP credentials and one-time recovery hashes for administrator access.
CREATE TABLE IF NOT EXISTS admin_2fa (
 user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 admin_password_hash text,
 secret_ciphertext text,
 pending_secret_ciphertext text,
 pending_expires_at timestamptz,
 recovery_code_hashes text[] NOT NULL DEFAULT '{}',
 enabled boolean NOT NULL DEFAULT false,
 enabled_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_2fa ADD COLUMN IF NOT EXISTS admin_password_hash text;

ALTER TABLE admin_2fa ADD COLUMN IF NOT EXISTS last_totp_step bigint;

-- Append-only audit trail for authenticated changes across the platform.
CREATE TABLE IF NOT EXISTS admin_audit_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
 actor_email text, action text NOT NULL, http_method text NOT NULL, route text NOT NULL, target_id text,
 response_status integer NOT NULL, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_actor_idx ON admin_audit_log(actor_id,created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_action_idx ON admin_audit_log(action,created_at DESC);
CREATE OR REPLACE FUNCTION prevent_admin_audit_log_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Administrativna evidencija je neizmenjiva.'; END $$;
DROP TRIGGER IF EXISTS admin_audit_log_no_update ON admin_audit_log;
CREATE TRIGGER admin_audit_log_no_update BEFORE UPDATE OR DELETE ON admin_audit_log FOR EACH ROW EXECUTE FUNCTION prevent_admin_audit_log_mutation();
