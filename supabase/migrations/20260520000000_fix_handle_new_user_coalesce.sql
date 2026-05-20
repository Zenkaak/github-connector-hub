-- Fix: make handle_new_user and handle_new_user_signup robust to NULL metadata.
--
-- Root cause: admin-created users (e.g. via create-tenant edge function) do not
-- supply county/sub_county/ward/address/id_number/date_of_birth in user_metadata.
-- handle_new_user_signup was explicitly inserting those as NULL, which violated
-- the NOT NULL constraints on the profiles table even though defaults are defined.
-- PostgreSQL only uses column DEFAULTs when the column is OMITTED from the INSERT;
-- an explicit NULL always fails a NOT NULL constraint.
--
-- Fix: wrap every metadata extraction in COALESCE(..., '') and add ON CONFLICT
-- guards on both inserts so partial retries don't fail.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, email, full_name, phone,
    county, sub_county, ward, address,
    id_number, date_of_birth,
    is_active, is_verified, disable_reason,
    mpesa_account_code
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'county', ''),
    COALESCE(NEW.raw_user_meta_data->>'sub_county', ''),
    COALESCE(NEW.raw_user_meta_data->>'ward', ''),
    COALESCE(NEW.raw_user_meta_data->>'address', ''),
    COALESCE(NEW.raw_user_meta_data->>'id_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'date_of_birth', ''),
    true,
    true,
    'none',
    public.generate_unique_mpesa_code()
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.wallets (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Apply same COALESCE hardening to handle_new_user_signup so it is also safe
-- when called directly (e.g. if the trigger is ever pointed at it).
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, full_name, email, phone,
    county, sub_county, ward, address,
    id_number, date_of_birth,
    is_active, is_verified, disable_reason,
    mpesa_account_code
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'county', ''),
    COALESCE(NEW.raw_user_meta_data->>'sub_county', ''),
    COALESCE(NEW.raw_user_meta_data->>'ward', ''),
    COALESCE(NEW.raw_user_meta_data->>'address', ''),
    COALESCE(NEW.raw_user_meta_data->>'id_number', ''),
    COALESCE(NEW.raw_user_meta_data->>'date_of_birth', ''),
    true,
    true,
    'none',
    public.generate_unique_mpesa_code()
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
