
CREATE TABLE IF NOT EXISTS public.tenant_paybill_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  mpesa_receipt text,
  amount numeric NOT NULL,
  payer_phone text,
  payer_name text,
  account_reference text,
  trans_time timestamptz,
  raw_payload jsonb,
  status text NOT NULL DEFAULT 'unmatched', -- unmatched | matched | refunded
  matched_user_id uuid,
  matched_loan_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, mpesa_receipt)
);

ALTER TABLE public.tenant_paybill_transactions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tpt_tenant ON public.tenant_paybill_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tpt_acc ON public.tenant_paybill_transactions(account_reference);

CREATE POLICY "Super admins manage all tenant payments"
ON public.tenant_paybill_transactions FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tenant admins view own payments"
ON public.tenant_paybill_transactions FOR SELECT
USING (public.is_tenant_admin(tenant_id, auth.uid()));

CREATE POLICY "Tenant admins update own payments"
ON public.tenant_paybill_transactions FOR UPDATE
USING (public.is_tenant_admin(tenant_id, auth.uid()))
WITH CHECK (public.is_tenant_admin(tenant_id, auth.uid()));
