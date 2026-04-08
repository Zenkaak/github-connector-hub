
-- Add missing columns to stk_transactions for loan repayment tracking
ALTER TABLE public.stk_transactions ADD COLUMN IF NOT EXISTS loan_id uuid;
ALTER TABLE public.stk_transactions ADD COLUMN IF NOT EXISTS disbursement_id uuid;

-- Change default visibility for new chama groups to public (visible in explorer)
ALTER TABLE public.chama_groups ALTER COLUMN is_public SET DEFAULT true;

-- Allow anon users to SELECT public harambees (for shared links)
CREATE POLICY "Anon can view public harambees" ON public.chama_harambees FOR SELECT TO anon USING (is_public = true);

-- Allow anon to view public chama_groups (for harambee group name lookup)
CREATE POLICY "Anon can view public groups" ON public.chama_groups FOR SELECT TO anon USING (is_public = true);

-- Allow anon to view harambee contributions (for public page)
CREATE POLICY "Anon can view harambee contributions" ON public.chama_harambee_contributions FOR SELECT TO anon USING (true);

-- Add RLS for chama_joining_fees INSERT by service role (callback)
CREATE POLICY "Auth users can insert joining fees" ON public.chama_joining_fees FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Handle chama_join callback: auto-add member after fee payment
-- We need the mpesa-callback to handle this, adding it as a purpose handler
