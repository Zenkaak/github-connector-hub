
-- Add purpose and group_id columns to stk_transactions so callback knows what to record
ALTER TABLE public.stk_transactions ADD COLUMN IF NOT EXISTS purpose text DEFAULT 'activation';
ALTER TABLE public.stk_transactions ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.chama_groups(id) ON DELETE SET NULL;
ALTER TABLE public.stk_transactions ADD COLUMN IF NOT EXISTS savings_id uuid REFERENCES public.personal_savings(id) ON DELETE SET NULL;

-- Allow authenticated users to update their own stk_transactions (for expiry marking)
CREATE POLICY "Users can update own stk"
ON public.stk_transactions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
