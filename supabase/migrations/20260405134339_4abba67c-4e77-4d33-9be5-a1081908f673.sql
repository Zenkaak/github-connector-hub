CREATE OR REPLACE FUNCTION public.is_chama_member(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chama_members
    WHERE group_id = _group_id AND user_id = _user_id AND is_active = true
  )
$$;

CREATE OR REPLACE FUNCTION public.is_chama_leader(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chama_members
    WHERE group_id = _group_id AND user_id = _user_id AND is_active = true
    AND role IN ('chairperson', 'treasurer', 'secretary')
  )
$$;

DROP POLICY IF EXISTS "Members can view group members" ON public.chama_members;
CREATE POLICY "Members can view group members" ON public.chama_members
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view their groups" ON public.chama_groups;
CREATE POLICY "Members can view their groups" ON public.chama_groups
  FOR SELECT TO authenticated
  USING (public.is_chama_member(id, auth.uid()));

DROP POLICY IF EXISTS "Members can view announcements" ON public.chama_announcements;
CREATE POLICY "Members can view announcements" ON public.chama_announcements
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Leaders can insert announcements" ON public.chama_announcements;
CREATE POLICY "Leaders can insert announcements" ON public.chama_announcements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_chama_leader(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view group savings" ON public.chama_savings;
CREATE POLICY "Members can view group savings" ON public.chama_savings
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view group msgs" ON public.chama_messages;
CREATE POLICY "Members can view group msgs" ON public.chama_messages
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view meetings" ON public.chama_meetings;
CREATE POLICY "Members can view meetings" ON public.chama_meetings
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view penalties" ON public.chama_penalties;
CREATE POLICY "Members can view penalties" ON public.chama_penalties
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view harambees" ON public.chama_harambees;
CREATE POLICY "Members can view harambees" ON public.chama_harambees
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view cwd" ON public.chama_withdrawals;
CREATE POLICY "Members can view cwd" ON public.chama_withdrawals
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view votes" ON public.chama_votes;
CREATE POLICY "Members can view votes" ON public.chama_votes
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view sigs" ON public.chama_term_signatures;
CREATE POLICY "Members can view sigs" ON public.chama_term_signatures
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view jr" ON public.chama_join_requests;
CREATE POLICY "Members can view jr" ON public.chama_join_requests
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view joining fees" ON public.chama_joining_fees;
CREATE POLICY "Members can view joining fees" ON public.chama_joining_fees
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view platform fees" ON public.chama_platform_fees;
CREATE POLICY "Members can view platform fees" ON public.chama_platform_fees
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view lr" ON public.chama_leave_requests;
CREATE POLICY "Members can view lr" ON public.chama_leave_requests
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view csm" ON public.chama_support_messages;
CREATE POLICY "Members can view csm" ON public.chama_support_messages
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Members can view group loans" ON public.chama_loans;
CREATE POLICY "Members can view group loans" ON public.chama_loans
  FOR SELECT TO authenticated
  USING (public.is_chama_member(group_id, auth.uid()));

DROP POLICY IF EXISTS "Leaders can update jr" ON public.chama_join_requests;
CREATE POLICY "Leaders can update jr" ON public.chama_join_requests
  FOR UPDATE TO authenticated
  USING (public.is_chama_leader(group_id, auth.uid()));

DROP POLICY IF EXISTS "Leaders can update lr" ON public.chama_leave_requests;
CREATE POLICY "Leaders can update lr" ON public.chama_leave_requests
  FOR UPDATE TO authenticated
  USING (public.is_chama_leader(group_id, auth.uid()));

DROP POLICY IF EXISTS "Leaders can manage meetings" ON public.chama_meetings;
CREATE POLICY "Leaders can manage meetings" ON public.chama_meetings
  FOR ALL TO authenticated
  USING (public.is_chama_leader(group_id, auth.uid()));

DROP POLICY IF EXISTS "Leaders can update members" ON public.chama_members;
CREATE POLICY "Leaders can update members" ON public.chama_members
  FOR UPDATE TO authenticated
  USING (public.is_chama_leader(group_id, auth.uid()));

DROP POLICY IF EXISTS "Group leaders can update" ON public.chama_groups;
CREATE POLICY "Group leaders can update" ON public.chama_groups
  FOR UPDATE TO authenticated
  USING (public.is_chama_leader(id, auth.uid()));

DROP POLICY IF EXISTS "Leaders can update loans" ON public.chama_loans;
CREATE POLICY "Leaders can update loans" ON public.chama_loans
  FOR UPDATE TO authenticated
  USING (public.is_chama_leader(group_id, auth.uid()));

DROP POLICY IF EXISTS "Leaders can update votes" ON public.chama_votes;
CREATE POLICY "Leaders can update votes" ON public.chama_votes
  FOR UPDATE TO authenticated
  USING (public.is_chama_leader(group_id, auth.uid()));