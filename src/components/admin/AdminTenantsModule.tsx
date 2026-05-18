import { useEffect, useState } from "react";
import { Building2, Plus, Loader2, Copy, ExternalLink, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AdminCreateTenantDialog } from "./AdminCreateTenantDialog";

export function AdminTenantsModule() {
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreate, setOpenCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tenants" as any).select("*").order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setTenants((data as any) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const projectRef = "qtrubtfubdzodahsfacv";
  const callbackBase = `https://${projectRef}.supabase.co/functions/v1/mpesa-tenant-c2b`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Building2 className="text-accent" /> SACCO Tenants</h1>
          <p className="text-sm text-muted-foreground">White-label Chama portals for SACCOs.</p>
        </div>
        <Button variant="gold" onClick={() => setOpenCreate(true)}><Plus size={16} className="mr-1" />Create SACCO</Button>
      </div>

      {loading ? <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        : tenants.length === 0
        ? <Card className="p-8 text-center"><Building2 className="mx-auto mb-3 text-muted-foreground" /><p className="text-sm text-muted-foreground">No SACCO tenants yet. Create your first white-label client to get started.</p></Card>
        : <div className="grid gap-3 lg:grid-cols-2">
          {tenants.map(t => {
            const portal = t.custom_domain ? `https://${t.custom_domain}/sacco/${t.slug}/admin` : `${window.location.origin}/sacco/${t.slug}/admin`;
            const callback = `${callbackBase}?token=${t.callback_token}`;
            return (
              <Card key={t.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {t.logo_url
                      ? <img src={t.logo_url} alt={t.name} className="h-10 w-10 rounded-lg object-cover" />
                      : <div className="h-10 w-10 rounded-lg flex items-center justify-center text-white" style={{ background: t.primary_color || "#10b981" }}><Building2 size={18} /></div>}
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{t.name}</p>
                      <p className="text-xs text-muted-foreground">/{t.slug}</p>
                    </div>
                  </div>
                  <Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge>
                </div>
                <div className="text-xs grid grid-cols-2 gap-2">
                  <div><p className="text-muted-foreground">Paybill</p><p className="font-mono">{t.paybill_shortcode || "—"}</p></div>
                  <div><p className="text-muted-foreground">Custom Domain</p><p className="truncate">{t.custom_domain || "—"}</p></div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1">
                    <code className="text-[10px] flex-1 bg-muted/50 px-2 py-1 rounded truncate">{portal}</code>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(portal); toast.success("Copied"); }}><Copy size={12} /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" asChild><a href={portal} target="_blank" rel="noreferrer"><ExternalLink size={12} /></a></Button>
                  </div>
                  <div className="flex items-center gap-1">
                    <code className="text-[10px] flex-1 bg-muted/50 px-2 py-1 rounded truncate" title="M-Pesa C2B confirmation URL">{callback}</code>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(callback); toast.success("Callback URL copied"); }}><Copy size={12} /></Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>}

      <AdminCreateTenantDialog open={openCreate} onOpenChange={setOpenCreate} onCreated={load} />
    </div>
  );
}
