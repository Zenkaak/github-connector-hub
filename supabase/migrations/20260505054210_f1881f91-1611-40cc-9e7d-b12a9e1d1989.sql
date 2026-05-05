
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny all users" ON public.users;
CREATE POLICY "deny all users" ON public.users FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny all transactions" ON public.transactions;
CREATE POLICY "deny all transactions" ON public.transactions FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "deny all chama_notifications" ON public.chama_notifications;
CREATE POLICY "deny all chama_notifications" ON public.chama_notifications FOR ALL USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

DROP POLICY IF EXISTS "Allow public select" ON public.stk_transactions;
DROP POLICY IF EXISTS "Allow public to view transaction status" ON public.stk_transactions;
DROP POLICY IF EXISTS "Anon can select stk by reference" ON public.stk_transactions;
DROP POLICY IF EXISTS "Anonymous can insert" ON public.stk_transactions;
DROP POLICY IF EXISTS "Public Select Access" ON public.stk_transactions;
DROP POLICY IF EXISTS "Public Select All" ON public.stk_transactions;
DROP POLICY IF EXISTS "Public can check transaction status" ON public.stk_transactions;
DROP POLICY IF EXISTS "Public can insert new transactions" ON public.stk_transactions;
DROP POLICY IF EXISTS "Public transactions are viewable by everyone" ON public.stk_transactions;
DROP POLICY IF EXISTS "public_select_stk" ON public.stk_transactions;
DROP POLICY IF EXISTS "Anon can insert stk" ON public.stk_transactions;

DROP POLICY IF EXISTS "Anyone can view harambees" ON public.chama_harambees;
DROP POLICY IF EXISTS "Allow admins to update harambees" ON public.chama_harambees;
DROP POLICY IF EXISTS "Leaders can update harambees" ON public.chama_harambees;
DROP POLICY IF EXISTS "Strict payout update" ON public.chama_harambees;
DROP POLICY IF EXISTS "Initiators update payout only" ON public.chama_harambees;
DROP POLICY IF EXISTS "Leaders can create harambees" ON public.chama_harambees;

CREATE POLICY "Leaders create harambees scoped" ON public.chama_harambees
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid() AND (
      group_id IS NULL OR public.is_chama_leader(group_id, auth.uid())
    )
  );
CREATE POLICY "Authorized update harambees" ON public.chama_harambees
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR created_by = auth.uid()
    OR (group_id IS NOT NULL AND public.is_chama_leader(group_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Enable insert for anonymous users" ON public.chama_harambee_contributions;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.chama_harambee_contributions;
DROP POLICY IF EXISTS "Allow service role insert" ON public.chama_harambee_contributions;
DROP POLICY IF EXISTS "Anyone can view hc" ON public.chama_harambee_contributions;
DROP POLICY IF EXISTS "Enable select for all users" ON public.chama_harambee_contributions;
DROP POLICY IF EXISTS "Allow public view of contributions" ON public.chama_harambee_contributions;
DROP POLICY IF EXISTS "Allow public view access" ON public.chama_harambee_contributions;

DROP POLICY IF EXISTS "Auth users can create groups" ON public.chama_groups;
CREATE POLICY "Users create own groups" ON public.chama_groups
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Auth users can insert members" ON public.chama_members;
CREATE POLICY "Self join as member" ON public.chama_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND (
    role = 'member'
    OR EXISTS (SELECT 1 FROM public.chama_groups g WHERE g.id = group_id AND g.created_by = auth.uid())
  ));
CREATE POLICY "Leaders add members" ON public.chama_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_chama_leader(group_id, auth.uid()) AND role = 'member');

DROP POLICY IF EXISTS "Leaders can manage attendance" ON public.chama_meeting_attendance;
DROP POLICY IF EXISTS "Anyone can view attendance" ON public.chama_meeting_attendance;
CREATE POLICY "Leaders manage attendance" ON public.chama_meeting_attendance
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chama_meetings m WHERE m.id = meeting_id AND public.is_chama_leader(m.group_id, auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.chama_meetings m WHERE m.id = meeting_id AND public.is_chama_leader(m.group_id, auth.uid())));
CREATE POLICY "Members view attendance" ON public.chama_meeting_attendance
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chama_meetings m WHERE m.id = meeting_id AND public.is_chama_member(m.group_id, auth.uid())));

DROP POLICY IF EXISTS "Anyone can insert rmr" ON public.chama_member_removal_requests;
DROP POLICY IF EXISTS "Anyone can view rmr" ON public.chama_member_removal_requests;
CREATE POLICY "Leaders insert rmr" ON public.chama_member_removal_requests
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.is_chama_leader(group_id, auth.uid()));
CREATE POLICY "Members view rmr" ON public.chama_member_removal_requests
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Leaders can insert penalties" ON public.chama_penalties;
CREATE POLICY "Leaders insert penalties" ON public.chama_penalties
  FOR INSERT TO authenticated
  WITH CHECK (public.is_chama_leader(group_id, auth.uid()));

DROP POLICY IF EXISTS "Leaders can create votes" ON public.chama_votes;
CREATE POLICY "Leaders create votes" ON public.chama_votes
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND public.is_chama_leader(group_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can view vote responses" ON public.chama_vote_responses;
CREATE POLICY "Members view vote responses" ON public.chama_vote_responses
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chama_votes v WHERE v.id = vote_id AND public.is_chama_member(v.group_id, auth.uid())));

DROP POLICY IF EXISTS "Service and leaders can update savings" ON public.chama_savings;
CREATE POLICY "Admins update savings" ON public.chama_savings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Leaders can create cwd" ON public.chama_withdrawals;
DROP POLICY IF EXISTS "Leaders can update cwd" ON public.chama_withdrawals;
CREATE POLICY "Members create cwd" ON public.chama_withdrawals
  FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid() AND public.is_chama_member(group_id, auth.uid()));
CREATE POLICY "Leaders update cwd" ON public.chama_withdrawals
  FOR UPDATE TO authenticated
  USING (public.is_chama_leader(group_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Members can insert csm" ON public.chama_support_messages;
CREATE POLICY "Members insert csm" ON public.chama_support_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Anyone can view cwa" ON public.chama_withdrawal_approvals;
CREATE POLICY "Members view cwa" ON public.chama_withdrawal_approvals
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.chama_withdrawals w
    WHERE w.id = withdrawal_id AND public.is_chama_member(w.group_id, auth.uid())
  ) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own wallet" ON public.wallets;

DROP POLICY IF EXISTS "Any auth can insert audit" ON public.audit_logs;
CREATE POLICY "Admins insert audit" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND admin_id = auth.uid());

DROP POLICY IF EXISTS "Anyone upload chama files" ON storage.objects;
CREATE POLICY "Members upload chama files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chama-files'
    AND public.is_chama_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE OR REPLACE VIEW public.member_arrears_summary
WITH (security_invoker = on) AS
  SELECT user_id, sum(amount) AS total_arrears, count(*) AS missed_payments_count
  FROM public.chama_penalties WHERE is_paid = false GROUP BY user_id;

CREATE OR REPLACE VIEW public.harambee_contributors
WITH (security_invoker = on) AS
  SELECT harambee_id, contributor_name, phone, amount, reference, status, paid_at
  FROM public.stk_transactions
  WHERE purpose = 'harambee'
  ORDER BY paid_at DESC;

CREATE OR REPLACE VIEW public.chama_member_arrears
WITH (security_invoker = on) AS
  SELECT cm.user_id, cm.group_id, cm.joined_at,
    GREATEST(date_part('day', now() - cm.joined_at), 0) * 50 AS expected_savings,
    COALESCE(sum(s.amount), 0) AS actual_savings,
    GREATEST(date_part('day', now() - cm.joined_at) * 50 - COALESCE(sum(s.amount), 0)::double precision, 0) AS arrears
  FROM public.chama_members cm
  LEFT JOIN public.chama_savings s ON s.user_id = cm.user_id AND s.group_id = cm.group_id
  GROUP BY cm.user_id, cm.group_id, cm.joined_at;

CREATE OR REPLACE VIEW public.harambee_totals
WITH (security_invoker = on) AS
  SELECT harambee_id, count(*) AS total_contributions, COALESCE(sum(amount), 0) AS total_amount
  FROM public.stk_transactions
  WHERE purpose = 'harambee' AND status = 'success'
  GROUP BY harambee_id;

ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
