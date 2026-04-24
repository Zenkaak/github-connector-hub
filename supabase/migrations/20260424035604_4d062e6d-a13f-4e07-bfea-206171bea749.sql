
-- 1. Email unique (no dupes exist)
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON public.profiles (LOWER(email))
  WHERE email IS NOT NULL AND email <> '';

-- 2. Trigger-based uniqueness for phone & id_number (allows existing dupes, blocks new)
CREATE OR REPLACE FUNCTION public.enforce_profile_uniqueness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE phone = NEW.phone
        AND user_id <> NEW.user_id
    ) THEN
      RAISE EXCEPTION 'This phone number is already registered to another account.'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  IF NEW.id_number IS NOT NULL AND NEW.id_number <> '' THEN
    IF EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id_number = NEW.id_number
        AND user_id <> NEW.user_id
    ) THEN
      RAISE EXCEPTION 'This ID number is already registered to another account.'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS profiles_uniqueness_check ON public.profiles;
CREATE TRIGGER profiles_uniqueness_check
  BEFORE INSERT OR UPDATE OF phone, id_number ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_uniqueness();

-- 3. Update transfer_wallet_funds to include phone numbers
CREATE OR REPLACE FUNCTION public.transfer_wallet_funds(
  _sender_id uuid, _receiver_id uuid, _amount numeric,
  _reason text DEFAULT NULL, _sender_name text DEFAULT NULL, _receiver_name text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _transfer_id uuid;
  _sender_balance numeric;
  _sender_phone text;
  _receiver_phone text;
BEGIN
  SELECT balance INTO _sender_balance FROM wallets WHERE user_id = _sender_id FOR UPDATE;
  IF _sender_balance IS NULL OR _sender_balance < _amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  SELECT phone INTO _sender_phone FROM profiles WHERE user_id = _sender_id;
  SELECT phone INTO _receiver_phone FROM profiles WHERE user_id = _receiver_id;

  UPDATE wallets SET balance = balance - _amount WHERE user_id = _sender_id;
  INSERT INTO wallets (user_id, balance) VALUES (_receiver_id, _amount)
    ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + _amount;

  INSERT INTO wallet_transactions (user_id, type, amount, description)
    VALUES (_sender_id, 'debit', _amount, 'Transfer to ' || COALESCE(_receiver_name, 'user'));
  INSERT INTO wallet_transactions (user_id, type, amount, description)
    VALUES (_receiver_id, 'credit', _amount, 'Transfer from ' || COALESCE(_sender_name, 'user'));

  INSERT INTO wallet_transfers (
    sender_id, receiver_id, amount, reason,
    sender_name, receiver_name, sender_number, recipient_number
  ) VALUES (
    _sender_id, _receiver_id, _amount, _reason,
    _sender_name, _receiver_name, _sender_phone, _receiver_phone
  ) RETURNING id INTO _transfer_id;

  RETURN _transfer_id;
END; $$;

-- 4. KYC documents table
CREATE TABLE IF NOT EXISTS public.kyc_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  document_type text NOT NULL CHECK (document_type IN ('id_front','id_back','selfie')),
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE (user_id, document_type)
);

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own kyc" ON public.kyc_documents;
CREATE POLICY "Users manage own kyc" ON public.kyc_documents
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all kyc" ON public.kyc_documents;
CREATE POLICY "Admins view all kyc" ON public.kyc_documents
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update kyc" ON public.kyc_documents;
CREATE POLICY "Admins update kyc" ON public.kyc_documents
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. KYC storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
  VALUES ('kyc-documents', 'kyc-documents', false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload own kyc files" ON storage.objects;
CREATE POLICY "Users upload own kyc files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users view own kyc files" ON storage.objects;
CREATE POLICY "Users view own kyc files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update own kyc files" ON storage.objects;
CREATE POLICY "Users update own kyc files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'kyc-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Admins read all kyc files" ON storage.objects;
CREATE POLICY "Admins read all kyc files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND has_role(auth.uid(), 'admin'::app_role));
