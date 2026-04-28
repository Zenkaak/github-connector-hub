-- Enable pgcrypto for hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- User PINs table (stores ONLY the hash)
CREATE TABLE IF NOT EXISTS public.user_pins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  pin_hash text NOT NULL,
  failed_attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pin"
  ON public.user_pins FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pin"
  ON public.user_pins FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pin"
  ON public.user_pins FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all pins"
  ON public.user_pins FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Set/reset PIN (called by authenticated user)
CREATE OR REPLACE FUNCTION public.set_user_pin(_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'PIN must be 4 digits'; END IF;

  INSERT INTO public.user_pins (user_id, pin_hash, failed_attempts, locked_until, updated_at)
  VALUES (_uid, crypt(_pin, gen_salt('bf')), 0, NULL, now())
  ON CONFLICT (user_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash,
        failed_attempts = 0,
        locked_until = NULL,
        updated_at = now();
END;
$$;

-- Verify PIN by email + pin (used for PIN login). Returns auth user_id and email if match.
CREATE OR REPLACE FUNCTION public.verify_pin_login(_identifier text, _pin text)
RETURNS TABLE(user_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _profile RECORD;
  _pin_row RECORD;
  _phone text;
BEGIN
  IF _pin !~ '^[0-9]{4}$' THEN RAISE EXCEPTION 'Invalid PIN'; END IF;

  -- Try email first, then phone
  SELECT p.user_id, p.email, p.phone, p.is_active
    INTO _profile
  FROM public.profiles p
  WHERE LOWER(p.email) = LOWER(_identifier)
  LIMIT 1;

  IF _profile.user_id IS NULL THEN
    _phone := _identifier;
    IF _phone ~ '^0' THEN _phone := '+254' || substring(_phone from 2); END IF;
    SELECT p.user_id, p.email, p.phone, p.is_active
      INTO _profile
    FROM public.profiles p
    WHERE p.phone = _identifier OR p.phone = _phone
    LIMIT 1;
  END IF;

  IF _profile.user_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  IF _profile.is_active = false THEN
    RAISE EXCEPTION 'Account is disabled';
  END IF;

  SELECT * INTO _pin_row FROM public.user_pins WHERE user_pins.user_id = _profile.user_id;
  IF _pin_row.pin_hash IS NULL THEN
    RAISE EXCEPTION 'No PIN set for this account';
  END IF;

  IF _pin_row.locked_until IS NOT NULL AND _pin_row.locked_until > now() THEN
    RAISE EXCEPTION 'PIN locked. Try again later.';
  END IF;

  IF crypt(_pin, _pin_row.pin_hash) = _pin_row.pin_hash THEN
    UPDATE public.user_pins
       SET failed_attempts = 0, locked_until = NULL, updated_at = now()
     WHERE user_pins.user_id = _profile.user_id;
    RETURN QUERY SELECT _profile.user_id, _profile.email;
  ELSE
    UPDATE public.user_pins
       SET failed_attempts = failed_attempts + 1,
           locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
           updated_at = now()
     WHERE user_pins.user_id = _profile.user_id;
    RAISE EXCEPTION 'Incorrect PIN';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin_login(text, text) TO anon, authenticated;

-- Trigger to bump updated_at
CREATE OR REPLACE FUNCTION public.touch_user_pins() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS user_pins_touch ON public.user_pins;
CREATE TRIGGER user_pins_touch BEFORE UPDATE ON public.user_pins
  FOR EACH ROW EXECUTE FUNCTION public.touch_user_pins();