import { useEffect, useState } from "react";
import { Loader2, Settings2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  tenant: any | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved?: () => void;
}

const FEATURES = [
  { key: "chama", label: "Chama groups" },
  { key: "mgr", label: "Merry-go-round" },
  { key: "loans", label: "Loans (paybill auto-match by ID)" },
  { key: "wallet", label: "Wallet" },
  { key: "harambee", label: "Harambees" },
];

export function AdminTenantConfigDialog({ tenant, open, onOpenChange, onSaved }: Props) {
  const [paybill, setPaybill] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#10b981");
  const [logoUrl, setLogoUrl] = useState("");
  const [status, setStatus] = useState<"active" | "suspended">("active");
  const [autoSync, setAutoSync] = useState(true);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setPaybill(tenant.paybill_shortcode || "");
    setCustomDomain(tenant.custom_domain || "");
    setPrimaryColor(tenant.primary_color || "#10b981");
    setLogoUrl(tenant.logo_url || "");
    setStatus(tenant.status || "active");
    setAutoSync(tenant.auto_sync_updates !== false);
    setFeatures(tenant.features_enabled || {});
  }, [tenant?.id]);

  if (!tenant) return null;

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.from("tenants" as any).update({
      paybill_shortcode: paybill.trim() || null,
      custom_domain: customDomain.trim() || null,
      primary_color: primaryColor,
      logo_url: logoUrl.trim() || null,
      status,
      auto_sync_updates: autoSync,
      features_enabled: features,
    }).eq("id", tenant.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("SACCO settings saved");
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Settings2 size={18} className="text-accent" /> {tenant.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Paybill shortcode</Label><Input value={paybill} onChange={(e) => setPaybill(e.target.value)} placeholder="e.g. 4123456" /></div>
            <div><Label className="text-xs">Status</Label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as any)}>
                <option value="active">Active</option><option value="suspended">Suspended</option>
              </select>
            </div>
          </div>
          <div><Label className="text-xs">Custom domain</Label><Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="chama.saccoabc.co.ke" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Brand color</Label><Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 p-1" /></div>
            <div><Label className="text-xs">Logo URL</Label><Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" /></div>
          </div>

          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Enabled modules</p>
            {FEATURES.map(f => (
              <div key={f.key} className="flex items-center justify-between">
                <Label htmlFor={`f-${f.key}`} className="text-sm cursor-pointer">{f.label}</Label>
                <Switch id={`f-${f.key}`} checked={features[f.key] !== false} onCheckedChange={(v) => setFeatures(prev => ({ ...prev, [f.key]: v }))} />
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border/60 p-3 flex items-start justify-between gap-3">
            <div>
              <Label htmlFor="auto-sync" className="text-sm font-semibold cursor-pointer">Auto-sync platform updates</Label>
              <p className="text-xs text-muted-foreground mt-0.5">When enabled, updates pushed to the main Dasnet app automatically flow to this SACCO's portal.</p>
            </div>
            <Switch id="auto-sync" checked={autoSync} onCheckedChange={setAutoSync} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="gold" onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16} /> : "Save changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
