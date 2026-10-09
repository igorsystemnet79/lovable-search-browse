GRANT UPDATE, DELETE ON public.ponude TO authenticated;
GRANT UPDATE, DELETE ON public.zahtevi TO authenticated;

CREATE POLICY "Owners update offers" ON public.ponude FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid()) AND istaknuto = false
  AND char_length(trim(naslov)) BETWEEN 3 AND 150 AND char_length(trim(lokacija)) BETWEEN 2 AND 100
  AND char_length(trim(kontakt_ime)) BETWEEN 2 AND 100 AND telefon ~ '^[+0-9 ()-]{6,30}$'
  AND char_length(coalesce(opis,'')) <= 3000 AND (cena IS NULL OR cena >= 0));
CREATE POLICY "Owners delete offers" ON public.ponude FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Owners update requests" ON public.zahtevi FOR UPDATE TO authenticated
USING (user_id = (SELECT auth.uid()))
WITH CHECK (user_id = (SELECT auth.uid())
  AND char_length(trim(naslov)) BETWEEN 3 AND 150 AND char_length(trim(lokacija)) BETWEEN 2 AND 100
  AND char_length(trim(kontakt_ime)) BETWEEN 2 AND 100 AND telefon ~ '^[+0-9 ()-]{6,30}$'
  AND char_length(coalesce(opis,'')) <= 3000 AND (budzet IS NULL OR budzet >= 0));
CREATE POLICY "Owners delete requests" ON public.zahtevi FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

CREATE TABLE public.pracenja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ponuda_id uuid NOT NULL REFERENCES public.ponude(id) ON DELETE CASCADE,
  pocetna_cena numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ponuda_id)
);
GRANT SELECT, INSERT, DELETE ON public.pracenja TO authenticated;
GRANT ALL ON public.pracenja TO service_role;
ALTER TABLE public.pracenja ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own follows read" ON public.pracenja FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Own follows add" ON public.pracenja FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "Own follows remove" ON public.pracenja FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));