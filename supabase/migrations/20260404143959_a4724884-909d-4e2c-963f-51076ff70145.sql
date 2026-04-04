
CREATE POLICY "Service role can update stk" ON public.stk_transactions
FOR UPDATE TO service_role
USING (true)
WITH CHECK (true);
