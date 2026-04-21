
-- 1. Avatar on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Migrate existing 4-char harambee short codes to 3-digit
-- (we have only one harambee right now: '1212' → '121')
UPDATE public.chama_harambees 
SET short_code = LPAD((FLOOR(RANDOM() * 900) + 100)::text, 3, '0')
WHERE short_code IS NULL OR LENGTH(short_code) <> 3;

-- Helper: generate unique 3-digit harambee code
CREATE OR REPLACE FUNCTION public.generate_harambee_short_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate text;
  exists_already boolean;
BEGIN
  LOOP
    candidate := LPAD((FLOOR(RANDOM() * 900) + 100)::int::text, 3, '0');
    SELECT EXISTS(SELECT 1 FROM public.chama_harambees WHERE short_code = candidate) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 3. Merry-Go-Round cycles table
CREATE TABLE IF NOT EXISTS public.chama_mgr_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.chama_groups(id) ON DELETE CASCADE,
  cycle_number int NOT NULL,
  recipient_id uuid NOT NULL,
  recipient_name text,
  contribution_amount numeric NOT NULL,
  penalty_amount numeric NOT NULL DEFAULT 0,
  deadline timestamptz NOT NULL,
  payout_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open', -- open | paid_out | cancelled
  payout_processed_at timestamptz,
  payout_amount numeric,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, cycle_number)
);

ALTER TABLE public.chama_mgr_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view mgr cycles"
  ON public.chama_mgr_cycles FOR SELECT
  TO authenticated
  USING (is_chama_member(group_id, auth.uid()));

CREATE POLICY "Chair can create mgr cycles"
  ON public.chama_mgr_cycles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM chama_members WHERE group_id = chama_mgr_cycles.group_id AND user_id = auth.uid() AND role = 'chairperson')
  );

CREATE POLICY "Chair can update mgr cycles"
  ON public.chama_mgr_cycles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM chama_members WHERE group_id = chama_mgr_cycles.group_id AND user_id = auth.uid() AND role = 'chairperson')
  );

CREATE POLICY "Service can update mgr cycles"
  ON public.chama_mgr_cycles FOR UPDATE
  TO service_role
  USING (true);

-- 4. Contributions to a cycle
CREATE TABLE IF NOT EXISTS public.chama_mgr_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.chama_mgr_cycles(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'wallet', -- wallet | paybill | stk
  reference text,
  paid_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chama_mgr_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view mgr contributions"
  ON public.chama_mgr_contributions FOR SELECT
  TO authenticated
  USING (is_chama_member(group_id, auth.uid()));

CREATE POLICY "Members can insert own mgr contributions"
  ON public.chama_mgr_contributions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_chama_member(group_id, auth.uid()));

CREATE POLICY "Service can insert mgr contributions"
  ON public.chama_mgr_contributions FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 5. Storage bucket for avatars (public)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
