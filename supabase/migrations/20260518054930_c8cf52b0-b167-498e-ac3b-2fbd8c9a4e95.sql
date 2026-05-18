
-- ============================================
-- MULTI-TENANT (SACCO WHITE-LABEL) FOUNDATION
-- Additive only — does NOT alter Dasnet behavior
-- ============================================

-- 1. TENANTS TABLE
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#10b981',
  secondary_color text DEFAULT '#0f172a',
  custom_domain text UNIQUE,
  paybill_shortcode text,
  paybill_consumer_key_ref text,   -- name of secret in vault (not the secret itself)
  paybill_consumer_secret_ref text,
  paybill_passkey_ref text,
  callback_token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text,'-',''),
  features_enabled jsonb NOT NULL DEFAULT '{"chama":true,"mgr":true,"loans":true,"wallet":false,"harambee":false}'::jsonb,
  status text NOT NULL DEFAULT 'active', -- active | suspended
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- 2. TENANT ADMINS
CREATE TABLE IF NOT EXISTS public.tenant_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'admin', -- admin | manager | viewer
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

ALTER TABLE public.tenant_admins ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tenant_admins_user ON public.tenant_admins(user_id);

-- 3. ADDITIVE tenant_id columns on existing tables (nullable -> existing rows = Dasnet main)
ALTER TABLE public.chama_groups ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;
ALTER TABLE public.stk_transactions ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_chama_groups_tenant ON public.chama_groups(tenant_id);
CREATE INDEX IF NOT EXISTS idx_stk_transactions_tenant ON public.stk_transactions(tenant_id);

-- 4. SECURITY DEFINER HELPERS
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_tenant_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_admins
    WHERE tenant_id = _tenant_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.tenant_admins WHERE user_id = _user_id LIMIT 1
$$;

-- 5. RLS POLICIES

-- Tenants: super-admins manage all; tenant admins read their own; anyone can read by custom_domain lookup (public branding)
CREATE POLICY "Super admins manage tenants"
ON public.tenants FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Tenant admins read own tenant"
ON public.tenants FOR SELECT
USING (public.is_tenant_admin(id, auth.uid()));

CREATE POLICY "Public can read tenant branding by slug"
ON public.tenants FOR SELECT
USING (status = 'active');

-- Tenant admins table
CREATE POLICY "Super admins manage tenant admins"
ON public.tenant_admins FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users see own tenant admin row"
ON public.tenant_admins FOR SELECT
USING (user_id = auth.uid());

-- 6. updated_at trigger
CREATE TRIGGER trg_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
