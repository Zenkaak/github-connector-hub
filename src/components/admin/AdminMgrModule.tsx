import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminKpiCard } from './AdminKpiCard';
import { AdminToolbar, exportToCsv } from './AdminToolbar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

type CycleFilter = 'all' | 'open' | 'completed';

export function AdminMgrModule() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CycleFilter>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('chama_mgr_cycles')
        .select('*')
        .order('created_at', { ascending: false }).limit(200);
      const groupIds = [...new Set((data || []).map((c) => c.group_id))];
      const { data: groups } = await supabase.from('chama_groups').select('id, name').in('id', groupIds);
      const gmap = new Map((groups || []).map((g: any) => [g.id, g.name]));
      const cycleIds = (data || []).map((c) => c.id);
      const { data: contribs } = await supabase.from('chama_mgr_contributions').select('cycle_id, amount').in('cycle_id', cycleIds);
      const totals = new Map<string, number>();
      (contribs || []).forEach((c: any) => totals.set(c.cycle_id, (totals.get(c.cycle_id) || 0) + Number(c.amount)));
      setCycles((data || []).map((c) => ({ ...c, group_name: gmap.get(c.group_id), collected: totals.get(c.id) || 0 })));
      setLoading(false);
    })();
  }, []);

  const counts = useMemo(() => ({
    all: cycles.length,
    open: cycles.filter((c) => c.status === 'open').length,
    completed: cycles.filter((c) => c.status === 'completed').length,
  }), [cycles]);

  const filtered = useMemo(() => cycles.filter((c) => {
    if (filter !== 'all' && c.status !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.group_name?.toLowerCase().includes(q) || c.recipient_name?.toLowerCase().includes(q);
  }), [cycles, filter, search]);

  const handleExport = () => {
    exportToCsv(`mgr-cycles-${format(new Date(), 'yyyy-MM-dd')}`, filtered, [
      { header: 'Group',         get: (c) => c.group_name || '' },
      { header: 'Cycle #',       get: (c) => c.cycle_number },
      { header: 'Recipient',     get: (c) => c.recipient_name || '' },
      { header: 'Contribution',  get: (c) => Number(c.contribution_amount || 0) },
      { header: 'Collected',     get: (c) => Number(c.collected || 0) },
      { header: 'Status',        get: (c) => c.status },
      { header: 'Deadline',      get: (c) => format(new Date(c.deadline), 'yyyy-MM-dd HH:mm') },
    ]);
  };

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Merry-Go-Round Cycles" description="Track payouts and contributions across all chamas" icon={Activity} />

      <div className="grid grid-cols-3 gap-3">
        <AdminKpiCard label="Total cycles" value={counts.all.toLocaleString()} icon={Activity} accent="blue" />
        <AdminKpiCard label="Open" value={counts.open.toLocaleString()} icon={Clock} accent="gold" />
        <AdminKpiCard label="Completed" value={counts.completed.toLocaleString()} icon={CheckCircle2} accent="emerald" />
      </div>

      <AdminToolbar<CycleFilter>
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search group or recipient…"
        filters={[
          { key: 'all',       label: 'All',       count: counts.all },
          { key: 'open',      label: 'Open',      count: counts.open },
          { key: 'completed', label: 'Completed', count: counts.completed },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
        onExport={filtered.length ? handleExport : undefined}
      />

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div> :
       filtered.length === 0 ? <AdminEmptyState icon={Activity} title="No MGR cycles" /> : (
        <Card className="divide-y divide-border">
          {filtered.map((c) => {
            const target = Number(c.contribution_amount || 0);
            const pct = target > 0 ? Math.min(100, (c.collected / target) * 100) : 0;
            return (
              <div key={c.id} className="p-4 hover:bg-muted/60 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{c.group_name} · Cycle #{c.cycle_number}</p>
                    <p className="text-xs text-muted-foreground truncate">Recipient: {c.recipient_name || '—'}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Deadline {format(new Date(c.deadline), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold tabular-nums text-foreground">KES {Number(c.collected).toLocaleString()} / {target.toLocaleString()}</p>
                    <Badge variant={c.status === 'completed' ? 'secondary' : c.status === 'open' ? 'outline' : 'destructive'} className="text-[10px] mt-1">
                      {c.status}
                    </Badge>
                  </div>
                </div>
                <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct >= 100 ? 'bg-emerald-500' : 'bg-accent'} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
