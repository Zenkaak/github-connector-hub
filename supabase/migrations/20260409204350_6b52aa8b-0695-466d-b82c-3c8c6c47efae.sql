CREATE OR REPLACE FUNCTION public.insert_harambee_contribution()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'success'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.purpose = 'harambee'
     AND NEW.harambee_id IS NOT NULL THEN
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