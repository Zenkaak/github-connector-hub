
-- 1. Drop duplicate harambee triggers
DROP TRIGGER IF EXISTS on_new_harambee_contribution ON public.chama_harambee_contributions;
DROP TRIGGER IF EXISTS trg_update_harambee_raised_amount ON public.chama_harambee_contributions;
DROP TRIGGER IF EXISTS trigger_update_harambee_total ON public.chama_harambee_contributions;
DROP TRIGGER IF EXISTS update_harambee_on_payment ON public.chama_harambee_contributions;

-- One canonical trigger that recomputes the total
DROP TRIGGER IF EXISTS trg_sync_harambee_raised ON public.chama_harambee_contributions;
CREATE TRIGGER trg_sync_harambee_raised
AFTER INSERT OR UPDATE OR DELETE ON public.chama_harambee_contributions
FOR EACH ROW EXECUTE FUNCTION public.sync_harambee_total();

-- Re-sync ALL harambee totals to fix historical inflation
UPDATE public.chama_harambees h
SET raised_amount = COALESCE((
  SELECT SUM(amount) FROM public.chama_harambee_contributions WHERE harambee_id = h.id
), 0);

-- 2. Fix update_withdrawal_approvals: restore to ONE row, not all rows
CREATE OR REPLACE FUNCTION public.update_withdrawal_approvals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_leaders int;
  v_approvals int;
  v_rejections int;
  v_group_id uuid;
  v_wd record;
  v_snapshot jsonb;
  v_snap_user_id uuid;
  v_snap_deducted numeric;
  v_target_id uuid;
BEGIN
  SELECT * INTO v_wd FROM chama_withdrawals WHERE id = NEW.withdrawal_id;
  IF v_wd IS NULL OR v_wd.status != 'pending' THEN
    RETURN NEW;
  END IF;

  v_group_id := v_wd.group_id;

  SELECT COUNT(*) INTO v_total_leaders
  FROM chama_members
  WHERE group_id = v_group_id AND role IN ('chairperson','secretary','treasurer') AND is_active = true;

  SELECT
    COUNT(*) FILTER (WHERE approved = true),
    COUNT(*) FILTER (WHERE approved = false)
  INTO v_approvals, v_rejections
  FROM chama_withdrawal_approvals
  WHERE withdrawal_id = NEW.withdrawal_id;

  IF v_rejections >= 1 THEN
    IF v_wd.member_snapshots IS NOT NULL AND jsonb_array_length(v_wd.member_snapshots) > 0 THEN
      FOR v_snapshot IN SELECT * FROM jsonb_array_elements(v_wd.member_snapshots)
      LOOP
        v_snap_user_id := (v_snapshot->>'user_id')::uuid;
        v_snap_deducted := (v_snapshot->>'deducted')::numeric;

        SELECT id INTO v_target_id
        FROM chama_savings
        WHERE group_id = v_group_id AND user_id = v_snap_user_id
        ORDER BY created_at DESC
        LIMIT 1;

        IF v_target_id IS NOT NULL THEN
          UPDATE chama_savings SET amount = amount + v_snap_deducted WHERE id = v_target_id;
        ELSE
          INSERT INTO chama_savings (group_id, user_id, amount, month)
          VALUES (v_group_id, v_snap_user_id, v_snap_deducted, to_char(now(), 'YYYY-MM'));
        END IF;

        INSERT INTO notifications (user_id, title, message)
        VALUES (v_snap_user_id, 'Withdrawal Rejected',
          'KES ' || v_snap_deducted || ' has been restored to your chama savings.');
      END LOOP;
    END IF;

    UPDATE chama_withdrawals SET status = 'rejected' WHERE id = NEW.withdrawal_id;
    RETURN NEW;
  END IF;

  IF (v_total_leaders = 1 AND v_approvals >= 1)
     OR (v_total_leaders = 2 AND v_approvals >= 2)
     OR (v_total_leaders >= 3 AND v_approvals >= 2) THEN
    UPDATE chama_withdrawals SET status = 'approved_by_leaders' WHERE id = NEW.withdrawal_id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_chama_withdrawal_decision(_withdrawal_id uuid, _admin_id uuid, _decision text, _admin_reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _wd record;
  _snapshot jsonb;
  _snap_user_id uuid;
  _snap_deducted numeric;
  _target_id uuid;
BEGIN
  SELECT * INTO _wd FROM chama_withdrawals
  WHERE id = _withdrawal_id AND status IN ('pending', 'approved_by_leaders');

  IF _wd IS NULL THEN
    RAISE EXCEPTION 'Withdrawal not found or already processed';
  END IF;

  IF _decision = 'approved' THEN
    UPDATE chama_withdrawals SET status = 'approved', admin_reason = _admin_reason WHERE id = _withdrawal_id;
    INSERT INTO notifications (user_id, title, message)
    VALUES (_wd.requested_by, 'Chama Withdrawal Approved',
      'Your group withdrawal of KES ' || _wd.amount || ' has been approved.');
  ELSIF _decision = 'rejected' THEN
    IF _wd.member_snapshots IS NOT NULL AND jsonb_array_length(_wd.member_snapshots) > 0 THEN
      FOR _snapshot IN SELECT * FROM jsonb_array_elements(_wd.member_snapshots)
      LOOP
        _snap_user_id := (_snapshot->>'user_id')::uuid;
        _snap_deducted := (_snapshot->>'deducted')::numeric;

        SELECT id INTO _target_id FROM chama_savings
        WHERE group_id = _wd.group_id AND user_id = _snap_user_id
        ORDER BY created_at DESC LIMIT 1;

        IF _target_id IS NOT NULL THEN
          UPDATE chama_savings SET amount = amount + _snap_deducted WHERE id = _target_id;
        ELSE
          INSERT INTO chama_savings (group_id, user_id, amount, month)
          VALUES (_wd.group_id, _snap_user_id, _snap_deducted, to_char(now(), 'YYYY-MM'));
        END IF;

        INSERT INTO notifications (user_id, title, message)
        VALUES (_snap_user_id, 'Withdrawal Rejected by Admin',
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
    jsonb_build_object('withdrawal_id', _withdrawal_id, 'amount', _wd.amount, 'reason', _admin_reason));
END;
$function$;

-- 3. De-dup existing stk_transactions with duplicate receipts BEFORE creating unique index
WITH ranked AS (
  SELECT id, mpesa_receipt,
    ROW_NUMBER() OVER (PARTITION BY mpesa_receipt ORDER BY created_at ASC) AS rn
  FROM public.stk_transactions
  WHERE mpesa_receipt IS NOT NULL AND mpesa_receipt <> ''
)
DELETE FROM public.stk_transactions
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stk_transactions_mpesa_receipt_unique
  ON public.stk_transactions(mpesa_receipt)
  WHERE mpesa_receipt IS NOT NULL AND mpesa_receipt <> '';

-- 4. Also: dedup mpesa_c2b_transactions on trans_id (it should already be unique but safety)
CREATE UNIQUE INDEX IF NOT EXISTS idx_mpesa_c2b_trans_id_unique
  ON public.mpesa_c2b_transactions(trans_id);
