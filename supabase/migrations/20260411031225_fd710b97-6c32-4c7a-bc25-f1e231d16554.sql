
-- 1. Add column to store pre-deduction snapshots for rollback
ALTER TABLE public.chama_withdrawals ADD COLUMN IF NOT EXISTS member_snapshots jsonb DEFAULT '[]'::jsonb;

-- 2. Create RPC to immediately debit on withdrawal request
CREATE OR REPLACE FUNCTION public.request_chama_withdrawal_secure(
  _group_id uuid,
  _requested_by uuid,
  _amount numeric,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _wd_id uuid;
  _group_savings numeric;
  _member_count integer;
  _per_member numeric;
  _member record;
  _snapshots jsonb := '[]'::jsonb;
BEGIN
  -- Calculate group total savings
  SELECT COALESCE(SUM(amount), 0) INTO _group_savings FROM chama_savings WHERE group_id = _group_id;
  
  IF _amount > _group_savings THEN
    RAISE EXCEPTION 'Withdrawal amount (%) exceeds group savings (%)', _amount, _group_savings;
  END IF;

  -- Get active member count
  SELECT COUNT(DISTINCT user_id) INTO _member_count FROM chama_savings WHERE group_id = _group_id AND amount > 0;
  IF _member_count = 0 THEN
    RAISE EXCEPTION 'No members with savings in group';
  END IF;

  _per_member := ROUND(_amount::numeric / _member_count, 2);

  -- Snapshot each member's current savings and deduct
  FOR _member IN 
    SELECT user_id, COALESCE(SUM(amount), 0) as total_savings 
    FROM chama_savings 
    WHERE group_id = _group_id 
    GROUP BY user_id 
    HAVING SUM(amount) > 0
  LOOP
    -- Store snapshot for rollback
    _snapshots := _snapshots || jsonb_build_array(jsonb_build_object(
      'user_id', _member.user_id,
      'deducted', LEAST(_per_member, _member.total_savings)
    ));
    
    -- Deduct proportionally from member savings (spread across their records)
    UPDATE chama_savings 
    SET amount = GREATEST(amount - _per_member, 0)
    WHERE group_id = _group_id AND user_id = _member.user_id;

    -- Notify member
    INSERT INTO notifications (user_id, title, message)
    VALUES (_member.user_id, 'Chama Withdrawal Requested',
      'KES ' || _per_member || ' has been deducted from your chama savings for a group withdrawal request of KES ' || _amount || '. If rejected, your savings will be restored.');
  END LOOP;

  -- Create withdrawal record with snapshots
  INSERT INTO chama_withdrawals (group_id, requested_by, amount, reason, status, member_snapshots)
  VALUES (_group_id, _requested_by, _amount, _reason, 'pending', _snapshots)
  RETURNING id INTO _wd_id;

  RETURN _wd_id;
END;
$$;

-- 3. Update handle_chama_withdrawal_decision to credit back on rejection
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
  _snapshot jsonb;
  _snap_user_id uuid;
  _snap_deducted numeric;
BEGIN
  SELECT * INTO _wd FROM chama_withdrawals WHERE id = _withdrawal_id AND status IN ('pending', 'approved_by_leaders');
  IF _wd IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found or already processed';
  END IF;

  IF _decision = 'approved' THEN
    -- Already deducted on request - just update status
    UPDATE chama_withdrawals SET status = 'approved', admin_reason = _admin_reason WHERE id = _withdrawal_id;

    -- Notify requester
    INSERT INTO notifications (user_id, title, message)
    VALUES (_wd.requested_by, 'Chama Withdrawal Approved',
      'Your group withdrawal request for KES ' || _wd.amount || ' has been approved.');

  ELSIF _decision = 'rejected' THEN
    -- Credit back each member using stored snapshots
    IF _wd.member_snapshots IS NOT NULL AND jsonb_array_length(_wd.member_snapshots) > 0 THEN
      FOR _snapshot IN SELECT * FROM jsonb_array_elements(_wd.member_snapshots)
      LOOP
        _snap_user_id := (_snapshot->>'user_id')::uuid;
        _snap_deducted := (_snapshot->>'deducted')::numeric;
        
        -- Credit back to savings
        UPDATE chama_savings 
        SET amount = amount + _snap_deducted
        WHERE group_id = _wd.group_id AND user_id = _snap_user_id;

        -- If no rows updated (member has no savings record), we skip - shouldn't happen
        
        -- Notify member
        INSERT INTO notifications (user_id, title, message)
        VALUES (_snap_user_id, 'Chama Withdrawal Rejected',
          'KES ' || _snap_deducted || ' has been restored to your chama savings. The group withdrawal was rejected.' ||
          CASE WHEN _admin_reason IS NOT NULL THEN ' Reason: ' || _admin_reason ELSE '' END);
      END LOOP;
    END IF;

    UPDATE chama_withdrawals SET status = 'rejected', admin_reason = _admin_reason WHERE id = _withdrawal_id;
  ELSE
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected';
  END IF;

  -- Audit log
  INSERT INTO audit_logs (admin_id, user_id, action, details)
  VALUES (_admin_id, _wd.requested_by, 'chama_withdrawal_' || _decision,
    jsonb_build_object('withdrawal_id', _withdrawal_id, 'amount', _wd.amount, 'group_id', _wd.group_id));
END;
$$;

-- 4. Update monthly emergency deduction to insert contribution records
CREATE OR REPLACE FUNCTION public.run_monthly_emergency_deduction()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  _current_month text := to_char(NOW(), 'YYYY-MM');
BEGIN

WITH eligible AS (
  SELECT cs.id, cs.user_id, cs.group_id
  FROM chama_savings cs
  WHERE cs.amount >= 50
    AND NOT EXISTS (
      SELECT 1 FROM chama_emergency_contributions ec
      WHERE ec.user_id = cs.user_id 
        AND ec.group_id = cs.group_id 
        AND ec.month = _current_month
        AND ec.status = 'paid'
    )
),

deducted AS (
  UPDATE chama_savings cs
  SET 
    amount = cs.amount - 50,
    last_emergency_paid_at = NOW()
  FROM eligible e
  WHERE cs.id = e.id
  RETURNING cs.id, cs.user_id, cs.group_id
),

-- Insert contribution records so the UI shows "Paid"
contributions_inserted AS (
  INSERT INTO chama_emergency_contributions (user_id, group_id, amount, month, status)
  SELECT user_id, group_id, 50, _current_month, 'paid'
  FROM deducted
  RETURNING user_id, group_id
),

group_totals AS (
  SELECT group_id, COUNT(*) * 50 AS total
  FROM deducted
  GROUP BY group_id
)

-- Update emergency fund per group
UPDATE chama_emergency_fund cef
SET balance = cef.balance + gt.total
FROM group_totals gt
WHERE cef.group_id = gt.group_id;

-- Insert notifications
INSERT INTO chama_notifications (user_id, message)
SELECT user_id, 'KES 50 has been deducted for your monthly emergency contribution'
FROM deducted;

INSERT INTO notifications (user_id, title, message)
SELECT user_id, 'Emergency Fund', 'KES 50 has been auto-deducted from your chama savings for the monthly emergency fund contribution.'
FROM deducted;

END;
$$;
