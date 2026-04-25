
CREATE OR REPLACE FUNCTION public.normalize_phone(_phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _phone IS NULL OR length(trim(_phone)) = 0 THEN NULL
    ELSE RIGHT(regexp_replace(_phone, '[^0-9]', '', 'g'), 9)
  END;
$$;
