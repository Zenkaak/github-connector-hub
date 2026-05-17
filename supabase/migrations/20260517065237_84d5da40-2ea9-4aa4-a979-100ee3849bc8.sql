-- 1) Delete duplicates that share the same (cycle_id, reference) keeping the earliest
DELETE FROM public.chama_mgr_contributions a
USING public.chama_mgr_contributions b
WHERE a.cycle_id = b.cycle_id
  AND a.reference IS NOT NULL
  AND a.reference = b.reference
  AND a.paid_at > b.paid_at;

-- 2) Also remove same-user duplicates per cycle (defensive — keep earliest)
DELETE FROM public.chama_mgr_contributions a
USING public.chama_mgr_contributions b
WHERE a.cycle_id = b.cycle_id
  AND a.user_id = b.user_id
  AND a.paid_at > b.paid_at;

-- 3) Hard-prevent same receipt crediting same cycle twice
CREATE UNIQUE INDEX IF NOT EXISTS chama_mgr_contrib_cycle_ref_uniq
  ON public.chama_mgr_contributions (cycle_id, reference)
  WHERE reference IS NOT NULL;

-- 4) Hard-prevent same user paying same cycle twice
CREATE UNIQUE INDEX IF NOT EXISTS chama_mgr_contrib_cycle_user_uniq
  ON public.chama_mgr_contributions (cycle_id, user_id);