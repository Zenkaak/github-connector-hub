
-- 1. Harambee 4-digit code
ALTER TABLE public.chama_harambees ADD COLUMN IF NOT EXISTS short_code text UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_unique_harambee_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _code text;
  _attempts int := 0;
BEGIN
  LOOP
    _code := lpad(floor(random() * 9000 + 1000)::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.chama_harambees WHERE short_code = _code);
    _attempts := _attempts + 1;
    IF _attempts > 200 THEN
      RAISE EXCEPTION 'Unable to generate unique harambee code';
    END IF;
  END LOOP;
  RETURN _code;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_harambee_short_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := public.generate_unique_harambee_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_harambee_short_code ON public.chama_harambees;
CREATE TRIGGER trg_set_harambee_short_code
BEFORE INSERT ON public.chama_harambees
FOR EACH ROW EXECUTE FUNCTION public.set_harambee_short_code();

-- Backfill existing harambees
UPDATE public.chama_harambees
SET short_code = public.generate_unique_harambee_code()
WHERE short_code IS NULL;

-- 2. Chama join order per user (A, B, C, ...)
ALTER TABLE public.chama_members ADD COLUMN IF NOT EXISTS join_order int;

CREATE OR REPLACE FUNCTION public.set_chama_member_join_order()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  _next int;
BEGIN
  IF NEW.join_order IS NULL THEN
    SELECT COALESCE(MAX(join_order), 0) + 1 INTO _next
    FROM public.chama_members WHERE user_id = NEW.user_id;
    NEW.join_order := _next;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_chama_join_order ON public.chama_members;
CREATE TRIGGER trg_set_chama_join_order
BEFORE INSERT ON public.chama_members
FOR EACH ROW EXECUTE FUNCTION public.set_chama_member_join_order();

-- Backfill join_order for existing members (by created_at per user)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS rn
  FROM public.chama_members
)
UPDATE public.chama_members cm
SET join_order = ordered.rn
FROM ordered
WHERE cm.id = ordered.id AND cm.join_order IS NULL;

-- 3. Withdrawal retry tracking
ALTER TABLE public.mpesa_b2c_requests ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0;
ALTER TABLE public.mpesa_b2c_requests ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;
ALTER TABLE public.mpesa_b2c_requests ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
