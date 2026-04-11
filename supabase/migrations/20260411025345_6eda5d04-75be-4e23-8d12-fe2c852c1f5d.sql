
-- 1. Add payout & close fields to chama_harambees
ALTER TABLE public.chama_harambees
  ADD COLUMN IF NOT EXISTS payout_method text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payout_phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_branch text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closed_by uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS close_reason text DEFAULT NULL;

-- 2. Add same payout fields to harambee_applications
ALTER TABLE public.harambee_applications
  ADD COLUMN IF NOT EXISTS payout_method text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS payout_phone text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_number text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_name text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_branch text DEFAULT NULL;

-- 3. RPC for chama withdrawal decision (approve/reject with per-member logic)
CREATE OR REPLACE FUNCTION public.handle_chama_withdrawal_decision(
  _withdrawal_id uuid,
  _admin_id uuid,
  _decision text,
  _admin_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _wd record;
  _group_savings numeric;
  _member_count integer;
  _per_member numeric;
  _member record;
BEGIN
  -- Get withdrawal
  SELECT * INTO _wd FROM chama_withdrawals WHERE id = _withdrawal_id AND status IN ('pending', 'approved_by_leaders');
  IF _wd IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found or already processed';
  END IF;

  IF _decision = 'approved' THEN
    -- Deduct from group total savings
    _group_savings := COALESCE((SELECT SUM(amount) FROM chama_savings WHERE group_id = _wd.group_id), 0);
    
    IF _wd.amount > _group_savings THEN
      RAISE EXCEPTION 'Withdrawal amount exceeds group savings';
    END IF;

    -- Get active member count
    SELECT COUNT(*) INTO _member_count FROM chama_members WHERE group_id = _wd.group_id AND is_active = true;
    IF _member_count = 0 THEN
      RAISE EXCEPTION 'No active members in group';
    END IF;

    _per_member := ROUND(_wd.amount::numeric / _member_count, 2);

    -- Deduct proportionally from each member's savings
    FOR _member IN SELECT DISTINCT user_id FROM chama_savings WHERE group_id = _wd.group_id
    LOOP
      UPDATE chama_savings 
      SET amount = GREATEST(amount - _per_member, 0)
      WHERE group_id = _wd.group_id AND user_id = _member.user_id;
      
      -- Notify each member
      INSERT INTO notifications (user_id, title, message)
      VALUES (_member.user_id, 'Chama Withdrawal Approved',
        'KES ' || _per_member || ' has been deducted from your chama savings for an approved group withdrawal of KES ' || _wd.amount || '.');
    END LOOP;

    -- Update withdrawal status
    UPDATE chama_withdrawals SET status = 'approved', admin_reason = _admin_reason WHERE id = _withdrawal_id;

  ELSIF _decision = 'rejected' THEN
    -- Just update status - no deductions were made yet
    UPDATE chama_withdrawals SET status = 'rejected', admin_reason = _admin_reason WHERE id = _withdrawal_id;

    -- Notify the requester
    INSERT INTO notifications (user_id, title, message)
    VALUES (_wd.requested_by, 'Chama Withdrawal Rejected',
      'Your group withdrawal request for KES ' || _wd.amount || ' has been rejected.' ||
      CASE WHEN _admin_reason IS NOT NULL THEN ' Reason: ' || _admin_reason ELSE '' END);
  ELSE
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected';
  END IF;

  -- Audit log
  INSERT INTO audit_logs (admin_id, user_id, action, details)
  VALUES (_admin_id, _wd.requested_by, 'chama_withdrawal_' || _decision,
    jsonb_build_object('withdrawal_id', _withdrawal_id, 'amount', _wd.amount, 'group_id', _wd.group_id));
END;
$$;
