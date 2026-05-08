import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Send, Loader2, Search, ArrowRight, TrendingUp, CheckCircle2, XCircle, Wallet } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminKpiCard } from './AdminKpiCard';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function AdminTransfersModule() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('wallet_transfers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      setTransfers(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = transfers.filter((t) => {
    const q = search.toLowerCase();
    return !q || t.sender_name?.toLowerCase().includes(q) || t.receiver_name?.toLowerCase().includes(q) ||
      t.sender_number?.includes(q) || t.recipient_number?.includes(q);
  });

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    let totalToday = 0, completed = 0, failed = 0, total7d = 0;
    const sevenDaysAgo = Date.now() - 7 * 86400e3;
    transfers.forEach((t) => {
      const ts = new Date(t.created_at).getTime();
      if (t.status === 'completed') {
        completed += 1;
        if (new Date(t.created_at).toDateString() === today) totalToday += Number(t.amount || 0);
        if (ts >= sevenDaysAgo) total7d += Number(t.amount || 0);
      }
      if (t.status === 'failed' || t.status === 'cancelled') failed += 1;
    });
    return { totalToday, completed, failed, total7d };
  }, [transfers]);

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Wallet Transfers" description={`${transfers.length} transfers tracked`} icon={Send} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpiCard label="Volume today" value={`KES ${Math.round(stats.totalToday).toLocaleString()}`} icon={Wallet} accent="gold" />
        <AdminKpiCard label="Volume (7d)" value={`KES ${Math.round(stats.total7d).toLocaleString()}`} icon={TrendingUp} accent="emerald" />
        <AdminKpiCard label="Completed" value={stats.completed.toLocaleString()} icon={CheckCircle2} accent="blue" />
        <AdminKpiCard label="Failed / cancelled" value={stats.failed.toLocaleString()} icon={XCircle} accent="red" />
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone…" className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState icon={Send} title="No transfers found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((t) => (
              <div key={t.id} className="p-4 hover:bg-muted/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold truncate">{t.sender_name || 'Sender'}</span>
                      <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                      <span className="font-semibold truncate">{t.receiver_name || 'Receiver'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.sender_number || '—'} → {t.recipient_number || '—'}
                    </p>
                    {t.reason && <p className="text-xs text-muted-foreground mt-0.5 italic">"{t.reason}"</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-foreground tabular-nums">KES {Number(t.amount).toLocaleString()}</p>
                    <Badge variant={t.status === 'completed' ? 'secondary' : t.status === 'cancelled' ? 'destructive' : 'outline'} className="text-[10px] mt-1">
                      {t.status}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(t.created_at), 'MMM d, HH:mm')}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
