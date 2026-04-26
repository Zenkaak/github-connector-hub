import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, Loader2, AlertTriangle, Check, RefreshCw, Link2 } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminReconcileDialog } from './AdminReconcileDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function AdminMpesaModule() {
  const [unmapped, setUnmapped] = useState<any[]>([]);
  const [b2c, setB2c] = useState<any[]>([]);
  const [c2b, setC2b] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    const [u, b, c] = await Promise.all([
      supabase.from('mpesa_unmapped_payments').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(50),
      supabase.from('mpesa_b2c_requests').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('mpesa_c2b_transactions').select('*').order('created_at', { ascending: false }).limit(50),
    ]);
    setUnmapped(u.data || []); setB2c(b.data || []); setC2b(c.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const retryB2c = async (req: any) => {
    const { error } = await supabase.functions.invoke('mpesa-b2c-retry', { body: { request_id: req.id } });
    if (error) toast.error(error.message); else { toast.success('Retry queued'); load(); }
  };

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="M-Pesa Operations" description="Monitor payments, payouts, and resolve issues" icon={Wallet} />

      <Tabs defaultValue="unmapped">
        <TabsList>
          <TabsTrigger value="unmapped">Unmapped ({unmapped.length})</TabsTrigger>
          <TabsTrigger value="b2c">Payouts (B2C)</TabsTrigger>
          <TabsTrigger value="c2b">Incoming (C2B)</TabsTrigger>
        </TabsList>

        <TabsContent value="unmapped" className="mt-4">
          {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div> :
           unmapped.length === 0 ? <AdminEmptyState icon={Check} title="All payments mapped" description="No unmapped M-Pesa payments." /> : (
            <Card className="divide-y divide-border">
              {unmapped.map((u) => (
                <div key={u.id} className="p-4 flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center"><AlertTriangle size={16} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{u.bill_ref_number}</p>
                    <p className="text-xs text-muted-foreground">{u.msisdn || '—'} • {u.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold tabular-nums">KES {Number(u.amount).toLocaleString()}</p>
                    <Button variant="outline" size="sm" className="mt-1" onClick={() => setReconciling(u)}><Link2 size={12} /> Reconcile</Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="b2c" className="mt-4">
          <Card className="divide-y divide-border">
            {b2c.map((r) => (
              <div key={r.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{r.phone} {r.receiver_party_public_name && `(${r.receiver_party_public_name})`}</p>
                  <p className="text-xs text-muted-foreground">{r.mpesa_receipt || r.result_desc || '—'}</p>
                </div>
                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                  <p className="font-bold tabular-nums">KES {Number(r.amount).toLocaleString()}</p>
                  <Badge variant={r.status === 'completed' ? 'secondary' : r.status === 'failed' ? 'destructive' : 'outline'} className="text-[10px]">{r.status}</Badge>
                  {r.status === 'failed' && !r.refunded && (
                    <Button variant="outline" size="sm" onClick={() => retryB2c(r)}><RefreshCw size={12} /> Retry</Button>
                  )}
                </div>
              </div>
            ))}
            {b2c.length === 0 && <AdminEmptyState icon={Wallet} title="No payouts yet" />}
          </Card>
        </TabsContent>

        <TabsContent value="c2b" className="mt-4">
          <Card className="divide-y divide-border">
            {c2b.map((t) => (
              <div key={t.id} className="p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{t.first_name} {t.last_name}</p>
                  <p className="text-xs text-muted-foreground">{t.msisdn} • Ref: {t.bill_ref_number || '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold tabular-nums">KES {Number(t.trans_amount).toLocaleString()}</p>
                  <Badge variant={t.processed ? 'secondary' : 'outline'} className="text-[10px]">{t.processed ? 'Processed' : 'Pending'}</Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(t.created_at), 'MMM d, HH:mm')}</p>
                </div>
              </div>
            ))}
            {c2b.length === 0 && <AdminEmptyState icon={Wallet} title="No incoming payments" />}
          </Card>
        </TabsContent>
      </Tabs>

      <AdminReconcileDialog payment={reconciling} onClose={() => setReconciling(null)} onResolved={load} />
    </div>
  );
}
