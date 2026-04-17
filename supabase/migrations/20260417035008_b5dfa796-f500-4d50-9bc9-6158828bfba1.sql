-- 1. Add mpesa_account_code to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS mpesa_account_code text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_profiles_mpesa_account_code ON public.profiles(mpesa_account_code);

-- 2. Function to generate unique 4-digit code
CREATE OR REPLACE FUNCTION public.generate_unique_mpesa_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _attempts int := 0;
BEGIN
  LOOP
    _code := lpad(floor(random() * 9000 + 1000)::int::text, 4, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE mpesa_account_code = _code);
    _attempts := _attempts + 1;
    IF _attempts > 100 THEN
      RAISE EXCEPTION 'Unable to generate unique mpesa account code';
    END IF;
  END LOOP;
  RETURN _code;
END;
$$;

-- 3. Backfill existing users
DO $$
DECLARE
  _user record;
BEGIN
  FOR _user IN SELECT user_id FROM public.profiles WHERE mpesa_account_code IS NULL
  LOOP
    UPDATE public.profiles 
    SET mpesa_account_code = public.generate_unique_mpesa_code()
    WHERE user_id = _user.user_id;
  END LOOP;
END $$;

-- 4. Update handle_new_user_signup trigger to generate code
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    user_id, full_name, email, phone, county, sub_county, ward, address,
    id_number, date_of_birth, is_active, is_verified, disable_reason, mpesa_account_code
  )
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'county',
    new.raw_user_meta_data->>'sub_county',
    new.raw_user_meta_data->>'ward',
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'id_number',
    new.raw_user_meta_data->>'date_of_birth',
    true, true, 'none',
    public.generate_unique_mpesa_code()
  );

  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
  RETURN new;
END;
$$;

-- 5. C2B transactions table (raw inbound payments)
CREATE TABLE IF NOT EXISTS public.mpesa_c2b_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trans_id text UNIQUE NOT NULL,
  trans_type text,
  trans_time text,
  trans_amount numeric NOT NULL,
  business_short_code text,
  bill_ref_number text,
  invoice_number text,
  org_account_balance text,
  third_party_trans_id text,
  msisdn text,
  first_name text,
  middle_name text,
  last_name text,
  -- Routing
  routing_type text, -- wallet, savings, chama, loan, harambee_user, harambee_public, unmapped
  target_user_id uuid,
  target_resource_id uuid, -- savings_id / group_id / loan_id / harambee_id
  -- Processing
  processed boolean DEFAULT false,
  processed_at timestamptz,
  processing_error text,
  raw_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_c2b_trans_id ON public.mpesa_c2b_transactions(trans_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_c2b_target_user ON public.mpesa_c2b_transactions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_c2b_processed ON public.mpesa_c2b_transactions(processed);
CREATE INDEX IF NOT EXISTS idx_mpesa_c2b_bill_ref ON public.mpesa_c2b_transactions(bill_ref_number);

ALTER TABLE public.mpesa_c2b_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own c2b transactions"
ON public.mpesa_c2b_transactions FOR SELECT
USING (auth.uid() = target_user_id);

CREATE POLICY "Admins view all c2b transactions"
ON public.mpesa_c2b_transactions FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update c2b transactions"
ON public.mpesa_c2b_transactions FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- 6. B2C requests table (outbound withdrawals)
CREATE TABLE IF NOT EXISTS public.mpesa_b2c_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 10),
  phone text NOT NULL,
  remarks text,
  occasion text,
  -- Daraja IDs
  conversation_id text,
  originator_conversation_id text UNIQUE,
  -- Result
  status text NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, refunded, timeout
  result_code text,
  result_desc text,
  mpesa_receipt text,
  transaction_completed_date_time text,
  receiver_party_public_name text,
  -- Refund tracking
  refunded boolean DEFAULT false,
  refunded_at timestamptz,
  -- Raw payloads
  request_payload jsonb,
  result_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_b2c_user ON public.mpesa_b2c_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_mpesa_b2c_status ON public.mpesa_b2c_requests(status);
CREATE INDEX IF NOT EXISTS idx_mpesa_b2c_conv ON public.mpesa_b2c_requests(conversation_id);

ALTER TABLE public.mpesa_b2c_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own b2c requests"
ON public.mpesa_b2c_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins view all b2c requests"
ON public.mpesa_b2c_requests FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update b2c requests"
ON public.mpesa_b2c_requests FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- 7. Unmapped payments queue (admin review)
CREATE TABLE IF NOT EXISTS public.mpesa_unmapped_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  c2b_transaction_id uuid NOT NULL REFERENCES public.mpesa_c2b_transactions(id) ON DELETE CASCADE,
  bill_ref_number text NOT NULL,
  amount numeric NOT NULL,
  msisdn text,
  reason text NOT NULL,
  resolved boolean DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mpesa_unmapped_resolved ON public.mpesa_unmapped_payments(resolved);

ALTER TABLE public.mpesa_unmapped_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage unmapped payments"
ON public.mpesa_unmapped_payments FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. Updated_at trigger for b2c
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mpesa_b2c_updated_at ON public.mpesa_b2c_requests;
CREATE TRIGGER trg_mpesa_b2c_updated_at
BEFORE UPDATE ON public.mpesa_b2c_requests
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 9. Withdrawal RPC: deduct first, return request_id
CREATE OR REPLACE FUNCTION public.create_b2c_withdrawal(
  _user_id uuid,
  _amount numeric,
  _phone text,
  _remarks text DEFAULT 'Withdrawal',
  _occasion text DEFAULT 'Wallet withdrawal'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _balance numeric;
  _request_id uuid;
  _orig_conv text;
BEGIN
  IF _amount < 10 THEN
    RAISE EXCEPTION 'Minimum withdrawal is KES 10';
  END IF;

  -- Lock wallet row
  SELECT balance INTO _balance FROM public.wallets WHERE user_id = _user_id FOR UPDATE;
  IF _balance IS NULL OR _balance < _amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance';
  END IF;

  -- Deduct first
  UPDATE public.wallets SET balance = balance - _amount WHERE user_id = _user_id;

  -- Generate originator conversation ID (for idempotency at Daraja)
  _orig_conv := 'B2C-' || gen_random_uuid()::text;

  INSERT INTO public.mpesa_b2c_requests (
    user_id, amount, phone, remarks, occasion, status, originator_conversation_id
  ) VALUES (
    _user_id, _amount, _phone, _remarks, _occasion, 'pending', _orig_conv
  ) RETURNING id INTO _request_id;

  -- Wallet transaction record
  INSERT INTO public.wallet_transactions (user_id, type, amount, description, reference_id)
  VALUES (_user_id, 'withdrawal', _amount, 'M-Pesa withdrawal to ' || _phone, _request_id::text);

  RETURN _request_id;
END;
$$;

-- 10. Refund function (called on B2C failure)
CREATE OR REPLACE FUNCTION public.refund_b2c_withdrawal(_request_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req record;
BEGIN
  SELECT * INTO _req FROM public.mpesa_b2c_requests WHERE id = _request_id FOR UPDATE;
  IF _req IS NULL THEN RAISE EXCEPTION 'B2C request not found'; END IF;
  IF _req.refunded THEN RETURN; END IF;
  IF _req.status = 'completed' THEN
    RAISE EXCEPTION 'Cannot refund a completed withdrawal';
  END IF;

  UPDATE public.wallets SET balance = balance + _req.amount WHERE user_id = _req.user_id;
  UPDATE public.mpesa_b2c_requests
    SET refunded = true, refunded_at = now(), status = COALESCE(NULLIF(status,'pending'), 'refunded')
    WHERE id = _request_id;

  INSERT INTO public.wallet_transactions (user_id, type, amount, description, reference_id)
  VALUES (_req.user_id, 'credit', _req.amount, 'Withdrawal refund: ' || COALESCE(_reason, 'failed'), _request_id::text);

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (_req.user_id, 'Withdrawal Refunded',
    'Your withdrawal of KES ' || _req.amount || ' could not be processed. ' || COALESCE(_reason, '') || ' The amount has been returned to your wallet.',
    'payment');
END;
$$;