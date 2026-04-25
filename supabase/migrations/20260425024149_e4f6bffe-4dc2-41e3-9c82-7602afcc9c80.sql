
-- 1. Phone normalization function: returns last 9 digits (Kenyan numbers)
CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN _phone IS NULL OR length(trim(_phone)) = 0 THEN NULL
    ELSE RIGHT(regexp_replace(_phone, '[^0-9]', '', 'g'), 9)
  END;
$$;

-- 2. Drop old trigger & function
DROP TRIGGER IF EXISTS profiles_uniqueness_check ON public.profiles;
DROP FUNCTION IF EXISTS public.enforce_profile_uniqueness();

-- 3. Drop weak email index if exists, recreate strict ones
DROP INDEX IF EXISTS public.profiles_email_unique;
DROP INDEX IF EXISTS public.profiles_phone_unique;
DROP INDEX IF EXISTS public.profiles_id_number_unique;

-- 4. Strict partial unique indexes (only enforce on non-empty values)
CREATE UNIQUE INDEX profiles_email_unique
  ON public.profiles (LOWER(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX profiles_phone_unique
  ON public.profiles (public.normalize_phone(phone))
  WHERE phone IS NOT NULL AND phone <> '' AND public.normalize_phone(phone) IS NOT NULL;

CREATE UNIQUE INDEX profiles_id_number_unique
  ON public.profiles (id_number)
  WHERE id_number IS NOT NULL AND id_number <> '';

-- 5. Updated trigger: catches dups before signup completes & gives friendly errors
CREATE OR REPLACE FUNCTION public.enforce_profile_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _norm_phone text;
BEGIN
  _norm_phone := public.normalize_phone(NEW.phone);

  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE LOWER(email) = LOWER(NEW.email) AND user_id <> NEW.user_id) THEN
      RAISE EXCEPTION 'This email is already registered' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  IF _norm_phone IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE public.normalize_phone(phone) = _norm_phone AND user_id <> NEW.user_id) THEN
      RAISE EXCEPTION 'This phone number is already registered' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  IF NEW.id_number IS NOT NULL AND NEW.id_number <> '' THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id_number = NEW.id_number AND user_id <> NEW.user_id) THEN
      RAISE EXCEPTION 'This ID number is already registered' USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_uniqueness_check
  BEFORE INSERT OR UPDATE OF email, phone, id_number ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_uniqueness();

-- 6. Reset admin roles
DELETE FROM public.user_roles WHERE role = 'admin';
UPDATE public.profiles SET is_admin = false WHERE is_admin = true;

-- 7. Assign dasnetventures@gmail.com as sole admin
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role FROM public.profiles WHERE LOWER(email) = 'dasnetventures@gmail.com'
ON CONFLICT DO NOTHING;

UPDATE public.profiles SET is_admin = true WHERE LOWER(email) = 'dasnetventures@gmail.com';
