CREATE TABLE IF NOT EXISTS public.password_recovery_codes (
  email text PRIMARY KEY,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.password_recovery_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only"
  ON public.password_recovery_codes FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');