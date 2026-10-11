CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

ALTER TABLE public.ponude ADD COLUMN IF NOT EXISTS zavrseno boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.zahtevi ADD COLUMN IF NOT EXISTS zavrseno boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE TABLE public.izmene_oglasa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oglas_id uuid NOT NULL,
  tabela text NOT NULL,
  opis text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.izmene_oglasa (oglas_id, created_at DESC);
GRANT SELECT ON public.izmene_oglasa TO anon, authenticated;
GRANT ALL ON public.izmene_oglasa TO service_role;
ALTER TABLE public.izmene_oglasa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Izmene su javne" ON public.izmene_oglasa FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.log_izmene_oglasa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  iznos_old numeric; iznos_new numeric; promene text[] := '{}';
BEGIN
  IF TG_TABLE_NAME = 'ponude' THEN iznos_old := OLD.cena; iznos_new := NEW.cena;
  ELSE iznos_old := (to_jsonb(OLD)->>'budzet')::numeric; iznos_new := (to_jsonb(NEW)->>'budzet')::numeric; END IF;
  IF iznos_old IS DISTINCT FROM iznos_new THEN
    promene := promene || ('Cena: ' || coalesce(iznos_old::text, 'po dogovoru') || ' → ' || coalesce(iznos_new::text, 'po dogovoru') || ' ' || NEW.valuta);
  END IF;
  IF OLD.naslov IS DISTINCT FROM NEW.naslov THEN promene := promene || ('Naslov: ' || NEW.naslov); END IF;
  IF OLD.opis IS DISTINCT FROM NEW.opis THEN promene := promene || 'Opis je izmenjen'::text; END IF;
  IF OLD.lokacija IS DISTINCT FROM NEW.lokacija THEN promene := promene || ('Lokacija: ' || NEW.lokacija); END IF;
  IF OLD.telefon IS DISTINCT FROM NEW.telefon OR OLD.kontakt_ime IS DISTINCT FROM NEW.kontakt_ime THEN promene := promene || 'Kontakt je izmenjen'::text; END IF;
  IF OLD.zavrseno IS DISTINCT FROM NEW.zavrseno THEN
    promene := promene || (CASE WHEN NEW.zavrseno THEN 'Oglas je završen' ELSE 'Oglas je ponovo aktivan' END);
  END IF;
  IF array_length(promene, 1) > 0 THEN
    NEW.updated_at := now();
    INSERT INTO public.izmene_oglasa (oglas_id, tabela, opis) VALUES (NEW.id, TG_TABLE_NAME, array_to_string(promene, ' · '));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER ponude_izmene BEFORE UPDATE ON public.ponude FOR EACH ROW EXECUTE FUNCTION public.log_izmene_oglasa();
CREATE TRIGGER zahtevi_izmene BEFORE UPDATE ON public.zahtevi FOR EACH ROW EXECUTE FUNCTION public.log_izmene_oglasa();

CREATE OR REPLACE FUNCTION public.normalizuj(t text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public, extensions AS $$
  SELECT lower(extensions.unaccent(replace(replace(coalesce(t, ''), 'đ', 'dj'), 'Đ', 'dj')))
$$;

CREATE OR REPLACE FUNCTION public.koren_reci(w text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN char_length(w) <= 3 THEN w ELSE
    CASE WHEN char_length(r) >= 3 THEN r ELSE left(w, 3) END END
  FROM (SELECT regexp_replace(w, '(icama|icima|ovima|evima|ijama|icom|icu|ica|ice|ici|ama|ima|ama|om|em|og|eg|oj|ih|im|ji|ju|ja|je|u|a|e|i|o)$', '') AS r) s
$$;

CREATE OR REPLACE FUNCTION public.pretraga_uslov(tekst text, q text) RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(bool_and(public.normalizuj(tekst) LIKE '%' || public.koren_reci(w) || '%'), true)
  FROM regexp_split_to_table(public.normalizuj(q), '[^a-z0-9]+') w WHERE w <> ''
$$;

CREATE OR REPLACE FUNCTION public.pretrazi_ponude(q text, mesto text) RETURNS SETOF public.ponude
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM public.ponude p
  WHERE public.pretraga_uslov(p.naslov || ' ' || coalesce(p.opis,'') || ' ' || p.kategorija || ' ' || p.lokacija, q)
    AND public.pretraga_uslov(p.lokacija, mesto)
  ORDER BY p.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.pretrazi_zahteve(q text, mesto text) RETURNS SETOF public.zahtevi
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT * FROM public.zahtevi z
  WHERE public.pretraga_uslov(z.naslov || ' ' || coalesce(z.opis,'') || ' ' || z.kategorija || ' ' || z.lokacija, q)
    AND public.pretraga_uslov(z.lokacija, mesto)
  ORDER BY z.created_at DESC
$$;

GRANT EXECUTE ON FUNCTION public.pretrazi_ponude(text, text), public.pretrazi_zahteve(text, text), public.pretraga_uslov(text, text), public.normalizuj(text), public.koren_reci(text) TO anon, authenticated;