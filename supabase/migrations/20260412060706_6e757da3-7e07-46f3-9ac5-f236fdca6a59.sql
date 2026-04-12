
-- Allow updates on chama_savings for service-level operations (withdrawal deductions, emergency fund)
CREATE POLICY "Service and leaders can update savings"
ON public.chama_savings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Recreate the withdrawal function with arrears check
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
  _arrears_members text := '';
BEGIN
  -- Calculate group total savings
  SELECT COALESCE(SUM(amount), 0) INTO _group_savings FROM chama_savings WHERE group_id = _group_id;
  
  IF _amount > _group_savings THEN
    RAISE EXCEPTION 'Withdrawal amount (KES %) exceeds group savings (KES %)', _amount, _group_savings;
  END IF;

  -- Get all active members with their total savings
  SELECT COUNT(*) INTO _member_count FROM chama_members WHERE group_id = _group_id AND is_active = true;
  IF _member_count = 0 THEN
    RAISE EXCEPTION 'No active members in group';
  END IF;

  _per_member := ROUND(_amount::numeric / _member_count, 2);

  -- Check for arrears: if partial withdrawal, each member needs at least _per_member in savings
  IF _amount < _group_savings THEN
    FOR _member IN 
      SELECT cm.user_id, COALESCE(s.total, 0) as total_savings, p.full_name
      FROM chama_members cm
      LEFT JOIN (SELECT user_id, SUM(amount) as total FROM chama_savings WHERE group_id = _group_id GROUP BY user_id) s ON s.user_id = cm.user_id
      LEFT JOIN profiles p ON p.user_id = cm.user_id
      WHERE cm.group_id = _group_id AND cm.is_active = true
    LOOP
      IF _member.total_savings < _per_member THEN
        IF _arrears_members != '' THEN _arrears_members := _arrears_members || ', '; END IF;
        _arrears_members := _arrears_members || COALESCE(_member.full_name, 'Unknown') || ' (KES ' || _member.total_savings || ')';
      END IF;
    END LOOP;

    IF _arrears_members != '' THEN
      -- Notify the requester about arrears
      INSERT INTO notifications (user_id, title, message)
      VALUES (_requested_by, 'Withdrawal Unsuccessful', 
        'Withdrawal of KES ' || _amount || ' cannot proceed. Each member needs at least KES ' || _per_member || ' in savings. Members with insufficient savings: ' || _arrears_members);
      RAISE EXCEPTION 'Withdrawal unsuccessful. Members with arrears: %', _arrears_members;
    END IF;
  END IF;

  -- Snapshot each member's current savings and deduct
  FOR _member IN 
    SELECT cm.user_id, COALESCE(s.total, 0) as total_savings
    FROM chama_members cm
    LEFT JOIN (SELECT user_id, SUM(amount) as total FROM chama_savings WHERE group_id = _group_id GROUP BY user_id) s ON s.user_id = cm.user_id
    WHERE cm.group_id = _group_id AND cm.is_active = true
  LOOP
    DECLARE
      _deduct numeric;
    BEGIN
      IF _amount >= _group_savings THEN
        -- Full withdrawal: take everything
        _deduct := _member.total_savings;
      ELSE
        _deduct := LEAST(_per_member, _member.total_savings);
      END IF;

      _snapshots := _snapshots || jsonb_build_array(jsonb_build_object(
        'user_id', _member.user_id,
        'deducted', _deduct,
        'original_savings', _member.total_savings
      ));

      -- Deduct from savings records
      IF _amount >= _group_savings THEN
        -- Full withdrawal: set all to 0
        UPDATE chama_savings SET amount = 0 WHERE group_id = _group_id AND user_id = _member.user_id;
      ELSE
        -- Partial: deduct proportionally
        UPDATE chama_savings SET amount = GREATEST(amount - _per_member, 0) WHERE group_id = _group_id AND user_id = _member.user_id;
      END IF;

      -- Notify member
      INSERT INTO notifications (user_id, title, message)
      VALUES (_member.user_id, 'Chama Withdrawal Requested',
        'KES ' || _deduct || ' has been deducted from your chama savings for a group withdrawal of KES ' || _amount || '. If rejected, your savings will be restored.');
    END;
  END LOOP;

  -- Create withdrawal record with snapshots
  INSERT INTO chama_withdrawals (group_id, requested_by, amount, reason, status, member_snapshots)
  VALUES (_group_id, _requested_by, _amount, _reason, 'pending', _snapshots)
  RETURNING id INTO _wd_id;

  RETURN _wd_id;
END;
$$;

-- Update rejection handler to use original_savings for exact restoration
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
    UPDATE chama_withdrawals SET status = 'approved', admin_reason = _admin_reason WHERE id = _withdrawal_id;

    INSERT INTO notifications (user_id, title, message)
    VALUES (_wd.requested_by, 'Chama Withdrawal Approved',
      'Your group withdrawal of KES ' || _wd.amount || ' has been approved.');

  ELSIF _decision = 'rejected' THEN
    -- Credit back each member using stored snapshots
    IF _wd.member_snapshots IS NOT NULL AND jsonb_array_length(_wd.member_snapshots) > 0 THEN
      FOR _snapshot IN SELECT * FROM jsonb_array_elements(_wd.member_snapshots)
      LOOP
        _snap_user_id := (_snapshot->>'user_id')::uuid;
        _snap_deducted := (_snapshot->>'deducted')::numeric;
        
        -- Credit back exactly what was deducted
        UPDATE chama_savings 
        SET amount = amount + _snap_deducted
        WHERE group_id = _wd.group_id AND user_id = _snap_user_id;

        INSERT INTO notifications (user_id, title, message)
        VALUES (_snap_user_id, 'Chama Withdrawal Rejected',
          'KES ' || _snap_deducted || ' has been restored to your chama savings.' ||
          CASE WHEN _admin_reason IS NOT NULL THEN ' Reason: ' || _admin_reason ELSE '' END);
      END LOOP;
    END IF;

    UPDATE chama_withdrawals SET status = 'rejected', admin_reason = _admin_reason WHERE id = _withdrawal_id;
  ELSE
    RAISE EXCEPTION 'Invalid decision. Must be approved or rejected';
  END IF;

  INSERT INTO audit_logs (admin_id, user_id, action, details)
  VALUES (_admin_id, _wd.requested_by, 'chama_withdrawal_' || _decision,
    jsonb_build_object('withdrawal_id', _withdrawal_id, 'amount', _wd.amount, 'group_id', _wd.group_id));
END;
$$;

-- Auto-trigger emergency fund deduction on new savings deposit
CREATE OR REPLACE FUNCTION public.auto_emergency_deduction_on_deposit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _current_month text := to_char(NOW(), 'YYYY-MM');
  _group_emergency_enabled boolean;
  _already_paid boolean;
BEGIN
  -- Check if emergency fund is enabled for this group
  SELECT emergency_fund_enabled INTO _group_emergency_enabled 
  FROM chama_groups WHERE id = NEW.group_id;
  
  IF NOT COALESCE(_group_emergency_enabled, false) THEN
    RETURN NEW;
  END IF;

  -- Check if user already paid emergency this month for this group
  SELECT EXISTS(
    SELECT 1 FROM chama_emergency_contributions 
    WHERE user_id = NEW.user_id AND group_id = NEW.group_id AND month = _current_month AND status = 'paid'
  ) INTO _already_paid;

  IF _already_paid THEN
    RETURN NEW;
  END IF;

  -- Check if user has enough savings (at least 50)
  IF NEW.amount < 50 THEN
    RETURN NEW;
  END IF;

  -- Deduct 50 from the just-deposited savings
  UPDATE chama_savings SET amount = amount - 50 WHERE id = NEW.id;

  -- Record the contribution
  INSERT INTO chama_emergency_contributions (user_id, group_id, amount, month, status)
  VALUES (NEW.user_id, NEW.group_id, 50, _current_month, 'paid');

  -- Update emergency fund balance
  INSERT INTO chama_emergency_fund (group_id, balance)
  VALUES (NEW.group_id, 50)
  ON CONFLICT (group_id) DO UPDATE SET balance = chama_emergency_fund.balance + 50;

  -- Notify the user
  INSERT INTO notifications (user_id, title, message)
  VALUES (NEW.user_id, 'Emergency Fund', 
    'KES 50 has been auto-deducted from your chama savings for the monthly emergency fund contribution.');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_emergency_deduction_on_deposit
  AFTER INSERT ON public.chama_savings
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_emergency_deduction_on_deposit();
