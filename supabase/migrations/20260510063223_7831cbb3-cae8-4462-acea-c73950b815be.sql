ALTER TABLE public.mpesa_unmapped_payments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_mpesa_unmapped_status
  ON public.mpesa_unmapped_payments (status);