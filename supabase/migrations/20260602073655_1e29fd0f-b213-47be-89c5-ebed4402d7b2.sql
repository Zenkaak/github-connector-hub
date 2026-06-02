
CREATE OR REPLACE FUNCTION public.sync_harambee_contribution_on_stk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'success'
     AND NEW.purpose = 'harambee'
     AND NEW.harambee_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status)
     AND EXISTS (SELECT 1 FROM public.chama_harambees h WHERE h.id = NEW.harambee_id)
     AND NOT EXISTS (
       SELECT 1 FROM public.chama_harambee_contributions c
       WHERE c.harambee_id = NEW.harambee_id
         AND c.stk_reference IS NOT DISTINCT FROM NEW.mpesa_receipt
     )
  THEN
    INSERT INTO public.chama_harambee_contributions (
      harambee_id, amount, contributor_name, stk_reference, user_id, created_at
    ) VALUES (
      NEW.harambee_id, NEW.amount, NEW.contributor_name,
      NEW.mpesa_receipt, NEW.user_id, now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_harambee_contribution_ins ON public.stk_transactions;
CREATE TRIGGER trg_sync_harambee_contribution_ins
AFTER INSERT ON public.stk_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_harambee_contribution_on_stk();

DROP TRIGGER IF EXISTS trg_sync_harambee_contribution_upd ON public.stk_transactions;
CREATE TRIGGER trg_sync_harambee_contribution_upd
AFTER UPDATE ON public.stk_transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_harambee_contribution_on_stk();

INSERT INTO public.chama_harambee_contributions
  (harambee_id, amount, contributor_name, stk_reference, user_id, created_at)
SELECT s.harambee_id, s.amount, s.contributor_name, s.mpesa_receipt, s.user_id, s.created_at
FROM public.stk_transactions s
WHERE s.status = 'success'
  AND s.purpose = 'harambee'
  AND s.harambee_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.chama_harambees h WHERE h.id = s.harambee_id)
  AND NOT EXISTS (
    SELECT 1 FROM public.chama_harambee_contributions c
    WHERE c.harambee_id = s.harambee_id
      AND c.stk_reference IS NOT DISTINCT FROM s.mpesa_receipt
  );

UPDATE public.chama_harambees h
SET raised_amount = COALESCE(sub.total, 0)
FROM (
  SELECT harambee_id, SUM(amount) AS total
  FROM public.chama_harambee_contributions
  GROUP BY harambee_id
) sub
WHERE h.id = sub.harambee_id;
