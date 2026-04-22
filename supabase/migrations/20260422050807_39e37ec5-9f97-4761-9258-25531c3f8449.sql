ALTER TABLE public.chama_withdrawals DROP CONSTRAINT IF EXISTS chama_withdrawals_status_check;
ALTER TABLE public.chama_withdrawals ADD CONSTRAINT chama_withdrawals_status_check
  CHECK (status = ANY (ARRAY['pending'::text, 'approved_by_leaders'::text, 'approved'::text, 'rejected'::text, 'disbursed'::text]));