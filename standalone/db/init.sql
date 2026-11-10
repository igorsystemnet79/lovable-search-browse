CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE TABLE IF NOT EXISTS storage_objects (
 object_key text PRIMARY KEY, content_type text NOT NULL, body bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE NOT NULL,
 password_hash text NOT NULL, email_confirmed_at timestamptz, metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_categories (
 slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 naziv text NOT NULL,
 slika text NOT NULL DEFAULT '',
 podkategorije text[] NOT NULL DEFAULT '{}',
 podkategorije_slike jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE platform_categories ADD COLUMN IF NOT EXISTS podkategorije_slike jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS platform_categories_created_idx ON platform_categories(created_at,slug);
CREATE TABLE IF NOT EXISTS platform_category_exclusions (
 slug text NOT NULL,
 subcategory text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(slug,subcategory)
);

CREATE TABLE IF NOT EXISTS platform_maintenance (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton=true), enabled boolean NOT NULL DEFAULT false,
 message text NOT NULL DEFAULT 'Platforma PonudiMi je trenutno u fazi izrade ili unapređenja. Molimo vas za strpljenje. Uskoro se vraćamo!',
 updated_by uuid REFERENCES users(id) ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO platform_maintenance(singleton,enabled) VALUES(true,false) ON CONFLICT(singleton) DO NOTHING;
CREATE TABLE IF NOT EXISTS platform_rules (
 singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton=true), sadrzaj text NOT NULL, version integer NOT NULL DEFAULT 1,
 published_by uuid REFERENCES users(id) ON DELETE SET NULL, published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS platform_rules_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), sadrzaj text NOT NULL, version integer NOT NULL UNIQUE,
 published_by uuid REFERENCES users(id) ON DELETE SET NULL, published_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profiles (
 id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 ime text, prezime text, korisnicko_ime text, telefon text, grad text, adresa text, tip_lica text NOT NULL DEFAULT 'fizicko' CHECK (tip_lica IN ('fizicko','pravno')),
 naziv_firme text, pib text CHECK (pib IS NULL OR pib ~ '^[0-9]{9}$'),
 firma_verifikovana boolean NOT NULL DEFAULT false, blokiran boolean NOT NULL DEFAULT false, email text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS prezime text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS korisnicko_ime text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS firma_status_verifikacije text;
UPDATE profiles SET firma_status_verifikacije=CASE WHEN firma_verifikovana THEN 'verifikovana' ELSE 'na_cekanju' END
 WHERE firma_status_verifikacije IS NULL OR firma_status_verifikacije NOT IN ('na_cekanju','verifikovana','odbijena');
ALTER TABLE profiles ALTER COLUMN firma_status_verifikacije SET DEFAULT 'na_cekanju';
ALTER TABLE profiles ALTER COLUMN firma_status_verifikacije SET NOT NULL;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_firma_status_verifikacije_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_firma_status_verifikacije_check
  CHECK (firma_status_verifikacije IN ('na_cekanju','verifikovana','odbijena'));
UPDATE profiles p SET prezime=NULLIF(BTRIM(u.metadata->>'prezime'),'') FROM users u WHERE u.id=p.id AND (p.prezime IS NULL OR BTRIM(p.prezime)='') AND NULLIF(BTRIM(u.metadata->>'prezime'),'') IS NOT NULL;
UPDATE profiles p SET korisnicko_ime=LOWER(NULLIF(BTRIM(u.metadata->>'korisnicko_ime'),'')) FROM users u WHERE u.id=p.id AND (p.korisnicko_ime IS NULL OR p.korisnicko_ime='') AND NULLIF(BTRIM(u.metadata->>'korisnicko_ime'),'') IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_korisnicko_ime_unique ON profiles (lower(korisnicko_ime)) WHERE korisnicko_ime IS NOT NULL AND korisnicko_ime <> '';
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
-- Sačuvane pretrage i obaveštenja o novim odgovarajućim ponudama/potražnjama.
CREATE TABLE IF NOT EXISTS saved_search_alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 query_text text NOT NULL DEFAULT '',
 category text,
 target_type text NOT NULL DEFAULT 'ponude' CHECK (target_type IN ('ponude','zahtevi','oba')),
 active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (length(query_text) >= 2 OR NULLIF(BTRIM(category),'') IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS saved_search_alerts_active_idx ON saved_search_alerts(active,target_type);
CREATE INDEX IF NOT EXISTS saved_search_alerts_user_idx ON saved_search_alerts(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS ponudimi_smart_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 listing_type text NOT NULL CHECK (listing_type IN ('ponude','zahtevi')),
 listing_id uuid NOT NULL,
 title text NOT NULL,
 message text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz,
 UNIQUE(user_id,listing_type,listing_id)
);
CREATE INDEX IF NOT EXISTS ponudimi_smart_notifications_user_idx ON ponudimi_smart_notifications(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS ponudimi_smart_notifications_unread_idx ON ponudimi_smart_notifications(user_id,read_at) WHERE read_at IS NULL;

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
CREATE TABLE IF NOT EXISTS prijave_oglasa (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tabela text NOT NULL CHECK (tabela IN ('ponude','zahtevi')),
 oglas_id uuid NOT NULL,
 prijavio_id uuid REFERENCES users(id) ON DELETE SET NULL,
 razlog text NOT NULL CHECK (razlog IN ('sumnja_na_prevaru','netacni_podaci','neispravan_kontakt','neprimeren_sadrzaj','dupliran_oglas','ostalo')),
 detalji text CHECK (detalji IS NULL OR char_length(detalji) <= 1000),
 status text NOT NULL DEFAULT 'na_cekanju' CHECK (status IN ('na_cekanju','pregledano','odbijeno','oglas_uklonjen','vracen_u_prikaz')),
 admin_napomena text,
 odlucio_id uuid REFERENCES users(id) ON DELETE SET NULL,
 odluceno_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE prijave_oglasa DROP CONSTRAINT IF EXISTS prijave_oglasa_status_check;
ALTER TABLE prijave_oglasa ADD CONSTRAINT prijave_oglasa_status_check CHECK (status IN ('na_cekanju','pregledano','odbijeno','oglas_uklonjen','vracen_u_prikaz'));
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
    promene := promene || ('Cena/budžet: ' || coalesce(iznos_old::text, 'po dogovoru') || ' → ' || coalesce(iznos_new::text, 'po dogovoru') || ' ' || NEW.valuta);
  END IF;
  IF OLD.naslov IS DISTINCT FROM NEW.naslov THEN promene := promene || ('Naslov: ' || NEW.naslov); END IF;
  IF OLD.opis IS DISTINCT FROM NEW.opis THEN promene := promene || 'Opis je izmenjen'; END IF;
  IF OLD.lokacija IS DISTINCT FROM NEW.lokacija THEN promene := promene || ('Lokacija: ' || NEW.lokacija); END IF;
  IF OLD.telefon IS DISTINCT FROM NEW.telefon OR OLD.kontakt_ime IS DISTINCT FROM NEW.kontakt_ime THEN promene := promene || 'Kontakt je izmenjen'; END IF;
  IF OLD.zavrseno IS DISTINCT FROM NEW.zavrseno THEN
    promene := promene || CASE WHEN NEW.zavrseno THEN 'Oglas je završen' ELSE 'Oglas je ponovo aktivan' END;
  END IF;
  IF OLD.pauziran IS DISTINCT FROM NEW.pauziran THEN
    promene := promene || CASE WHEN NEW.pauziran THEN 'Oglas je pauziran' ELSE 'Oglas je ponovo aktiviran nakon pauze' END;
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


-- Evidencija paketa pravnih lica i istorija pretplata.
CREATE TABLE IF NOT EXISTS paketi_firmi (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 paket text NOT NULL CHECK (paket IN ('mesecni','tromesecni','sestomesecni','godisnji')),
 cena_eur numeric(10,2) NOT NULL CHECK (cena_eur IN (10,20,50,100)),
 status text NOT NULL DEFAULT 'na_cekanju' CHECK (status IN ('na_cekanju','aktivan','istekao','otkazan')),
 status_uplate text NOT NULL DEFAULT 'ceka_uplatu' CHECK (status_uplate IN ('ceka_uplatu','placeno','oslobodjeno')),
 vazi_od date NOT NULL,
 vazi_do date NOT NULL,
 napomena text,
 referenca_uplate text,
 kreirao_id uuid REFERENCES users(id) ON DELETE SET NULL,
 email_podsetnik_poslat_at timestamptz,
 email_podsetnik_greska text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (vazi_do > vazi_od)
);
CREATE INDEX IF NOT EXISTS paketi_firmi_user_idx ON paketi_firmi(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS paketi_firmi_aktivni_istek_idx ON paketi_firmi(status,vazi_do) WHERE status='aktivan';

CREATE TABLE IF NOT EXISTS business_package_catalog (
 slug text PRIMARY KEY CHECK (slug IN ('light','average','advanced','total')),
 naziv text NOT NULL,
 cena_eur numeric(10,2) NOT NULL CHECK (cena_eur >= 0),
 trajanje_meseci integer NOT NULL CHECK (trajanje_meseci BETWEEN 1 AND 36),
 opis text NOT NULL DEFAULT '',
 pogodnosti text[] NOT NULL DEFAULT '{}',
 objavljen boolean NOT NULL DEFAULT false,
 pozicija integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO business_package_catalog(slug,naziv,cena_eur,trajanje_meseci,opis,pogodnosti,objavljen,pozicija)
VALUES
 ('light','Light',10,1,'','{}',false,1),
 ('average','Average',20,3,'','{}',false,2),
 ('advanced','Advanced',50,6,'','{}',false,3),
 ('total','Total',100,12,'','{}',false,4)
ON CONFLICT(slug) DO NOTHING;

-- Podrazumevani opisi i pogodnosti poslovnih paketa.
-- Postojeći administratorski unosi se čuvaju; dopunjavaju se samo prazna polja.
UPDATE business_package_catalog
SET opis = CASE slug
  WHEN 'light' THEN 'Paket za firme koje žele da započnu predstavljanje na PonudiMi platformi i provere kako im odgovara poslovno prisustvo tokom jednog meseca.'
  WHEN 'average' THEN 'Paket za firme kojima je potrebno više vremena da predstave svoju ponudu, pronađu zainteresovane kupce i razviju poslovno prisustvo tokom tri meseca.'
  WHEN 'advanced' THEN 'Paket za firme koje žele kontinuitet u predstavljanju svojih proizvoda ili usluga i aktivno korišćenje poslovnih mogućnosti platforme tokom šest meseci.'
  WHEN 'total' THEN 'Paket za firme koje planiraju dugoročno prisustvo na PonudiMi platformi i žele da svoje poslovanje predstavljaju tokom cele godine.'
  ELSE opis
END,
pogodnosti = CASE
  WHEN cardinality(pogodnosti) = 0 THEN CASE slug
    WHEN 'light' THEN ARRAY['Poslovni nalog za firmu','Predstavljanje firme i njene ponude','Objavljivanje ponuda i praćenje interesovanja','Komunikacija sa zainteresovanim korisnicima','Trajanje paketa: 1 mesec']
    WHEN 'average' THEN ARRAY['Poslovni nalog za firmu','Predstavljanje firme i njene ponude','Objavljivanje ponuda i praćenje interesovanja','Komunikacija sa zainteresovanim korisnicima','Trajanje paketa: 3 meseca']
    WHEN 'advanced' THEN ARRAY['Poslovni nalog za firmu','Predstavljanje firme i njene ponude','Objavljivanje ponuda i praćenje interesovanja','Komunikacija sa zainteresovanim korisnicima','Trajanje paketa: 6 meseci']
    WHEN 'total' THEN ARRAY['Poslovni nalog za firmu','Predstavljanje firme i njene ponude','Objavljivanje ponuda i praćenje interesovanja','Komunikacija sa zainteresovanim korisnicima','Trajanje paketa: 12 meseci']
    ELSE pogodnosti
  END
  ELSE pogodnosti
END,
updated_at = now()
WHERE slug IN ('light','average','advanced','total')
  AND (NULLIF(BTRIM(opis),'') IS NULL OR cardinality(pogodnosti) = 0);

ALTER TABLE paketi_firmi DROP CONSTRAINT IF EXISTS paketi_firmi_paket_check;
ALTER TABLE paketi_firmi ADD CONSTRAINT paketi_firmi_paket_check CHECK (paket IN ('mesecni','tromesecni','sestomesecni','godisnji','light','average','advanced','total'));
ALTER TABLE paketi_firmi DROP CONSTRAINT IF EXISTS paketi_firmi_cena_eur_check;
ALTER TABLE paketi_firmi ADD CONSTRAINT paketi_firmi_cena_eur_check CHECK (cena_eur >= 0);

CREATE UNIQUE INDEX IF NOT EXISTS paketi_firmi_jedan_aktivan_po_firmi ON paketi_firmi(user_id) WHERE status='aktivan';


-- Evidencija prihvatanja pravila, obaveštenja o privatnosti i potvrde punoletstva.
CREATE TABLE IF NOT EXISTS prihvatanja_uslova (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 verzija_pravila integer NOT NULL DEFAULT 1,
 verzija_obavestenja_privatnosti text NOT NULL DEFAULT 'nacrt-1.0',
 potvrdjeno_punoletstvo boolean NOT NULL CHECK (potvrdjeno_punoletstvo=true),
 upoznat_sa_privatnoscu boolean NOT NULL CHECK (upoznat_sa_privatnoscu=true),
 prihvaceno_at timestamptz NOT NULL DEFAULT now(),
 ip_adresa text,
 user_agent text
);
ALTER TABLE prihvatanja_uslova ADD COLUMN IF NOT EXISTS upoznat_sa_privatnoscu boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS prihvatanja_uslova_user_idx ON prihvatanja_uslova(user_id,prihvaceno_at DESC);
 
-- Status prodavca za jasno obaveštavanje kupaca na onlajn tržištu.
ALTER TABLE ponude ADD COLUMN IF NOT EXISTS moderacija_blokirana boolean NOT NULL DEFAULT false;
ALTER TABLE zahtevi ADD COLUMN IF NOT EXISTS moderacija_blokirana boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status_trgovca text NOT NULL DEFAULT 'nepotvrdjeno' CHECK (status_trgovca IN ('trgovac','nije_trgovac','nepotvrdjeno'));
ALTER TABLE ponude ADD COLUMN IF NOT EXISTS status_trgovca text NOT NULL DEFAULT 'nepotvrdjeno' CHECK (status_trgovca IN ('trgovac','nije_trgovac','nepotvrdjeno'));
ALTER TABLE zahtevi ADD COLUMN IF NOT EXISTS status_trgovca text NOT NULL DEFAULT 'nepotvrdjeno' CHECK (status_trgovca IN ('trgovac','nije_trgovac','nepotvrdjeno'));


-- Privatne poruke između korisnika i administratorska evidencija.
CREATE TABLE IF NOT EXISTS message_conversations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 listing_type text NOT NULL CHECK (listing_type IN ('ponude','zahtevi')),
 listing_id uuid NOT NULL,
 buyer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 seller_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(listing_type,listing_id,buyer_id,seller_id)
);
CREATE INDEX IF NOT EXISTS message_conversations_buyer_idx ON message_conversations(buyer_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS message_conversations_seller_idx ON message_conversations(seller_id,updated_at DESC);

CREATE TABLE IF NOT EXISTS message_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid NOT NULL REFERENCES message_conversations(id) ON DELETE CASCADE,
 sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(),
 read_at timestamptz
);
CREATE INDEX IF NOT EXISTS message_messages_conversation_idx ON message_messages(conversation_id,created_at,id);
CREATE INDEX IF NOT EXISTS message_messages_unread_idx ON message_messages(conversation_id,sender_id) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS message_archives (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid REFERENCES message_conversations(id) ON DELETE SET NULL,
 file_name text NOT NULL,
 content text NOT NULL,
 sha256 text NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
 message_count integer NOT NULL DEFAULT 0 CHECK (message_count>=0),
 created_by uuid REFERENCES users(id) ON DELETE SET NULL,
 export_reason text NOT NULL,
 listing_type text,
 listing_title text,
 buyer_name text,
 seller_name text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_archives_created_idx ON message_archives(created_at DESC);

CREATE TABLE IF NOT EXISTS message_admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 conversation_id uuid REFERENCES message_conversations(id) ON DELETE SET NULL,
 admin_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL CHECK (action IN ('view','export','download_archive','delete_message','delete_conversation','delete_archive')),
 reason text NOT NULL,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS message_admin_audit_conversation_idx ON message_admin_audit(conversation_id,created_at DESC);
CREATE INDEX IF NOT EXISTS message_admin_audit_admin_idx ON message_admin_audit(admin_id,created_at DESC);
