CREATE OR REPLACE FUNCTION public.increment_emergency_fund(_group_id uuid, _amount numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO chama_emergency_fund (group_id, balance)
  VALUES (_group_id, _amount)
  ON CONFLICT (group_id)
  DO UPDATE SET balance = chama_emergency_fund.balance + _amount;
END;
$$;