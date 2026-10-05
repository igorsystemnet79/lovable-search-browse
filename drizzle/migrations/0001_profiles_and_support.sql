CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ime text, telefon text, grad text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Svoj profil citanje" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Svoj profil izmena" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Svoj profil unos" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, ime, telefon, grad) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'ime', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'telefon',
    NEW.raw_user_meta_data->>'grad');
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.poruke_podrske (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ime text NOT NULL CHECK (char_length(ime) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 255),
  poruka text NOT NULL CHECK (char_length(poruka) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.poruke_podrske TO anon, authenticated;
GRANT ALL ON public.poruke_podrske TO service_role;
ALTER TABLE public.poruke_podrske ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Svako moze poslati poruku" ON public.poruke_podrske FOR INSERT TO anon, authenticated WITH CHECK (true);