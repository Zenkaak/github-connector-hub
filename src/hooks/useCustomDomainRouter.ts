// Detects whether the current hostname matches a tenant.custom_domain.
// When matched and the current path is the root, automatically rewrites the
// URL to /sacco/:slug/admin (or /login) so the tenant portal is served as if
// the SACCO has its own dedicated app — no separate hosting needed.
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SKIP_HOSTS = ["localhost", "127.0.0.1", "lovable.app", "lovable.dev", "dasnetventures.lovable.app"];

export function useCustomDomainRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const host = window.location.hostname;
    if (!host) return;
    if (SKIP_HOSTS.some((h) => host === h || host.endsWith("." + h))) return;
    if (location.pathname.startsWith("/sacco/")) return; // already inside tenant routes

    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("tenants" as any)
        .select("slug, status")
        .eq("custom_domain", host)
        .maybeSingle();
      if (!alive || !data) return;
      const tenant = data as any;
      if (tenant.status !== "active") return;
      const { data: { session } } = await supabase.auth.getSession();
      const dest = session
        ? `/sacco/${tenant.slug}/admin`
        : `/sacco/${tenant.slug}/login`;
      navigate(dest, { replace: true });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
}
