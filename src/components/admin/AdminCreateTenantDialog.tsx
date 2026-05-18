import { useState } from "react";
import { Loader2, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}

export function AdminCreateTenantDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [color, setColor] = useState("#10b981");
  const [customDomain, setCustomDomain] = useState("");
  const [paybill, setPaybill] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPhone, setAdminPhone] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !adminName.trim() || !adminPhone.trim() || !adminEmail.trim()) {
      toast.error("Name, admin name, phone, and email are required"); return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-tenant", {
        body: {
          name: name.trim(),
          slug: slug.trim() || undefined,
          logo_url: logoUrl.trim() || null,
          primary_color: color,
          custom_domain: customDomain.trim() || null,
          paybill_shortcode: paybill.trim() || null,
          admin_full_name: adminName.trim(),
          admin_phone: adminPhone.trim(),
          admin_email: adminEmail.trim(),
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("SACCO created — invite sent via SMS & email");
      onOpenChange(false);
      setName(""); setSlug(""); setLogoUrl(""); setCustomDomain("");
      setPaybill(""); setAdminName(""); setAdminPhone(""); setAdminEmail("");
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 size={18} className="text-accent" /> Create SACCO Tenant</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">SACCO Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wanainchi SACCO" /></div>
            <div><Label className="text-xs">URL Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto from name" /></div>
          </div>
          <div><Label className="text-xs">Logo URL (optional)</Label><Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Brand Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 p-1" /></div>
            <div><Label className="text-xs">Custom Domain (optional)</Label><Input value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="chama.saccoabc.co.ke" /></div>
          </div>
          <div><Label className="text-xs">M-Pesa Paybill Shortcode (optional)</Label><Input value={paybill} onChange={(e) => setPaybill(e.target.value)} placeholder="e.g. 4123456" /></div>

          <div className="pt-3 border-t border-border/40 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">SACCO Admin (will receive SMS & email)</p>
            <div><Label className="text-xs">Full Name *</Label><Input value={adminName} onChange={(e) => setAdminName(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">Phone *</Label><Input value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} placeholder="07XX… or 2547XX…" /></div>
              <div><Label className="text-xs">Email *</Label><Input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} /></div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16} /> : "Create & Send Invite"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
