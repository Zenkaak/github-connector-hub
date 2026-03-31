
-- ============================================================
-- STEP 1: CREATE ALL TABLES (no RLS policies yet)
-- ============================================================

-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  county text NOT NULL DEFAULT '',
  sub_county text NOT NULL DEFAULT '',
  ward text NOT NULL DEFAULT '',
  address text NOT NULL DEFAULT '',
  id_number text NOT NULL DEFAULT '',
  date_of_birth text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  is_verified boolean NOT NULL DEFAULT false,
  disable_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit', 'withdrawal')),
  amount numeric NOT NULL,
  description text,
  reference_id text,
  status text DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.wallet_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  reason text,
  sender_name text,
  receiver_name text,
  status text NOT NULL DEFAULT 'completed',
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.money_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requested_from_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  reason text,
  requester_name text,
  requested_from_name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  type text DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.stk_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  phone text NOT NULL,
  amount numeric NOT NULL,
  reference text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  mpesa_receipt text,
  merchant_request_id text,
  checkout_request_id text,
  result_code text,
  result_desc text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_type text NOT NULL DEFAULT 'user',
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  subject text,
  message text NOT NULL,
  type text DEFAULT 'message',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid,
  user_id uuid,
  loan_id uuid,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general',
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.loan_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  loan_type text NOT NULL,
  applied_amount numeric NOT NULL,
  generated_limit numeric NOT NULL DEFAULT 0,
  employment_status text NOT NULL DEFAULT '',
  monthly_income numeric NOT NULL DEFAULT 0,
  monthly_expenses numeric NOT NULL DEFAULT 0,
  next_of_kin_name text NOT NULL DEFAULT '',
  next_of_kin_phone text NOT NULL DEFAULT '',
  number_of_dependents integer,
  existing_loans boolean,
  existing_loan_amount numeric,
  business_sector text,
  education_level text,
  status text NOT NULL DEFAULT 'pending',
  admin_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.loan_disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid REFERENCES public.loan_applications(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  disbursed_amount numeric NOT NULL,
  outstanding_balance numeric NOT NULL,
  monthly_repayment numeric NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  repayment_due_date timestamptz,
  status text NOT NULL DEFAULT 'active',
  disbursed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.personal_savings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'target',
  target_amount numeric NOT NULL DEFAULT 0,
  saved_amount numeric NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  start_date text NOT NULL DEFAULT '',
  maturity_date text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.personal_savings_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  savings_id uuid REFERENCES public.personal_savings(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  stk_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.savings_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  savings_id uuid REFERENCES public.personal_savings(id) ON DELETE CASCADE NOT NULL,
  reason text NOT NULL DEFAULT '',
  penalty_percentage numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  admin_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CHAMA TABLES
CREATE TABLE public.chama_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  terms text,
  terms_updated_at timestamptz,
  contribution_amount numeric NOT NULL DEFAULT 0,
  contribution_frequency text NOT NULL DEFAULT 'monthly',
  meeting_day text,
  meeting_absence_penalty numeric DEFAULT 0,
  late_contribution_penalty numeric DEFAULT 0,
  max_members integer DEFAULT 50,
  is_public boolean NOT NULL DEFAULT false,
  profile_image_url text,
  order_number text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE public.chama_savings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  month text,
  stk_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_joining_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_platform_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_name text NOT NULL DEFAULT '',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT '',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  options jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'open',
  updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_vote_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vote_id uuid REFERENCES public.chama_votes(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  selected_option text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vote_id, user_id)
);

CREATE TABLE public.chama_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  meeting_date timestamptz NOT NULL,
  venue text,
  agenda text,
  minutes text,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_meeting_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES public.chama_meetings(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'present',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, user_id)
);

CREATE TABLE public.chama_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  interest_rate numeric NOT NULL DEFAULT 0,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  approved_by uuid,
  repaid_amount numeric NOT NULL DEFAULT 0,
  due_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_penalties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  reason text,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_withdrawal_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id uuid REFERENCES public.chama_withdrawals(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  approved boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (withdrawal_id, user_id)
);

CREATE TABLE public.chama_harambees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  target_amount numeric NOT NULL DEFAULT 0,
  raised_amount numeric NOT NULL DEFAULT 0,
  deadline timestamptz,
  status text NOT NULL DEFAULT 'active',
  beneficiary_name text,
  beneficiary_phone text,
  image_urls jsonb DEFAULT '[]',
  is_public boolean NOT NULL DEFAULT false,
  order_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_harambee_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  harambee_id uuid REFERENCES public.chama_harambees(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL,
  contributor_name text,
  stk_reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE public.chama_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_term_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  terms_version timestamptz,
  UNIQUE (group_id, user_id)
);

CREATE TABLE public.chama_support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_type text NOT NULL DEFAULT 'member',
  message text NOT NULL,
  file_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transaction_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  transaction_id uuid,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.chama_member_removal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid REFERENCES public.chama_groups(id) ON DELETE CASCADE NOT NULL,
  member_id uuid NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.money_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stk_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_disbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_savings_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_savings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_joining_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_platform_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_vote_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_meeting_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_penalties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_withdrawal_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_harambees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_harambee_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_term_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chama_member_removal_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 3: SECURITY DEFINER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- ============================================================
-- STEP 4: RLS POLICIES (all tables exist now)
-- ============================================================

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- wallets
CREATE POLICY "Users can view own wallet" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own wallet" ON public.wallets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all wallets" ON public.wallets FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- wallet_transactions
CREATE POLICY "Users can view own wtx" ON public.wallet_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all wtx" ON public.wallet_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- wallet_transfers
CREATE POLICY "Users can view own transfers" ON public.wallet_transfers FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Users can insert transfers" ON public.wallet_transfers FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users can update own transfers" ON public.wallet_transfers FOR UPDATE TO authenticated USING (sender_id = auth.uid());
CREATE POLICY "Admins can view all transfers" ON public.wallet_transfers FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- money_requests
CREATE POLICY "Users can view own money requests" ON public.money_requests FOR SELECT TO authenticated USING (requester_id = auth.uid() OR requested_from_id = auth.uid());
CREATE POLICY "Users can insert money requests" ON public.money_requests FOR INSERT TO authenticated WITH CHECK (requester_id = auth.uid());
CREATE POLICY "Users can update money requests" ON public.money_requests FOR UPDATE TO authenticated USING (requested_from_id = auth.uid());
CREATE POLICY "Admins can view all money requests" ON public.money_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- withdrawal_requests
CREATE POLICY "Users can view own wd" ON public.withdrawal_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert wd" ON public.withdrawal_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all wd" ON public.withdrawal_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update wd" ON public.withdrawal_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- notifications
CREATE POLICY "Users can view own notifs" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Any auth user can insert notifs" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifs" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- stk_transactions
CREATE POLICY "Users can view own stk" ON public.stk_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert stk" ON public.stk_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all stk" ON public.stk_transactions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_documents
CREATE POLICY "Users can view own docs" ON public.user_documents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own docs" ON public.user_documents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all docs" ON public.user_documents FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update docs" ON public.user_documents FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- support_messages
CREATE POLICY "Users can view own support" ON public.support_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert support" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all support" ON public.support_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert support reply" ON public.support_messages FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- admin_messages
CREATE POLICY "Users can view own admin msgs" ON public.admin_messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage admin msgs" ON public.admin_messages FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- audit_logs
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Any auth can insert audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- platform_settings
CREATE POLICY "Anyone can view settings" ON public.platform_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can update settings" ON public.platform_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- loan_applications
CREATE POLICY "Users can view own loans" ON public.loan_applications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert own loans" ON public.loan_applications FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all loans" ON public.loan_applications FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update loans" ON public.loan_applications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- loan_disbursements
CREATE POLICY "Users can view own disb" ON public.loan_disbursements FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can manage disb" ON public.loan_disbursements FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- personal_savings
CREATE POLICY "Users can view own savings" ON public.personal_savings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert savings" ON public.personal_savings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own savings" ON public.personal_savings FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins can view all savings" ON public.personal_savings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- personal_savings_deposits
CREATE POLICY "Users can view own deposits" ON public.personal_savings_deposits FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert deposits" ON public.personal_savings_deposits FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all deposits" ON public.personal_savings_deposits FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- savings_withdrawal_requests
CREATE POLICY "Users can view own swd" ON public.savings_withdrawal_requests FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert swd" ON public.savings_withdrawal_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all swd" ON public.savings_withdrawal_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update swd" ON public.savings_withdrawal_requests FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_groups
CREATE POLICY "Members can view their groups" ON public.chama_groups FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_groups.id AND chama_members.user_id = auth.uid() AND chama_members.is_active = true)
);
CREATE POLICY "Public groups visible" ON public.chama_groups FOR SELECT TO authenticated USING (is_public = true);
CREATE POLICY "Auth users can create groups" ON public.chama_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Group leaders can update" ON public.chama_groups FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_groups.id AND chama_members.user_id = auth.uid() AND chama_members.role IN ('chairperson', 'treasurer', 'secretary'))
);
CREATE POLICY "Admins can manage all groups" ON public.chama_groups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_members
CREATE POLICY "Members can view group members" ON public.chama_members FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members cm WHERE cm.group_id = chama_members.group_id AND cm.user_id = auth.uid())
);
CREATE POLICY "Auth users can insert members" ON public.chama_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Leaders can update members" ON public.chama_members FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members cm WHERE cm.group_id = chama_members.group_id AND cm.user_id = auth.uid() AND cm.role IN ('chairperson', 'treasurer', 'secretary'))
);
CREATE POLICY "Admins can manage all members" ON public.chama_members FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_savings
CREATE POLICY "Members can view group savings" ON public.chama_savings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_savings.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Members can insert savings" ON public.chama_savings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can view all chama savings" ON public.chama_savings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_joining_fees
CREATE POLICY "Members can view joining fees" ON public.chama_joining_fees FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_joining_fees.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Admins can view all joining fees" ON public.chama_joining_fees FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_platform_fees
CREATE POLICY "Members can view platform fees" ON public.chama_platform_fees FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_platform_fees.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Admins can view all platform fees" ON public.chama_platform_fees FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_messages
CREATE POLICY "Members can view group msgs" ON public.chama_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_messages.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Members can insert msgs" ON public.chama_messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- chama_announcements
CREATE POLICY "Members can view announcements" ON public.chama_announcements FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_announcements.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Leaders can insert announcements" ON public.chama_announcements FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_announcements.group_id AND chama_members.user_id = auth.uid() AND chama_members.role IN ('chairperson', 'treasurer', 'secretary'))
);

-- chama_votes
CREATE POLICY "Members can view votes" ON public.chama_votes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_votes.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Leaders can create votes" ON public.chama_votes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Leaders can update votes" ON public.chama_votes FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_votes.group_id AND chama_members.user_id = auth.uid() AND chama_members.role IN ('chairperson', 'treasurer', 'secretary'))
);

-- chama_vote_responses
CREATE POLICY "Anyone can view vote responses" ON public.chama_vote_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can insert vote responses" ON public.chama_vote_responses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- chama_meetings
CREATE POLICY "Members can view meetings" ON public.chama_meetings FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_meetings.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Leaders can manage meetings" ON public.chama_meetings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_meetings.group_id AND chama_members.user_id = auth.uid() AND chama_members.role IN ('chairperson', 'treasurer', 'secretary'))
);

-- chama_meeting_attendance
CREATE POLICY "Anyone can view attendance" ON public.chama_meeting_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Leaders can manage attendance" ON public.chama_meeting_attendance FOR ALL TO authenticated USING (true);

-- chama_loans
CREATE POLICY "Members can view group loans" ON public.chama_loans FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_loans.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Members can insert loan requests" ON public.chama_loans FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leaders can update loans" ON public.chama_loans FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_loans.group_id AND chama_members.user_id = auth.uid() AND chama_members.role IN ('chairperson', 'treasurer'))
);
CREATE POLICY "Admins can manage all chama loans" ON public.chama_loans FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_penalties
CREATE POLICY "Members can view penalties" ON public.chama_penalties FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_penalties.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Leaders can insert penalties" ON public.chama_penalties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can view all penalties" ON public.chama_penalties FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_withdrawals
CREATE POLICY "Members can view cwd" ON public.chama_withdrawals FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_withdrawals.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Leaders can create cwd" ON public.chama_withdrawals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Leaders can update cwd" ON public.chama_withdrawals FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can view all cwd" ON public.chama_withdrawals FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_withdrawal_approvals
CREATE POLICY "Anyone can view cwa" ON public.chama_withdrawal_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can insert cwa" ON public.chama_withdrawal_approvals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Members can update cwa" ON public.chama_withdrawal_approvals FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- chama_harambees
CREATE POLICY "Members can view harambees" ON public.chama_harambees FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_harambees.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Public harambees visible" ON public.chama_harambees FOR SELECT TO authenticated USING (is_public = true);
CREATE POLICY "Leaders can create harambees" ON public.chama_harambees FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Leaders can update harambees" ON public.chama_harambees FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admins can manage harambees" ON public.chama_harambees FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_harambee_contributions
CREATE POLICY "Anyone can view hc" ON public.chama_harambee_contributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Members can insert hc" ON public.chama_harambee_contributions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- chama_join_requests
CREATE POLICY "Members can view jr" ON public.chama_join_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_join_requests.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Users can create jr" ON public.chama_join_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leaders can update jr" ON public.chama_join_requests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_join_requests.group_id AND chama_members.user_id = auth.uid() AND chama_members.role IN ('chairperson', 'treasurer', 'secretary'))
);

-- chama_leave_requests
CREATE POLICY "Members can view lr" ON public.chama_leave_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_leave_requests.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Users can create lr" ON public.chama_leave_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leaders can update lr" ON public.chama_leave_requests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_leave_requests.group_id AND chama_members.user_id = auth.uid() AND chama_members.role IN ('chairperson', 'treasurer', 'secretary'))
);
CREATE POLICY "Admins can view all lr" ON public.chama_leave_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_term_signatures
CREATE POLICY "Members can view sigs" ON public.chama_term_signatures FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_term_signatures.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Members can insert sigs" ON public.chama_term_signatures FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- chama_support_messages
CREATE POLICY "Members can view csm" ON public.chama_support_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.chama_members WHERE chama_members.group_id = chama_support_messages.group_id AND chama_members.user_id = auth.uid())
);
CREATE POLICY "Members can insert csm" ON public.chama_support_messages FOR INSERT TO authenticated WITH CHECK (true);

-- transaction_reports
CREATE POLICY "Users can view own reports" ON public.transaction_reports FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users can insert reports" ON public.transaction_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage reports" ON public.transaction_reports FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- chama_member_removal_requests
CREATE POLICY "Anyone can view rmr" ON public.chama_member_removal_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert rmr" ON public.chama_member_removal_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can manage rmr" ON public.chama_member_removal_requests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- STEP 5: RPC FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.transfer_wallet_funds(
  _sender_id uuid, _receiver_id uuid, _amount numeric,
  _reason text DEFAULT NULL, _sender_name text DEFAULT NULL, _receiver_name text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _transfer_id uuid; _sender_balance numeric;
BEGIN
  SELECT balance INTO _sender_balance FROM wallets WHERE user_id = _sender_id FOR UPDATE;
  IF _sender_balance IS NULL OR _sender_balance < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE wallets SET balance = balance - _amount WHERE user_id = _sender_id;
  INSERT INTO wallets (user_id, balance) VALUES (_receiver_id, _amount) ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + _amount;
  INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES (_sender_id, 'debit', _amount, 'Transfer to ' || COALESCE(_receiver_name, 'user'));
  INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES (_receiver_id, 'credit', _amount, 'Transfer from ' || COALESCE(_sender_name, 'user'));
  INSERT INTO wallet_transfers (sender_id, receiver_id, amount, reason, sender_name, receiver_name) VALUES (_sender_id, _receiver_id, _amount, _reason, _sender_name, _receiver_name) RETURNING id INTO _transfer_id;
  RETURN _transfer_id;
END; $$;

CREATE OR REPLACE FUNCTION public.cancel_wallet_transfer(_transfer_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _transfer wallet_transfers%ROWTYPE;
BEGIN
  SELECT * INTO _transfer FROM wallet_transfers WHERE id = _transfer_id AND sender_id = _user_id AND status = 'completed';
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer not found or cannot be cancelled'; END IF;
  UPDATE wallets SET balance = balance + _transfer.amount WHERE user_id = _transfer.sender_id;
  UPDATE wallets SET balance = balance - _transfer.amount WHERE user_id = _transfer.receiver_id;
  UPDATE wallet_transfers SET status = 'cancelled', cancelled_at = now() WHERE id = _transfer_id;
  INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES (_transfer.sender_id, 'credit', _transfer.amount, 'Transfer refund');
  INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES (_transfer.receiver_id, 'debit', _transfer.amount, 'Transfer reversed');
END; $$;

CREATE OR REPLACE FUNCTION public.request_withdrawal_secure(_user_id uuid, _amount numeric, _phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _request_id uuid; _balance numeric;
BEGIN
  SELECT balance INTO _balance FROM wallets WHERE user_id = _user_id FOR UPDATE;
  IF _balance IS NULL OR _balance < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  UPDATE wallets SET balance = balance - _amount WHERE user_id = _user_id;
  INSERT INTO wallet_transactions (user_id, type, amount, description) VALUES (_user_id, 'withdrawal', _amount, 'Withdrawal request to ' || _phone);
  INSERT INTO withdrawal_requests (user_id, amount, phone) VALUES (_user_id, _amount, _phone) RETURNING id INTO _request_id;
  RETURN _request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.credit_wallet_on_loan_approval(_user_id uuid, _loan_id uuid, _amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO wallets (user_id, balance) VALUES (_user_id, _amount) ON CONFLICT (user_id) DO UPDATE SET balance = wallets.balance + _amount;
  INSERT INTO wallet_transactions (user_id, type, amount, description, reference_id) VALUES (_user_id, 'credit', _amount, 'Loan disbursement', _loan_id::text);
  INSERT INTO loan_disbursements (loan_id, user_id, disbursed_amount, outstanding_balance, interest_rate, monthly_repayment) VALUES (_loan_id, _user_id, _amount, _amount, 10, ROUND(_amount * 1.1 / 12, 2));
  UPDATE loan_applications SET status = 'disbursed' WHERE id = _loan_id;
END; $$;

CREATE OR REPLACE FUNCTION public.get_active_chama_member_count(_group_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::integer FROM public.chama_members WHERE group_id = _group_id AND is_active = true;
$$;

-- ============================================================
-- STEP 6: STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('user-documents', 'user-documents', false) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('chama-files', 'chama-files', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('harambee-images', 'harambee-images', true) ON CONFLICT DO NOTHING;

CREATE POLICY "Users upload own docs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users view own docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'user-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Admins view all docs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'user-documents' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone upload chama files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chama-files');
CREATE POLICY "Anyone view chama files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chama-files');
CREATE POLICY "Anyone upload harambee imgs" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'harambee-images');
CREATE POLICY "Anyone view harambee imgs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'harambee-images');

-- ============================================================
-- STEP 7: REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chama_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chama_support_messages;

-- ============================================================
-- STEP 8: AUTO-CREATE PROFILE + WALLET ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name) VALUES (NEW.id, COALESCE(NEW.email, ''), COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.wallets (user_id, balance) VALUES (NEW.id, 0);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
