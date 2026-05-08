import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PiggyBank, Loader2, Check, X as XIcon, Clock, Banknote, CheckCircle2, XCircle } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminKpiCard } from './AdminKpiCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function AdminWithdrawalsModule() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
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
      .order('created_at', { ascending: false }).limit(100);
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

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Chama Withdrawals" description="Review withdrawal requests" icon={PiggyBank} />
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div> :
       items.length === 0 ? <AdminEmptyState icon={PiggyBank} title={`No ${filter} withdrawals`} /> : (
        <Card className="divide-y divide-border">
          {items.map((w) => (
            <button key={w.id} onClick={() => { setSelected(w); setReason(w.admin_reason || ''); }} className="w-full p-4 hover:bg-muted/40 text-left flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{w.group_name}</p>
                <p className="text-xs text-muted-foreground truncate">{w.reason || 'No reason'}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold tabular-nums">KES {Number(w.amount).toLocaleString()}</p>
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
