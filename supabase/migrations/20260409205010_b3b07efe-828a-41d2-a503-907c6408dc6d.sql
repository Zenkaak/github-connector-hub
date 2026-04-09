DROP TRIGGER IF EXISTS trg_harambee_contribution ON public.stk_transactions;

CREATE OR REPLACE FUNCTION public.insert_harambee_contribution()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'success'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.purpose = 'harambee'
     AND NEW.harambee_id IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM public.chama_harambee_contributions c
       WHERE c.harambee_id = NEW.harambee_id
         AND c.stk_reference IS NOT DISTINCT FROM NEW.mpesa_receipt
     ) THEN
    INSERT INTO public.chama_harambee_contributions (
      harambee_id,
      amount,
      contributor_name,
      stk_reference,
      user_id,
      created_at
    )
    VALUES (
      NEW.harambee_id,
      NEW.amount,
      NEW.contributor_name,
      NEW.mpesa_receipt,
      NEW.user_id,
      now()
    );
  END IF;

  RETURN NEW;
END;
$$;

WITH ranked_matches AS (
  SELECT
    tx.id AS tx_id,
    cs.stk_reference,
    cs.created_at AS savings_created_at,
    ROW_NUMBER() OVER (
      PARTITION BY tx.id
      ORDER BY cs.created_at ASC
    ) AS rn
  FROM public.stk_transactions tx
  JOIN public.chama_savings cs
    ON cs.user_id = tx.user_id
   AND cs.group_id = tx.group_id
   AND cs.amount = tx.amount
   AND cs.stk_reference IS NOT NULL
   AND cs.created_at BETWEEN tx.created_at AND tx.created_at + interval '15 minutes'
  WHERE tx.status = 'pending'
    AND tx.purpose = 'chama_savings'
)
UPDATE public.stk_transactions tx
SET status = 'success',
    mpesa_receipt = COALESCE(tx.mpesa_receipt, rm.stk_reference),
    result_code = COALESCE(tx.result_code, '0'),
    result_desc = COALESCE(tx.result_desc, 'The service request is processed successfully.'),
    paid_at = COALESCE(tx.paid_at, rm.savings_created_at),
    updated_at = now()
FROM ranked_matches rm
WHERE tx.id = rm.tx_id
  AND rm.rn = 1;