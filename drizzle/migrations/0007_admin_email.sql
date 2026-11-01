-- PonudiMi: administratorski pristup samo za potvrđeni nalog igorsystemnet@gmail.com.
-- Uklanja staru administratorsku dodelu po fiksnom UUID-u iz migracije 0005.
-- Ne briše korisničke naloge, oglase, zahteve ili druge podatke.

CREATE OR REPLACE FUNCTION public.dodeli_admin_ulogu_po_emailu()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.user_roles
  WHERE user_id = NEW.id
    AND role = 'admin';

  IF lower(trim(COALESCE(NEW.email, ''))) = 'igorsystemnet@gmail.com'
     AND NEW.email_confirmed_at IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS dodeli_admin_ulogu_po_emailu ON auth.users;

CREATE TRIGGER dodeli_admin_ulogu_po_emailu
AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.dodeli_admin_ulogu_po_emailu();

DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id NOT IN (
    SELECT id
    FROM auth.users
    WHERE lower(trim(COALESCE(email, ''))) = 'igorsystemnet@gmail.com'
      AND email_confirmed_at IS NOT NULL
  );

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE lower(trim(COALESCE(email, ''))) = 'igorsystemnet@gmail.com'
  AND email_confirmed_at IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
