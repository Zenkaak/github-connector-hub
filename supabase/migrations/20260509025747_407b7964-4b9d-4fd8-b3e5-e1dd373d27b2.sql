CREATE TABLE IF NOT EXISTS public.login_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.login_otp_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_client_access" ON public.login_otp_codes FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_login_otp_codes_expires ON public.login_otp_codes(expires_at);