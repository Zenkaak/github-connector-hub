import { useEffect, useState } from "react";
import { TenantLayout } from "@/components/tenant/TenantLayout";
import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, Users, CreditCard, RefreshCw, LogOut, CheckCircle2, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

function Inner() {
  const { tenant, isTenantAdmin, loading } = useTenant();
  const navigate = useNavigate();
  const [txns, setTxns] = useState<any[]>([]);
  const [chamas, setChamas] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const refresh = async () => {
    if (!tenant) return;
    setLoadingData(true);
    const [{ data: tx }, { data: cg }] = await Promise.all([
      supabase.from("tenant_paybill_transactions" as any).select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(100),
      supabase.from("chama_groups").select("id, name, member_count, total_balance").eq("tenant_id", tenant.id),
    ]);
    setTxns((tx as any) || []);
    setChamas((cg as any) || []);
    setLoadingData(false);
  };

  useEffect(() => { refresh(); }, [tenant?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate(`/sacco/${tenant!.slug}/login`, { replace: true });
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>;
  if (!isTenantAdmin) return <div className="p-8 text-center"><p className="text-muted-foreground mb-4">You are not authorized to view this portal.</p><Button onClick={() => navigate(`/sacco/${tenant!.slug}/login`)}>Sign In</Button></div>;

  const totalReceived = txns.filter(t => t.status !== "refunded").reduce((s, t) => s + Number(t.amount || 0), 0);
  const unmatched = txns.filter(t => t.status === "unmatched").length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{tenant!.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh}><RefreshCw size={14} className="mr-1" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut size={14} className="mr-1" />Sign Out</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><CreditCard size={14} />Total Received</div><p className="text-2xl font-bold mt-1">KES {totalReceived.toLocaleString()}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Clock size={14} />Unmatched</div><p className="text-2xl font-bold mt-1">{unmatched}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Users size={14} />Chama Groups</div><p className="text-2xl font-bold mt-1">{chamas.length}</p></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 size={14} />Paybill</div><p className="text-lg font-mono font-bold mt-1">{tenant!.paybill_shortcode || "—"}</p></Card>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold text-foreground mb-3">Incoming Paybill Payments</h2>
        {loadingData ? <Loader2 className="animate-spin mx-auto my-6" />
          : txns.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-6">No transactions yet. Members pay to paybill <strong className="font-mono">{tenant!.paybill_shortcode || "—"}</strong> using their <strong>ID number</strong> as the account reference.</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b border-border/40">
                  <tr><th className="text-left p-2">Receipt</th><th className="text-left p-2">Amount</th><th className="text-left p-2">From</th><th className="text-left p-2">ID Ref</th><th className="text-left p-2">Time</th><th className="text-left p-2">Status</th></tr>
                </thead>
                <tbody>
                  {txns.map(t => (
                    <tr key={t.id} className="border-b border-border/20">
                      <td className="p-2 font-mono text-xs">{t.mpesa_receipt}</td>
                      <td className="p-2 font-semibold">KES {Number(t.amount).toLocaleString()}</td>
                      <td className="p-2">{t.payer_name}<br /><span className="text-xs text-muted-foreground">{t.payer_phone}</span></td>
                      <td className="p-2 font-mono">{t.account_reference || "—"}</td>
                      <td className="p-2 text-xs">{t.trans_time ? new Date(t.trans_time).toLocaleString() : "—"}</td>
                      <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded ${t.status === "matched" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}`}>{t.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold text-foreground mb-3">Chama Groups under this SACCO</h2>
        {chamas.length === 0
          ? <p className="text-sm text-muted-foreground text-center py-6">No chama groups created yet for this SACCO.</p>
          : <ul className="divide-y divide-border/30">{chamas.map(c => (
            <li key={c.id} className="py-2 flex justify-between"><span>{c.name}</span><span className="text-xs text-muted-foreground">{c.member_count || 0} members • KES {Number(c.total_balance || 0).toLocaleString()}</span></li>
          ))}</ul>}
      </Card>
    </div>
  );
}

export default function TenantAdminPage() {
  return <TenantLayout><Inner /></TenantLayout>;
}
