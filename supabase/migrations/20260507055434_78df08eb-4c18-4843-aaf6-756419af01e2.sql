CREATE TABLE IF NOT EXISTS public.mpesa_admin_payout_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unmapped_payment_id uuid REFERENCES public.mpesa_unmapped_payments(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  destination_phone text NOT NULL DEFAULT '254719841370',
  status text NOT NULL DEFAULT 'queued', -- queued | submitted | paid | failed
  b2c_request_id uuid REFERENCES public.mpesa_b2c_requests(id) ON DELETE SET NULL,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mpesa_admin_payout_queue_status_idx
  ON public.mpesa_admin_payout_queue(status, created_at);

ALTER TABLE public.mpesa_admin_payout_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payout queue"
  ON public.mpesa_admin_payout_queue FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER mpesa_admin_payout_queue_touch
BEFORE UPDATE ON public.mpesa_admin_payout_queue
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();