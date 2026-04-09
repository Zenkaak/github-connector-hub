
-- 1. Add withdrawal_amount column to savings_withdrawal_requests to track debited amount
ALTER TABLE public.savings_withdrawal_requests ADD COLUMN IF NOT EXISTS withdrawal_amount numeric DEFAULT 0;

-- 2. Create chama_emergency_fund table
CREATE TABLE IF NOT EXISTS public.chama_emergency_fund (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chama_emergency_fund ENABLE ROW LEVEL SECURITY;

-- 3. Create chama_emergency_contributions table
CREATE TABLE IF NOT EXISTS public.chama_emergency_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 50,
  month text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  stk_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.chama_emergency_contributions ENABLE ROW LEVEL SECURITY;

-- 4. Add platform setting for emergency fund amount
INSERT INTO public.platform_settings (key, value, label, category, description)
VALUES ('chama_emergency_fee', '50', 'Chama Emergency Fee (KES)', 'chama', 'Monthly emergency fund contribution per member')
ON CONFLICT (key) DO NOTHING;

-- 5. RLS policies for emergency fund
CREATE POLICY "Members can view their group emergency fund"
ON public.chama_emergency_fund FOR SELECT TO authenticated
USING (public.is_chama_member(group_id, auth.uid()));

CREATE POLICY "Members can view their group emergency contributions"
ON public.chama_emergency_contributions FOR SELECT TO authenticated
USING (public.is_chama_member(group_id, auth.uid()));

CREATE POLICY "Members can insert own emergency contributions"
ON public.chama_emergency_contributions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.is_chama_member(group_id, auth.uid()));

-- 6. DB function to handle savings withdrawal request with immediate debit
CREATE OR REPLACE FUNCTION public.request_savings_withdrawal(
  _savings_id uuid,
  _user_id uuid,
  _reason text,
  _penalty_percentage numeric DEFAULT 20
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _saved_amount numeric;
  _request_id uuid;
BEGIN
  -- Get current saved amount
  SELECT saved_amount INTO _saved_amount
  FROM personal_savings
  WHERE id = _savings_id AND user_id = _user_id;

  IF _saved_amount IS NULL OR _saved_amount <= 0 THEN
    RAISE EXCEPTION 'No funds available for withdrawal';
  END IF;

  -- Immediately debit the savings
  UPDATE personal_savings
  SET saved_amount = 0, status = 'pending_withdrawal'
  WHERE id = _savings_id AND user_id = _user_id;

  -- Create withdrawal request with the debited amount stored
  INSERT INTO savings_withdrawal_requests (savings_id, user_id, reason, penalty_percentage, withdrawal_amount, status)
  VALUES (_savings_id, _user_id, _reason, _penalty_percentage, _saved_amount, 'pending')
  RETURNING id INTO _request_id;

  RETURN _request_id;
END;
$$;

-- 7. DB function for admin to approve/reject savings withdrawal
CREATE OR REPLACE FUNCTION public.handle_savings_withdrawal_decision(
  _request_id uuid,
  _admin_id uuid,
  _decision text,
  _admin_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _wr record;
  _payout numeric;
BEGIN
  -- Get the withdrawal request
  SELECT * INTO _wr FROM savings_withdrawal_requests WHERE id = _request_id AND status = 'pending';
  IF _wr IS NULL THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;

  IF _decision = 'approved' THEN
    -- Calculate payout after penalty
    _payout := ROUND(_wr.withdrawal_amount * (1 - _wr.penalty_percentage / 100));

    -- Credit user wallet
    UPDATE wallets SET balance = balance + _payout WHERE user_id = _wr.user_id;

    -- Record wallet transaction
    INSERT INTO wallet_transactions (user_id, type, amount, description)
    VALUES (_wr.user_id, 'credit', _payout, 'Savings withdrawal (penalty ' || _wr.penalty_percentage || '% applied)');

    -- Mark savings as withdrawn
    UPDATE personal_savings SET status = 'withdrawn' WHERE id = _wr.savings_id;

    -- Update request
    UPDATE savings_withdrawal_requests SET status = 'approved', admin_reason = _admin_reason WHERE id = _request_id;

    -- Notify user
    INSERT INTO notifications (user_id, title, message)
    VALUES (_wr.user_id, 'Savings Withdrawal Approved',
      'KES ' || _payout || ' has been credited to your wallet after ' || _wr.penalty_percentage || '% penalty.');

  ELSIF _decision = 'rejected' THEN
    -- Credit back the debited amount to savings
    UPDATE personal_savings
    SET saved_amount = saved_amount + _wr.withdrawal_amount, status = 'active'
    WHERE id = _wr.savings_id;

    -- Update request
    UPDATE savings_withdrawal_requests SET status = 'rejected', admin_reason = _admin_reason WHERE id = _request_id;

    -- Notify user
    INSERT INTO notifications (user_id, title, message)
    VALUES (_wr.user_id, 'Savings Withdrawal Rejected',
      'Your withdrawal request has been rejected. KES ' || _wr.withdrawal_amount || ' has been restored to your savings.' ||
      CASE WHEN _admin_reason IS NOT NULL THEN ' Reason: ' || _admin_reason ELSE '' END);
  ELSE
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected';
  END IF;

  -- Audit log
  INSERT INTO audit_logs (admin_id, user_id, action, details)
  VALUES (_admin_id, _wr.user_id, 'savings_withdrawal_' || _decision,
    jsonb_build_object('request_id', _request_id, 'amount', _wr.withdrawal_amount, 'payout', _payout));
END;
$$;
