import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PiggyBank, Loader2, Check, X as XIcon, Clock, Banknote, CheckCircle2, XCircle } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminKpiCard } from './AdminKpiCard';
import { AdminToolbar, exportToCsv } from './AdminToolbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';

type WStatus = 'pending' | 'approved' | 'rejected';

export function AdminWithdrawalsModule() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WStatus>('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [acting, setActing] = useState(false);
  const [stats, setStats] = useState({ pending: 0, pendingValue: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    (async () => {
      const [p, a, r] = await Promise.all([
        supabase.from('chama_withdrawals').select('amount').eq('status', 'pending'),
        supabase.from('chama_withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('chama_withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);
      const pendingValue = (p.data || []).reduce((s, x: any) => s + Number(x.amount || 0), 0);
      setStats({ pending: p.data?.length || 0, pendingValue, approved: a.count || 0, rejected: r.count || 0 });
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('chama_withdrawals')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false }).limit(200);
    const groupIds = [...new Set((data || []).map((w) => w.group_id))];
    const { data: groups } = await supabase.from('chama_groups').select('id, name').in('id', groupIds);
    const gmap = new Map((groups || []).map((g: any) => [g.id, g.name]));
    setItems((data || []).map((w) => ({ ...w, group_name: gmap.get(w.group_id) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const decide = async (status: 'approved' | 'rejected') => {
    if (!selected) return;
    setActing(true);
    const { error } = await supabase.from('chama_withdrawals').update({
      status, admin_reason: reason,
    }).eq('id', selected.id);
    if (error) toast.error(error.message);
    else { toast.success(`Withdrawal ${status}`); setSelected(null); setReason(''); load(); }
    setActing(false);
  };

  const filtered = items.filter((w) =>
    !search || w.group_name?.toLowerCase().includes(search.toLowerCase()) || w.reason?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    exportToCsv(`withdrawals-${filter}-${format(new Date(), 'yyyy-MM-dd')}`, filtered, [
      { header: 'Group',  get: (w) => w.group_name || '' },
      { header: 'Amount', get: (w) => Number(w.amount || 0) },
      { header: 'Reason', get: (w) => w.reason || '' },
      { header: 'Status', get: (w) => w.status },
      { header: 'Date',   get: (w) => format(new Date(w.created_at), 'yyyy-MM-dd HH:mm') },
    ]);
  };

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Chama Withdrawals" description="Review withdrawal requests" icon={PiggyBank} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpiCard label="Pending" value={stats.pending.toLocaleString()} icon={Clock} accent="gold" />
        <AdminKpiCard label="Pending value" value={`KES ${Math.round(stats.pendingValue).toLocaleString()}`} icon={Banknote} accent="blue" />
        <AdminKpiCard label="Approved" value={stats.approved.toLocaleString()} icon={CheckCircle2} accent="emerald" />
        <AdminKpiCard label="Rejected" value={stats.rejected.toLocaleString()} icon={XCircle} accent="red" />
      </div>

      <AdminToolbar<WStatus>
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search group or reason…"
        filters={[
          { key: 'pending',  label: 'Pending',  count: stats.pending },
          { key: 'approved', label: 'Approved', count: stats.approved },
          { key: 'rejected', label: 'Rejected', count: stats.rejected },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
        onExport={filtered.length ? handleExport : undefined}
      />

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div> :
       filtered.length === 0 ? <AdminEmptyState icon={PiggyBank} title={search ? 'No matches' : `No ${filter} withdrawals`} /> : (
        <Card className="divide-y divide-border">
          {filtered.map((w) => (
            <button key={w.id} onClick={() => { setSelected(w); setReason(w.admin_reason || ''); }} className="w-full p-4 hover:bg-muted/60 text-left flex items-center gap-3 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{w.group_name}</p>
                <p className="text-xs text-muted-foreground truncate">{w.reason || 'No reason'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold tabular-nums text-foreground">KES {Number(w.amount).toLocaleString()}</p>
                <Badge variant="outline" className="text-[10px] mt-1">{w.status}</Badge>
                <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(w.created_at), 'MMM d')}</p>
              </div>
            </button>
          ))}
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.group_name}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div><strong>Amount:</strong> KES {Number(selected.amount).toLocaleString()}</div>
                <div><strong>Reason:</strong> {selected.reason || '—'}</div>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Admin decision reason…" rows={3} />
              </div>
              {filter === 'pending' && (
                <DialogFooter>
                  <Button variant="destructive" onClick={() => decide('rejected')} disabled={acting}><XIcon size={14} /> Reject</Button>
                  <Button variant="success" onClick={() => decide('approved')} disabled={acting}><Check size={14} /> Approve</Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
