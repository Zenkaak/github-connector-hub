
-- 1. Add period_date to chama_penalties
ALTER TABLE public.chama_penalties ADD COLUMN IF NOT EXISTS period_date date;

-- 2. Drop ALL conflicting triggers on chama_withdrawals
DROP TRIGGER IF EXISTS trg_check_arrears ON public.chama_withdrawals;
DROP TRIGGER IF EXISTS trg_deduct_on_request ON public.chama_withdrawals;
DROP TRIGGER IF EXISTS trg_reject_restore ON public.chama_withdrawals;
DROP TRIGGER IF EXISTS trg_deduct ON public.chama_withdrawals;
DROP TRIGGER IF EXISTS trg_consensus ON public.chama_withdrawals;
DROP TRIGGER IF EXISTS trg_reversal ON public.chama_withdrawals;
DROP TRIGGER IF EXISTS trg_reversal_final ON public.chama_withdrawals;

-- 3. Drop old trigger on approvals
DROP TRIGGER IF EXISTS trg_approval ON public.chama_withdrawal_approvals;

-- 4. Contribution amount validation trigger
CREATE OR REPLACE FUNCTION public.validate_chama_contribution_amount()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.contribution_amount < 50 THEN
    RAISE EXCEPTION 'Contribution amount cannot be less than KES 50';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_contribution_amount ON public.chama_groups;
CREATE TRIGGER trg_validate_contribution_amount
  BEFORE INSERT OR UPDATE OF contribution_amount ON public.chama_groups
  FOR EACH ROW EXECUTE FUNCTION validate_chama_contribution_amount();

-- 5. Rewrite request_chama_withdrawal_secure with ALL rules
CREATE OR REPLACE FUNCTION public.request_chama_withdrawal_secure(
  _group_id uuid, _requested_by uuid, _amount numeric, _reason text DEFAULT NULL
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
  _arrears_members text := '';
  _zero_members text := '';
  _below_min_members text := '';
  _contrib_amount numeric;
  _contrib_freq text;
  _deduct numeric;
  _expected numeric;
  _actual numeric;
  _arrears numeric;
BEGIN
  -- Get group settings
  SELECT contribution_amount, contribution_frequency 
  INTO _contrib_amount, _contrib_freq
  FROM chama_groups WHERE id = _group_id;

  -- Calculate total group savings
  SELECT COALESCE(SUM(amount), 0) INTO _group_savings 
  FROM chama_savings WHERE group_id = _group_id;
  
  IF _amount > _group_savings THEN
    RAISE EXCEPTION 'Withdrawal amount (KES %) exceeds group savings (KES %)', _amount, _group_savings;
  END IF;

  -- Count active members
  SELECT COUNT(*) INTO _member_count 
  FROM chama_members WHERE group_id = _group_id AND is_active = true;
  
  IF _member_count = 0 THEN
    RAISE EXCEPTION 'No active members in group';
  END IF;

  _per_member := ROUND(_amount::numeric / _member_count, 2);

  -- Loop through all active members for validation
  FOR _member IN 
    SELECT cm.user_id, cm.joined_at, COALESCE(s.total, 0) as total_savings, p.full_name
    FROM chama_members cm
    LEFT JOIN (
      SELECT user_id, SUM(amount) as total 
      FROM chama_savings WHERE group_id = _group_id GROUP BY user_id
    ) s ON s.user_id = cm.user_id
    LEFT JOIN profiles p ON p.user_id = cm.user_id
    WHERE cm.group_id = _group_id AND cm.is_active = true
  LOOP
    -- RULE: Zero savings check
    IF _member.total_savings <= 0 THEN
      IF _zero_members != '' THEN _zero_members := _zero_members || ', '; END IF;
      _zero_members := _zero_members || COALESCE(_member.full_name, 'Unknown');
      CONTINUE;
    END IF;

    -- RULE: Dynamic arrears calculation
    -- expected = periods_since_joined * contribution_amount
    IF _member.joined_at IS NOT NULL AND _contrib_amount > 0 THEN
      _expected := CASE _contrib_freq
        WHEN 'daily' THEN GREATEST(EXTRACT(DAY FROM (NOW() - _member.joined_at::timestamp)), 1) * _contrib_amount
        WHEN 'weekly' THEN GREATEST(FLOOR(EXTRACT(DAY FROM (NOW() - _member.joined_at::timestamp)) / 7), 1) * _contrib_amount
        ELSE GREATEST(EXTRACT(YEAR FROM AGE(NOW(), _member.joined_at::timestamp)) * 12 + EXTRACT(MONTH FROM AGE(NOW(), _member.joined_at::timestamp)), 1) * _contrib_amount
      END;
      _actual := _member.total_savings;
      _arrears := GREATEST(_expected - _actual, 0);
      
      IF _arrears > 0 THEN
        IF _arrears_members != '' THEN _arrears_members := _arrears_members || ', '; END IF;
        _arrears_members := _arrears_members || COALESCE(_member.full_name, 'Unknown') || ' (KES ' || ROUND(_arrears) || ' arrears)';
      END IF;
    END IF;

    -- RULE: Minimum savings check (partial withdrawal only)
    IF _amount < _group_savings THEN
      IF (_member.total_savings - _per_member) < 50 THEN
        IF _below_min_members != '' THEN _below_min_members := _below_min_members || ', '; END IF;
        _below_min_members := _below_min_members || COALESCE(_member.full_name, 'Unknown') || ' (KES ' || _member.total_savings || ')';
      END IF;
    END IF;
  END LOOP;

  -- Block if any member has zero savings
  IF _zero_members != '' THEN
    RAISE EXCEPTION 'Withdrawal rejected: member(s) with zero savings exist: %', _zero_members;
  END IF;

  -- Block if any member has arrears
  IF _arrears_members != '' THEN
    RAISE EXCEPTION 'Withdrawal unsuccessful. Members with arrears: %', _arrears_members;
  END IF;

  -- Block if partial withdrawal would break minimum KES 50 rule
  IF _below_min_members != '' AND _amount < _group_savings THEN
    RAISE EXCEPTION 'Withdrawal blocked: would bring members below minimum KES 50 savings: %', _below_min_members;
  END IF;

  -- All checks passed. Snapshot and deduct.
  FOR _member IN 
    SELECT cm.user_id, COALESCE(s.total, 0) as total_savings
    FROM chama_members cm
    LEFT JOIN (
      SELECT user_id, SUM(amount) as total 
      FROM chama_savings WHERE group_id = _group_id GROUP BY user_id
    ) s ON s.user_id = cm.user_id
    WHERE cm.group_id = _group_id AND cm.is_active = true
  LOOP
    IF _amount >= _group_savings THEN
      _deduct := _member.total_savings;
    ELSE
      _deduct := LEAST(_per_member, _member.total_savings);
    END IF;

    _snapshots := _snapshots || jsonb_build_array(jsonb_build_object(
      'user_id', _member.user_id,
      'deducted', _deduct,
      'original_savings', _member.total_savings
    ));

    -- Deduct
    IF _amount >= _group_savings THEN
      UPDATE chama_savings SET amount = 0 WHERE group_id = _group_id AND user_id = _member.user_id;
    ELSE
      UPDATE chama_savings SET amount = GREATEST(amount - _per_member, 0) WHERE group_id = _group_id AND user_id = _member.user_id;
    END IF;

    -- Notify member
    INSERT INTO notifications (user_id, title, message)
    VALUES (_member.user_id, 'Chama Withdrawal Requested',
      'KES ' || _deduct || ' has been deducted from your savings for a group withdrawal of KES ' || _amount || '. If rejected, your savings will be restored.');
  END LOOP;

  -- Create withdrawal with snapshots
  INSERT INTO chama_withdrawals (group_id, requested_by, amount, reason, status, member_snapshots)
  VALUES (_group_id, _requested_by, _amount, _reason, 'pending', _snapshots)
  RETURNING id INTO _wd_id;

  RETURN _wd_id;
END;
$$;

-- 6. Rewrite update_withdrawal_approvals: handles leader votes, instant status, snapshot reversal
CREATE OR REPLACE FUNCTION public.update_withdrawal_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_leaders int;
  v_approvals int;
  v_rejections int;
  v_group_id uuid;
  v_wd record;
  v_snapshot jsonb;
  v_snap_user_id uuid;
  v_snap_deducted numeric;
BEGIN
  -- Get withdrawal
  SELECT * INTO v_wd FROM chama_withdrawals WHERE id = NEW.withdrawal_id;
  IF v_wd IS NULL OR v_wd.status != 'pending' THEN
    RETURN NEW;
  END IF;

  v_group_id := v_wd.group_id;

  -- Count leaders
  SELECT COUNT(*) INTO v_total_leaders
  FROM chama_members
  WHERE group_id = v_group_id AND role IN ('chairperson','secretary','treasurer') AND is_active = true;

  -- Count votes
  SELECT
    COUNT(*) FILTER (WHERE approved = true),
    COUNT(*) FILTER (WHERE approved = false)
  INTO v_approvals, v_rejections
  FROM chama_withdrawal_approvals
  WHERE withdrawal_id = NEW.withdrawal_id;

  -- CASE 1: ANY rejection → immediate reversal using snapshots
  IF v_rejections >= 1 THEN
    -- Revert using snapshots
    IF v_wd.member_snapshots IS NOT NULL AND jsonb_array_length(v_wd.member_snapshots) > 0 THEN
      FOR v_snapshot IN SELECT * FROM jsonb_array_elements(v_wd.member_snapshots)
      LOOP
        v_snap_user_id := (v_snapshot->>'user_id')::uuid;
        v_snap_deducted := (v_snapshot->>'deducted')::numeric;
        
        UPDATE chama_savings 
        SET amount = amount + v_snap_deducted
        WHERE group_id = v_group_id AND user_id = v_snap_user_id;

        INSERT INTO notifications (user_id, title, message)
        VALUES (v_snap_user_id, 'Withdrawal Rejected',
          'KES ' || v_snap_deducted || ' has been restored to your chama savings.');
      END LOOP;
    END IF;

    UPDATE chama_withdrawals SET status = 'rejected' WHERE id = NEW.withdrawal_id;
    RETURN NEW;
  END IF;

  -- CASE 2: Check approval threshold
  IF (v_total_leaders = 1 AND v_approvals >= 1)
     OR (v_total_leaders = 2 AND v_approvals >= 2)
     OR (v_total_leaders >= 3 AND v_approvals >= 2) THEN
    UPDATE chama_withdrawals SET status = 'approved_by_leaders' WHERE id = NEW.withdrawal_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trg_approval
  AFTER INSERT OR UPDATE ON public.chama_withdrawal_approvals
  FOR EACH ROW EXECUTE FUNCTION update_withdrawal_approvals();

-- 7. Rewrite handle_chama_withdrawal_decision for admin approve/reject
CREATE OR REPLACE FUNCTION public.handle_chama_withdrawal_decision(
  _withdrawal_id uuid, _admin_id uuid, _decision text, _admin_reason text DEFAULT NULL
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
  SELECT * INTO _wd FROM chama_withdrawals 
  WHERE id = _withdrawal_id AND status IN ('pending', 'approved_by_leaders');
  
  IF _wd IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found or already processed';
  END IF;

  IF _decision = 'approved' THEN
    UPDATE chama_withdrawals 
    SET status = 'approved', admin_reason = _admin_reason 
    WHERE id = _withdrawal_id;

    INSERT INTO notifications (user_id, title, message)
    VALUES (_wd.requested_by, 'Chama Withdrawal Approved',
      'Your group withdrawal of KES ' || _wd.amount || ' has been approved.');

  ELSIF _decision = 'rejected' THEN
    -- Restore using snapshots
    IF _wd.member_snapshots IS NOT NULL AND jsonb_array_length(_wd.member_snapshots) > 0 THEN
      FOR _snapshot IN SELECT * FROM jsonb_array_elements(_wd.member_snapshots)
      LOOP
        _snap_user_id := (_snapshot->>'user_id')::uuid;
        _snap_deducted := (_snapshot->>'deducted')::numeric;
        
        UPDATE chama_savings 
        SET amount = amount + _snap_deducted
        WHERE group_id = _wd.group_id AND user_id = _snap_user_id;

        INSERT INTO notifications (user_id, title, message)
        VALUES (_snap_user_id, 'Withdrawal Rejected by Admin',
          'KES ' || _snap_deducted || ' has been restored to your chama savings.' ||
          CASE WHEN _admin_reason IS NOT NULL THEN ' Reason: ' || _admin_reason ELSE '' END);
      END LOOP;
    END IF;

    UPDATE chama_withdrawals 
    SET status = 'rejected', admin_reason = _admin_reason 
    WHERE id = _withdrawal_id;
  ELSE
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected';
  END IF;

  -- Audit log
  INSERT INTO audit_logs (admin_id, user_id, action, details)
  VALUES (_admin_id, _wd.requested_by, 'chama_withdrawal_' || _decision,
    jsonb_build_object('withdrawal_id', _withdrawal_id, 'amount', _wd.amount, 'reason', _admin_reason));
END;
$$;

-- 8. Fix emergency fund deduction to properly create contribution records
CREATE OR REPLACE FUNCTION public.run_monthly_emergency_deduction()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  _current_month text := to_char(NOW(), 'YYYY-MM');
  _group record;
  _member record;
BEGIN
  -- Loop through groups with emergency fund enabled
  FOR _group IN 
    SELECT id FROM chama_groups WHERE emergency_fund_enabled = true
  LOOP
    -- Loop through active members
    FOR _member IN
      SELECT cm.user_id, COALESCE(SUM(cs.amount), 0) as total_savings
      FROM chama_members cm
      LEFT JOIN chama_savings cs ON cs.user_id = cm.user_id AND cs.group_id = cm.group_id
      WHERE cm.group_id = _group.id AND cm.is_active = true
      AND NOT EXISTS (
        SELECT 1 FROM chama_emergency_contributions ec
        WHERE ec.user_id = cm.user_id AND ec.group_id = cm.group_id 
        AND ec.month = _current_month AND ec.status = 'paid'
      )
      GROUP BY cm.user_id
      HAVING COALESCE(SUM(cs.amount), 0) >= 50
    LOOP
      -- Deduct 50 from savings
      UPDATE chama_savings 
      SET amount = amount - 50
      WHERE group_id = _group.id AND user_id = _member.user_id
      AND amount >= 50
      AND id = (
        SELECT id FROM chama_savings 
        WHERE group_id = _group.id AND user_id = _member.user_id AND amount >= 50
        ORDER BY amount DESC LIMIT 1
      );

      -- Record contribution
      INSERT INTO chama_emergency_contributions (user_id, group_id, amount, month, status)
      VALUES (_member.user_id, _group.id, 50, _current_month, 'paid');

      -- Update emergency fund balance
      INSERT INTO chama_emergency_fund (group_id, balance)
      VALUES (_group.id, 50)
      ON CONFLICT (group_id) DO UPDATE SET balance = chama_emergency_fund.balance + 50;

      -- Notify
      INSERT INTO notifications (user_id, title, message)
      VALUES (_member.user_id, 'Emergency Fund', 
        'KES 50 has been auto-deducted from your chama savings for the monthly emergency fund contribution.');
    END LOOP;
  END LOOP;
END;
$$;
