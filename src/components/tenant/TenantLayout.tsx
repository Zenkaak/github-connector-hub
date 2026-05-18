import { ReactNode } from "react";
import { useTenant, TenantProvider } from "@/contexts/TenantContext";
import { Loader2, Building2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";

function Inner({ children }: { children: ReactNode }) {
  const { tenant, loading } = useTenant();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="animate-spin text-accent" /></div>;
  if (!tenant) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">SACCO not found.</p></div>;
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link to={`/sacco/${tenant.slug}/admin`} className="flex items-center gap-2 min-w-0">
            {tenant.logo_url
              ? <img src={tenant.logo_url} alt={tenant.name} className="h-8 w-8 rounded-md object-cover" />
              : <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ background: tenant.primary_color || "#10b981" }}><Building2 size={16} className="text-white" /></div>}
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate text-sm">{tenant.name}</p>
              <p className="text-[10px] text-muted-foreground -mt-0.5">SACCO Admin Portal</p>
            </div>
          </Link>
          {tenant.paybill_shortcode && (
            <div className="text-xs text-muted-foreground hidden sm:block">
              Paybill: <span className="font-mono text-foreground">{tenant.paybill_shortcode}</span>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto">{children}</main>
    </div>
  );
}

export function TenantLayout({ children }: { children: ReactNode }) {
  // useParams must run inside Router; TenantProvider uses it
  useParams();
  return (
    <TenantProvider>
      <Inner>{children}</Inner>
    </TenantProvider>
  );
}
