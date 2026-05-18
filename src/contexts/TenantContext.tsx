import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  custom_domain: string | null;
  paybill_shortcode: string | null;
  callback_token: string;
  features_enabled: Record<string, boolean>;
  status: string;
}

interface Ctx {
  tenant: Tenant | null;
  loading: boolean;
  isTenantAdmin: boolean;
}

const TenantContext = createContext<Ctx>({ tenant: null, loading: true, isTenantAdmin: false });

export function TenantProvider({ children }: { children: ReactNode }) {
  const { slug } = useParams<{ slug: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!slug) { setLoading(false); return; }
      const { data } = await supabase
        .from("tenants" as any).select("*").eq("slug", slug).maybeSingle();
      if (!alive) return;
      setTenant((data as any) || null);

      const { data: { user } } = await supabase.auth.getUser();
      if (user && data) {
        const { data: link } = await supabase
          .from("tenant_admins" as any).select("id")
          .eq("tenant_id", (data as any).id).eq("user_id", user.id).maybeSingle();
        if (alive) setIsTenantAdmin(!!link);
      }

      // Apply tenant branding via CSS variables
      if (data && (data as any).primary_color) {
        document.documentElement.style.setProperty("--tenant-primary", (data as any).primary_color);
      }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [slug]);

  return (
    <TenantContext.Provider value={{ tenant, loading, isTenantAdmin }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
