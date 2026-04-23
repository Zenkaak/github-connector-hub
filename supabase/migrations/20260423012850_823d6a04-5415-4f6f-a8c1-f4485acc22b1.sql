-- Allow new MGR cycle statuses
ALTER TABLE public.chama_mgr_cycles DROP CONSTRAINT IF EXISTS chama_mgr_cycles_status_check;
ALTER TABLE public.chama_mgr_cycles
  ADD CONSTRAINT chama_mgr_cycles_status_check
  CHECK (status = ANY (ARRAY['open'::text,'paid_out'::text,'payout_failed'::text,'closed_no_funds'::text,'cancelled'::text]));

-- Enable cron + http
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;