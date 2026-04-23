
-- 1. Add missing RLS policy for users to update their own wallet
-- (currently only admins can update, which broke MGR wallet payments)
DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;
CREATE POLICY "Users can update own wallet"
ON public.wallets
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2. Secure RPC: atomic wallet debit + MGR contribution + late penalty handling
CREATE OR REPLACE FUNCTION public.pay_mgr_from_wallet(
  _user_id uuid,
  _cycle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cycle record;
  v_balance numeric;
  v_total numeric;
  v_is_late boolean := false;
  v_penalty numeric := 0;
  v_already int;
BEGIN
  -- Lock cycle row
  SELECT * INTO v_cycle FROM chama_mgr_cycles WHERE id = _cycle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cycle not found'; END IF;
  IF v_cycle.status <> 'open' THEN RAISE EXCEPTION 'Cycle is not open'; END IF;

  -- Already paid?
  SELECT count(*) INTO v_already FROM chama_mgr_contributions
   WHERE cycle_id = _cycle_id AND user_id = _user_id;
  IF v_already > 0 THEN RAISE EXCEPTION 'You have already paid this cycle'; END IF;

  -- Late?
  IF now() > v_cycle.deadline THEN
    v_is_late := true;
    v_penalty := COALESCE(v_cycle.penalty_amount, 0);
  END IF;
  v_total := v_cycle.contribution_amount + v_penalty;

  -- Lock + read wallet balance
  SELECT balance INTO v_balance FROM wallets WHERE user_id = _user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'Wallet not found'; END IF;
  IF v_balance < v_total THEN
    RAISE EXCEPTION 'Insufficient wallet balance. You need KES % (incl. KES % late penalty).', v_total, v_penalty;
  END IF;

  -- Debit wallet
  UPDATE wallets SET balance = balance - v_total WHERE user_id = _user_id;
  INSERT INTO wallet_transactions(user_id, type, amount, description)
  VALUES (_user_id, 'debit', v_total,
          'Merry-go-round cycle #' || v_cycle.cycle_number ||
          CASE WHEN v_is_late THEN ' (incl. KES ' || v_penalty || ' late penalty)' ELSE '' END);

  -- Insert contribution
  INSERT INTO chama_mgr_contributions(cycle_id, group_id, user_id, amount, payment_method)
  VALUES (_cycle_id, v_cycle.group_id, _user_id, v_cycle.contribution_amount, 'wallet');

  -- Notify recipient
  INSERT INTO notifications(user_id, title, message, type)
  VALUES (
    v_cycle.recipient_id,
    'Merry-Go-Round Contribution',
    (SELECT COALESCE(full_name, 'A member') FROM profiles WHERE user_id = _user_id) ||
    ' has paid KES ' || v_cycle.contribution_amount ||
    ' for cycle #' || v_cycle.cycle_number ||
    CASE WHEN v_is_late THEN ' (late, +KES ' || v_penalty || ' penalty)' ELSE '' END,
    'chama'
  );

  RETURN jsonb_build_object(
    'ok', true,
    'amount_charged', v_total,
    'penalty', v_penalty,
    'late', v_is_late,
    'new_balance', v_balance - v_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pay_mgr_from_wallet(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.pay_mgr_from_wallet(uuid, uuid) TO authenticated;

-- 3. Reverse the 3 wallet MGR contributions that were inserted without debiting
-- (cycle 06ffa1f0..., user 0cd585fa..., 2 x KES 10 wallet entries from yesterday/today)
-- Per audit: contributions at 2026-04-22 10:41 and 2026-04-23 01:33 had NO matching wallet debit.
DELETE FROM chama_mgr_contributions
WHERE id IN (
  '50740994-427c-46e0-b367-04985bad1c6a',
  '2dac5b18-7a81-4285-9ca7-01e0ae65a642'
);
