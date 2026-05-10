CREATE OR REPLACE FUNCTION public.lookup_dasnet_user_by_phone(_phone text)
RETURNS TABLE(user_id uuid, full_name text, phone text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cleaned AS (
    SELECT regexp_replace(_phone, '\s+', '', 'g') AS p
  ), variants AS (
    SELECT p AS v FROM cleaned
    UNION SELECT '+254' || substr(p, 2) FROM cleaned WHERE p LIKE '0%'
    UNION SELECT '254' || substr(p, 2)  FROM cleaned WHERE p LIKE '0%'
    UNION SELECT '0' || substr(p, 5)    FROM cleaned WHERE p LIKE '+254%'
    UNION SELECT '254' || substr(p, 5)  FROM cleaned WHERE p LIKE '+254%'
    UNION SELECT '0' || substr(p, 4)    FROM cleaned WHERE p LIKE '254%'
    UNION SELECT '+' || p               FROM cleaned WHERE p LIKE '254%'
  )
  SELECT p.user_id, p.full_name, p.phone
  FROM public.profiles p
  WHERE p.phone IN (SELECT v FROM variants)
    AND p.is_active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.lookup_dasnet_user_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_dasnet_user_by_phone(text) TO authenticated;