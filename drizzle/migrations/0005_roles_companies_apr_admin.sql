CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins add roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins remove roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.profiles
  ADD COLUMN tip_lica text NOT NULL DEFAULT 'fizicko',
  ADD COLUMN naziv_firme text,
  ADD COLUMN pib text,
  ADD COLUMN firma_verifikovana boolean NOT NULL DEFAULT false,
  ADD COLUMN blokiran boolean NOT NULL DEFAULT false,
  ADD COLUMN email text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_tip_lica_chk CHECK (tip_lica IN ('fizicko','pravno'));
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pib_chk CHECK (pib IS NULL OR pib ~ '^[0-9]{9}$');

CREATE TABLE public.apr_firme (
  pib text PRIMARY KEY CHECK (pib ~ '^[0-9]{9}$'),
  maticni_broj text,
  naziv text NOT NULL,
  sediste text,
  adresa text,
  status text,
  synced_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apr_firme TO authenticated;
GRANT ALL ON public.apr_firme TO service_role;
ALTER TABLE public.apr_firme ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage firms" ON public.apr_firme FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.apr_sinhronizacije (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pokrenuo uuid,
  broj_firmi integer NOT NULL DEFAULT 0,
  uspeh boolean NOT NULL DEFAULT false,
  poruka text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.apr_sinhronizacije TO authenticated;
GRANT ALL ON public.apr_sinhronizacije TO service_role;
ALTER TABLE public.apr_sinhronizacije ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read syncs" ON public.apr_sinhronizacije FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_blocked(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT blokiran FROM public.profiles WHERE id = _user_id), false)
$$;

-- Non-admins may not change their own verification/block flags.
CREATE OR REPLACE FUNCTION public.protect_profile_flags()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.blokiran := OLD.blokiran;
    NEW.firma_verifikovana := OLD.firma_verifikovana;
    IF NEW.pib IS DISTINCT FROM OLD.pib THEN
      NEW.firma_verifikovana := EXISTS (SELECT 1 FROM public.apr_firme f WHERE f.pib = NEW.pib);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER profiles_protect_flags BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_flags();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_tip text := CASE WHEN NEW.raw_user_meta_data->>'tip_lica' = 'pravno' THEN 'pravno' ELSE 'fizicko' END;
  v_pib text := NULLIF(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'pib',''), '[^0-9]', '', 'g'), '');
BEGIN
  IF v_tip = 'fizicko' OR v_pib !~ '^[0-9]{9}$' THEN v_pib := NULL; END IF;
  INSERT INTO public.profiles (id, ime, telefon, grad, adresa, email, tip_lica, naziv_firme, pib, firma_verifikovana)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'ime', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'telefon',
    NEW.raw_user_meta_data->>'grad',
    NEW.raw_user_meta_data->>'adresa',
    NEW.email,
    v_tip,
    CASE WHEN v_tip = 'pravno' THEN NEW.raw_user_meta_data->>'naziv_firme' END,
    v_pib,
    v_pib IS NOT NULL AND EXISTS (SELECT 1 FROM public.apr_firme f WHERE f.pib = v_pib));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

UPDATE public.profiles p SET email = u.email FROM auth.users u WHERE u.id = p.id;
INSERT INTO public.user_roles (user_id, role) SELECT id, 'user' FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.user_roles (user_id, role) VALUES ('61459fc1-7c1e-4970-802e-db3cdbeed88f', 'admin') ON CONFLICT DO NOTHING;

-- Admin access to everything
GRANT DELETE ON public.profiles TO authenticated;
CREATE POLICY "Admins read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update offers" ON public.ponude FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete offers" ON public.ponude FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update requests" ON public.zahtevi FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete requests" ON public.zahtevi FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, DELETE ON public.poruke_podrske TO authenticated;
CREATE POLICY "Admins read support" ON public.poruke_podrske FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete support" ON public.poruke_podrske FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Blocked users cannot publish
CREATE POLICY "Blocked cannot post offers" ON public.ponude AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_blocked(auth.uid()));
CREATE POLICY "Blocked cannot post requests" ON public.zahtevi AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_blocked(auth.uid()));