import { useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useTenant, TenantProvider } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";

function LoginInner() {
  const { tenant, loading } = useTenant();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      // Confirm caller is admin of THIS tenant
      const { data: link } = await supabase
        .from("tenant_admins" as any).select("id")
        .eq("tenant_id", tenant!.id).eq("user_id", data.user!.id).maybeSingle();
      if (!link) {
        await supabase.auth.signOut();
        throw new Error("This account is not an admin of " + tenant!.name);
      }
      navigate(`/sacco/${slug}/admin`, { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!tenant) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">SACCO not found.</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted/40">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center gap-3 mb-6">
          {tenant.logo_url
            ? <img src={tenant.logo_url} alt={tenant.name} className="h-16 w-16 rounded-xl object-cover" />
            : <div className="h-16 w-16 rounded-xl flex items-center justify-center" style={{ background: tenant.primary_color || "#10b981" }}><Building2 size={28} className="text-white" /></div>}
          <h1 className="text-2xl font-bold text-foreground">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">SACCO Admin Portal</p>
        </div>

        <form onSubmit={submit} className="bg-card border border-border/40 rounded-2xl p-6 space-y-4 shadow-lg">
          <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></div>
          <Button type="submit" className="w-full" disabled={busy} style={{ background: tenant.primary_color || undefined }}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : "Sign In"}
          </Button>
          <p className="text-center text-xs text-muted-foreground"><Link to="/forgot-password" className="hover:underline">Forgot password?</Link></p>
        </form>
        <p className="text-center text-[11px] text-muted-foreground mt-4">Powered by Dasnet</p>
      </div>
    </div>
  );
}

export default function TenantLoginPage() {
  return <TenantProvider><LoginInner /></TenantProvider>;
}
