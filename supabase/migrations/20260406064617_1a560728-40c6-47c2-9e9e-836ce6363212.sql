
CREATE POLICY "Admins can update wallets" ON public.wallets
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update personal savings" ON public.personal_savings
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
