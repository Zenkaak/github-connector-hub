import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Send, Loader2, ArrowRight, TrendingUp, CheckCircle2, XCircle, Wallet } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminKpiCard } from './AdminKpiCard';
import { AdminToolbar, exportToCsv } from './AdminToolbar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type StatusFilter = 'all' | 'completed' | 'pending' | 'failed';

export function AdminTransfersModule() {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('wallet_transfers')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      setTransfers(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => transfers.filter((t) => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.sender_name?.toLowerCase().includes(q) || t.receiver_name?.toLowerCase().includes(q) ||
      t.sender_number?.includes(search) || t.recipient_number?.includes(search);
    if (!matchSearch) return false;
    if (filter === 'all') return true;
    if (filter === 'failed') return t.status === 'failed' || t.status === 'cancelled';
    return t.status === filter;
  }), [transfers, search, filter]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    let totalToday = 0, completed = 0, failed = 0, total7d = 0, pending = 0;
    const sevenDaysAgo = Date.now() - 7 * 86400e3;
    transfers.forEach((t) => {
      const ts = new Date(t.created_at).getTime();
      if (t.status === 'completed') {
        completed += 1;
        if (new Date(t.created_at).toDateString() === today) totalToday += Number(t.amount || 0);
        if (ts >= sevenDaysAgo) total7d += Number(t.amount || 0);
      }
      if (t.status === 'pending') pending += 1;
      if (t.status === 'failed' || t.status === 'cancelled') failed += 1;
    });
    return { totalToday, completed, failed, total7d, pending };
  }, [transfers]);

  const handleExport = () => {
    exportToCsv(`transfers-${format(new Date(), 'yyyy-MM-dd')}`, filtered, [
      { header: 'Sender',    get: (t) => t.sender_name || '' },
      { header: 'From',      get: (t) => t.sender_number || '' },
      { header: 'Receiver',  get: (t) => t.receiver_name || '' },
      { header: 'To',        get: (t) => t.recipient_number || '' },
      { header: 'Amount',    get: (t) => Number(t.amount || 0) },
      { header: 'Status',    get: (t) => t.status },
      { header: 'Reason',    get: (t) => t.reason || '' },
      { header: 'Date',      get: (t) => format(new Date(t.created_at), 'yyyy-MM-dd HH:mm') },
    ]);
  };

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Wallet Transfers" description={`${transfers.length} transfers tracked`} icon={Send} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpiCard label="Volume today" value={`KES ${Math.round(stats.totalToday).toLocaleString()}`} icon={Wallet} accent="gold" />
        <AdminKpiCard label="Volume (7d)" value={`KES ${Math.round(stats.total7d).toLocaleString()}`} icon={TrendingUp} accent="emerald" />
        <AdminKpiCard label="Completed" value={stats.completed.toLocaleString()} icon={CheckCircle2} accent="blue" />
        <AdminKpiCard label="Failed / cancelled" value={stats.failed.toLocaleString()} icon={XCircle} accent="red" />
      </div>

      <AdminToolbar<StatusFilter>
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or phone…"
        filters={[
          { key: 'all',       label: 'All',       count: transfers.length },
          { key: 'completed', label: 'Completed', count: stats.completed },
          { key: 'pending',   label: 'Pending',   count: stats.pending },
          { key: 'failed',    label: 'Failed',    count: stats.failed },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
        onExport={filtered.length ? handleExport : undefined}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState icon={Send} title="No transfers found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((t) => (
              <div key={t.id} className="p-4 hover:bg-muted/60 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold truncate text-foreground">{t.sender_name || 'Sender'}</span>
                      <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                      <span className="font-semibold truncate text-foreground">{t.receiver_name || 'Receiver'}</span>
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
