import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Loader2 } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function AdminMgrModule() {
  const [cycles, setCycles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('chama_mgr_cycles')
        .select('*')
        .order('created_at', { ascending: false }).limit(100);
      const groupIds = [...new Set((data || []).map((c) => c.group_id))];
      const { data: groups } = await supabase.from('chama_groups').select('id, name').in('id', groupIds);
      const gmap = new Map((groups || []).map((g: any) => [g.id, g.name]));
      // Get contributions per cycle
      const cycleIds = (data || []).map((c) => c.id);
      const { data: contribs } = await supabase.from('chama_mgr_contributions').select('cycle_id, amount').in('cycle_id', cycleIds);
      const totals = new Map<string, number>();
      (contribs || []).forEach((c: any) => totals.set(c.cycle_id, (totals.get(c.cycle_id) || 0) + Number(c.amount)));
      setCycles((data || []).map((c) => ({ ...c, group_name: gmap.get(c.group_id), collected: totals.get(c.id) || 0 })));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Merry-Go-Round Cycles" description="Track payouts and contributions across all chamas" icon={Activity} />
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div> :
       cycles.length === 0 ? <AdminEmptyState icon={Activity} title="No MGR cycles yet" /> : (
        <Card className="divide-y divide-border">
          {cycles.map((c) => (
            <div key={c.id} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{c.group_name} • Cycle #{c.cycle_number}</p>
                  <p className="text-xs text-muted-foreground">Recipient: {c.recipient_name || '—'}</p>
                  <p className="text-xs text-muted-foreground">Deadline: {format(new Date(c.deadline), 'MMM d, yyyy HH:mm')}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold tabular-nums">KES {c.collected.toLocaleString()} / {Number(c.contribution_amount).toLocaleString()}</p>
                  <Badge variant={c.status === 'completed' ? 'secondary' : c.status === 'open' ? 'outline' : 'destructive'} className="text-[10px] mt-1">{c.status}</Badge>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
