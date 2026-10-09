ALTER TABLE public.profiles ADD COLUMN adresa text;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, ime, telefon, grad, adresa)
  VALUES (NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'ime', NEW.raw_user_meta_data->>'full_name'),
    NEW.raw_user_meta_data->>'telefon',
    NEW.raw_user_meta_data->>'grad',
    NEW.raw_user_meta_data->>'adresa');
  RETURN NEW;
END;
$$;