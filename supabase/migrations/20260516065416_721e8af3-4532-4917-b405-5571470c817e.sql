-- Backfill MGR cycles whose B2C payout already completed on M-Pesa but were left
-- stuck on 'open' due to a race between the cron's status update and the B2C
-- result callback. Also flip cycles whose B2C definitively failed, and close
-- cycles past payout_date with zero contributions.

-- Cycles where M-Pesa already paid out successfully -> paid_out
UPDATE public.chama_mgr_cycles c
SET status = 'paid_out',
    payout_amount = COALESCE(c.payout_amount, b.amount),
    payout_processed_at = COALESCE(c.payout_processed_at, now())
FROM public.mpesa_b2c_requests b
WHERE b.user_id = c.recipient_id
  AND b.occasion = 'MGR cycle #' || c.cycle_number
  AND b.status = 'completed'
  AND c.status <> 'paid_out';

-- Cycles whose B2C definitively failed -> payout_failed (chair can retry)
UPDATE public.chama_mgr_cycles c
SET status = 'payout_failed'
FROM public.mpesa_b2c_requests b
WHERE b.user_id = c.recipient_id
  AND b.occasion = 'MGR cycle #' || c.cycle_number
  AND b.status = 'failed'
  AND c.status NOT IN ('paid_out', 'payout_failed', 'closed_no_funds');

-- Cycles past payout date with zero contributions -> closed_no_funds
UPDATE public.chama_mgr_cycles c
SET status = 'closed_no_funds',
    payout_amount = 0,
    payout_processed_at = COALESCE(c.payout_processed_at, now())
WHERE c.status = 'open'
  AND c.payout_date < now()
  AND NOT EXISTS (
    SELECT 1 FROM public.chama_mgr_contributions x WHERE x.cycle_id = c.id
  );