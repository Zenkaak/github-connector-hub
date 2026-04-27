import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Wallet, Loader2, AlertTriangle, Check, RefreshCw, Link2, Zap
} from 'lucide-react';
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
      supabase.from('mpesa_unmapped_payments').select('*').eq('resolved', false),
      supabase.from('mpesa_b2c_requests').select('*'),
      supabase.from('mpesa_c2b_transactions').select('*'),
    ]);

    setUnmapped((u.data || []).sort((a, b) => b.amount - a.amount));
    setB2c(b.data || []);
    setC2b(c.data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel('mpesa-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mpesa_unmapped_payments' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mpesa_b2c_requests' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mpesa_c2b_transactions' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const retryB2c = async (req: any) => {
    const { error } = await supabase.functions.invoke('mpesa-b2c-retry', {
      body: { request_id: req.id },
    });

    if (error) toast.error(error.message);
    else {
      toast.success('Retry queued');
      load();
    }
  };

  // 🔥 AUTO RECONCILIATION LOGIC
  const autoReconcile = async () => {
    let matched = 0;

    for (const payment of unmapped) {
      const match = c2b.find(
        (t) =>
          !t.processed &&
          Number(t.trans_amount) === Number(payment.amount) &&
          t.msisdn === payment.msisdn
      );

      if (match) {
        await supabase
          .from('mpesa_unmapped_payments')
          .update({ resolved: true })
          .eq('id', payment.id);

        await supabase
          .from('mpesa_c2b_transactions')
          .update({ processed: true })
          .eq('id', match.id);

        matched++;
      }
    }

    toast.success(`${matched} payments auto-matched`);
    load();
  };

  const totalUnmapped = unmapped.length;
  const failedB2c = b2c.filter(r => r.status === 'failed').length;
  const pendingC2b = c2b.filter(t => !t.processed).length;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      <AdminSectionHeader
        title="M-Pesa Operations"
        description="Realtime payments, reconciliation & payout monitoring"
        icon={Wallet}
      />

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs">Unmapped</p>
          <p className="text-lg font-bold text-amber-600">{totalUnmapped}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs">Failed Payouts</p>
          <p className="text-lg font-bold text-red-600">{failedB2c}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs">Pending C2B</p>
          <p className="text-lg font-bold">{pendingC2b}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs">Volume</p>
          <p className="text-lg font-bold">
            KES {[...b2c, ...c2b].reduce((s, x: any) => s + Number(x.amount || x.trans_amount || 0), 0).toLocaleString()}
          </p>
        </Card>
      </div>

      {/* ALERT */}
      {failedB2c > 5 && (
        <Card className="p-3 border-red-500/30 bg-red-500/5">
          ⚠ High failed payout rate detected
        </Card>
      )}

      {/* AUTO BUTTON */}
      <Button onClick={autoReconcile} className="gap-2">
        <Zap size={14} /> Auto Reconcile
      </Button>

      <Tabs defaultValue="unmapped">
        <TabsList>
          <TabsTrigger value="unmapped">Unmapped ({unmapped.length})</TabsTrigger>
          <TabsTrigger value="b2c">B2C</TabsTrigger>
          <TabsTrigger value="c2b">C2B</TabsTrigger>
        </TabsList>

        <TabsContent value="unmapped" className="mt-4">
          {unmapped.length === 0 ? (
            <AdminEmptyState icon={Check} title="All payments mapped" />
          ) : (
            <Card className="divide-y">
              {unmapped.map((u) => (
                <div key={u.id} className="p-4 flex justify-between">
                  <div>
                    <p className="font-semibold">{u.bill_ref_number}</p>
                    <p className="text-xs">{u.msisdn}</p>
                  </div>

                  <div className="text-right">
                    <p className="font-bold">KES {Number(u.amount).toLocaleString()}</p>

                    <Button
                      size="sm"
                      onClick={() => {
                        if (!u.msisdn) {
                          toast.error("Missing phone");
                          return;
                        }
                        setReconciling(u);
                      }}
                    >
                      <Link2 size={12} /> Reconcile
                    </Button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="b2c" className="mt-4">
          <Card className="divide-y">
            {b2c.map((r) => (
              <div key={r.id} className="p-4 flex justify-between">
                <div>
                  <p>{r.phone}</p>
                  <p className="text-xs">{r.result_desc}</p>
                </div>

                <div className="text-right">
                  <p>KES {Number(r.amount).toLocaleString()}</p>

                  <Badge variant={
                    r.status === 'completed'
                      ? 'secondary'
                      : r.status === 'failed'
                      ? 'destructive'
                      : 'outline'
                  }>
                    {r.status}
                  </Badge>

                  {r.status === 'failed' && (
                    <Button size="sm" onClick={() => retryB2c(r)}>
                      <RefreshCw size={12} /> Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="c2b" className="mt-4">
          <Card className="divide-y">
            {c2b.map((t) => (
              <div key={t.id} className="p-4 flex justify-between">
                <div>
                  <p>{t.first_name} {t.last_name}</p>
                  <p className="text-xs">{t.msisdn}</p>
                </div>

                <div className="text-right">
                  <p>KES {Number(t.trans_amount).toLocaleString()}</p>
                  <Badge>{t.processed ? 'Processed' : 'Pending'}</Badge>
                </div>
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>

      {reconciling && (
        <AdminReconcileDialog
          payment={reconciling}
          open={!!reconciling}
          onClose={() => setReconciling(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
                   }
