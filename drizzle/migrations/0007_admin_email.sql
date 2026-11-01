-- Dodela administratorske uloge isključivo potvrđenom nalogu sa konfigurisanom adresom.
-- Uloga se dodeljuje tek kada je email potvrđen, kako nepotvrđena registracija
-- sa tom adresom ne bi dobila administratorska ovlašćenja.

CREATE OR REPLACE FUNCTION public.dodeli_admin_ulogu_po_emailu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(trim(COALESCE(NEW.email, ''))) = 'igorsystemnet@gmail.com'
     AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSIF TG_OP = 'UPDATE'
        AND lower(trim(COALESCE(OLD.email, ''))) = 'igorsystemnet@gmail.com'
        AND lower(trim(COALESCE(NEW.email, ''))) <> 'igorsystemnet@gmail.com' THEN
    DELETE FROM public.user_roles
    WHERE user_id = NEW.id AND role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dodeli_admin_ulogu_po_emailu ON auth.users;
CREATE TRIGGER dodeli_admin_ulogu_po_emailu
AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.dodeli_admin_ulogu_po_emailu();

-- Aktiviraj admin ulogu i za postojeći nalog ako je email već potvrđen.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(trim(COALESCE(email, ''))) = 'igorsystemnet@gmail.com'
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
