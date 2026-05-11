import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Wallet, Loader2, AlertTriangle, Check, RefreshCw, Link2, Zap, Send, ArrowDownLeft, CheckCircle2,
} from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminKpiCard } from './AdminKpiCard';
import { AdminToolbar, exportToCsv } from './AdminToolbar';
import { AdminReconcileDialog } from './AdminReconcileDialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Tab = 'unmapped' | 'b2c' | 'c2b';

export function AdminMpesaModule() {
  const [unmapped, setUnmapped] = useState<any[]>([]);
  const [b2c, setB2c] = useState<any[]>([]);
  const [c2b, setC2b] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('unmapped');
  const [search, setSearch] = useState('');
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [u, b, c] = await Promise.all([
      supabase.from('mpesa_unmapped_payments').select('*').eq('resolved', false),
      supabase.from('mpesa_b2c_requests').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('mpesa_c2b_transactions').select('*').order('created_at', { ascending: false }).limit(500),
    ]);
    setUnmapped((u.data || []).sort((a, b) => Number(b.amount) - Number(a.amount)));
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
    return () => { supabase.removeChannel(channel); };
  }, []);

  const retryB2c = async (req: any) => {
    const { error } = await supabase.functions.invoke('mpesa-b2c-retry', { body: { request_id: req.id } });
    if (error) toast.error(error.message);
    else { toast.success('Retry queued'); load(); }
  };

  const autoReconcile = async () => {
    setRunning(true);
    let matched = 0;
    for (const payment of unmapped) {
      const match = c2b.find((t) => !t.processed && Number(t.trans_amount) === Number(payment.amount) && t.msisdn === payment.msisdn);
      if (match) {
        await supabase.from('mpesa_unmapped_payments').update({ resolved: true }).eq('id', payment.id);
        await supabase.from('mpesa_c2b_transactions').update({ processed: true }).eq('id', match.id);
        matched++;
      }
    }
    toast.success(matched ? `${matched} payments auto-matched` : 'No automatic matches found');
    setRunning(false);
    load();
  };

  const totalUnmapped = unmapped.length;
  const failedB2c = b2c.filter((r) => r.status === 'failed').length;
  const pendingC2b = c2b.filter((t) => !t.processed).length;
  const totalVolume = useMemo(() =>
    [...b2c, ...c2b].reduce((s, x: any) => s + Number(x.amount || x.trans_amount || 0), 0)
  , [b2c, c2b]);

  // Per-tab filtered lists + export
  const filteredUnmapped = unmapped.filter((u) => !search ||
    u.bill_ref_number?.toLowerCase().includes(search.toLowerCase()) || u.msisdn?.includes(search));
  const filteredB2c = b2c.filter((r) => !search ||
    r.phone?.includes(search) || r.mpesa_receipt?.toLowerCase().includes(search.toLowerCase()) || r.status?.includes(search.toLowerCase()));
  const filteredC2b = c2b.filter((t) => !search ||
    t.msisdn?.includes(search) || t.trans_id?.toLowerCase().includes(search.toLowerCase()) ||
    `${t.first_name || ''} ${t.last_name || ''}`.toLowerCase().includes(search.toLowerCase()));

  const exportCurrent = () => {
    const ts = format(new Date(), 'yyyy-MM-dd');
    if (tab === 'unmapped') exportToCsv(`mpesa-unmapped-${ts}`, filteredUnmapped, [
      { header: 'Bill Ref', get: (u) => u.bill_ref_number || '' },
      { header: 'Phone',    get: (u) => u.msisdn || '' },
      { header: 'Amount',   get: (u) => Number(u.amount || 0) },
      { header: 'Date',     get: (u) => u.created_at ? format(new Date(u.created_at), 'yyyy-MM-dd HH:mm') : '' },
    ]);
    else if (tab === 'b2c') exportToCsv(`mpesa-b2c-${ts}`, filteredB2c, [
      { header: 'Phone',   get: (r) => r.phone || '' },
      { header: 'Amount',  get: (r) => Number(r.amount || 0) },
      { header: 'Receipt', get: (r) => r.mpesa_receipt || '' },
      { header: 'Status',  get: (r) => r.status },
      { header: 'Result',  get: (r) => r.result_desc || '' },
      { header: 'Date',    get: (r) => r.created_at ? format(new Date(r.created_at), 'yyyy-MM-dd HH:mm') : '' },
    ]);
    else exportToCsv(`mpesa-c2b-${ts}`, filteredC2b, [
      { header: 'Name',     get: (t) => `${t.first_name || ''} ${t.last_name || ''}`.trim() },
      { header: 'Phone',    get: (t) => t.msisdn || '' },
      { header: 'Amount',   get: (t) => Number(t.trans_amount || 0) },
      { header: 'Trans ID', get: (t) => t.trans_id || '' },
      { header: 'Bill Ref', get: (t) => t.bill_ref_number || '' },
      { header: 'Processed',get: (t) => t.processed ? 'yes' : 'no' },
      { header: 'Date',     get: (t) => t.created_at ? format(new Date(t.created_at), 'yyyy-MM-dd HH:mm') : '' },
    ]);
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-5">
      <AdminSectionHeader
        title="M-Pesa Operations"
        description="Realtime payments, reconciliation & payout monitoring"
        icon={Wallet}
        actions={
          <Button variant="gold" size="sm" onClick={autoReconcile} disabled={running || !unmapped.length} className="gap-1.5">
            <Zap size={14} /> {running ? 'Reconciling…' : 'Auto Reconcile'}
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpiCard label="Unmapped" value={totalUnmapped.toLocaleString()} icon={AlertTriangle} accent="gold" />
        <AdminKpiCard label="Failed payouts" value={failedB2c.toLocaleString()} icon={Send} accent="red" />
        <AdminKpiCard label="Pending C2B" value={pendingC2b.toLocaleString()} icon={ArrowDownLeft} accent="blue" />
        <AdminKpiCard label="Total volume" value={`KES ${Math.round(totalVolume).toLocaleString()}`} icon={Wallet} accent="emerald" />
      </div>

      {failedB2c > 5 && (
        <Card className="p-4 border-red-500/40 bg-red-500/10">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500 shrink-0" size={18} />
            <p className="text-sm font-semibold text-foreground">High failed payout rate detected — please investigate</p>
          </div>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="unmapped">Unmapped ({unmapped.length})</TabsTrigger>
          <TabsTrigger value="b2c">Payouts ({b2c.length})</TabsTrigger>
          <TabsTrigger value="c2b">Deposits ({c2b.length})</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <AdminToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={
              tab === 'unmapped' ? 'Search bill ref or phone…' :
              tab === 'b2c' ? 'Search phone, receipt, status…' :
              'Search name, phone, trans ID…'
            }
            onExport={
              (tab === 'unmapped' ? filteredUnmapped : tab === 'b2c' ? filteredB2c : filteredC2b).length
                ? exportCurrent : undefined
            }
          />
        </div>

        <TabsContent value="unmapped" className="mt-4">
          {filteredUnmapped.length === 0 ? (
            <AdminEmptyState icon={CheckCircle2} title="All payments mapped" />
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-border">
                {filteredUnmapped.map((u) => {
                  const billDigits = String(u.bill_ref_number || '').replace(/\D/g, '');
                  const billIsPhone = /^(254|0)?[17]\d{8}$/.test(billDigits);
                  const phoneDisplay = billIsPhone ? billDigits : 'Phone hidden by Safaricom';
                  return (
                    <div key={u.id} className="p-4 hover:bg-muted/60 transition-colors">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-foreground truncate">{u.bill_ref_number || '—'}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {phoneDisplay}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {u.created_at ? format(new Date(u.created_at), 'MMM d, HH:mm') : ''}
                          </p>
                        </div>
                        <p className="font-bold text-foreground tabular-nums shrink-0 whitespace-nowrap">
                          KES {Number(u.amount).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 w-full sm:w-auto sm:ml-auto sm:flex"
                        onClick={() => setReconciling(u)}
                      >
                        <Link2 size={12} /> Reconcile
                      </Button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="b2c" className="mt-4">
          {filteredB2c.length === 0 ? (
            <AdminEmptyState icon={Send} title="No payouts" />
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-border">
                {filteredB2c.map((r) => (
                  <div key={r.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/60 transition-colors">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{r.phone}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.mpesa_receipt || r.result_desc || '—'}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-foreground tabular-nums">KES {Number(r.amount).toLocaleString()}</p>
                        <Badge
                          variant={r.status === 'completed' ? 'secondary' : r.status === 'failed' ? 'destructive' : 'outline'}
                          className="text-[10px] mt-1"
                        >
                          {r.status}
                        </Badge>
                      </div>
                      {r.status === 'failed' && (
                        <Button size="sm" variant="outline" onClick={() => retryB2c(r)} className="gap-1.5">
                          <RefreshCw size={12} /> Retry
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="c2b" className="mt-4">
          {filteredC2b.length === 0 ? (
            <AdminEmptyState icon={ArrowDownLeft} title="No deposits" />
          ) : (
            <Card className="overflow-hidden">
              <div className="divide-y divide-border">
                {filteredC2b.map((t) => {
                  const billDigits = String(t.bill_ref_number || '').replace(/\D/g, '');
                  const billIsPhone = /^(254|0)?[17]\d{8}$/.test(billDigits);
                  const phoneDisplay = billIsPhone ? billDigits : (t.bill_ref_number || '—');
                  return (
                    <div key={t.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/60 transition-colors">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground truncate">{`${t.first_name || ''} ${t.last_name || ''}`.trim() || '—'}</p>
                        <p className="text-xs text-muted-foreground truncate">{phoneDisplay} · {t.trans_id || '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-foreground tabular-nums">KES {Number(t.trans_amount).toLocaleString()}</p>
                        <Badge variant={t.processed ? 'secondary' : 'outline'} className="text-[10px] mt-1">
                          {t.processed ? 'Processed' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {reconciling && (
        <AdminReconcileDialog
          payment={reconciling}
          onClose={() => setReconciling(null)}
          onResolved={load}
        />
      )}
    </div>
  );
}
