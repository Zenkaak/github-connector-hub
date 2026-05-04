import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Loader2, Search, Plus } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminCreateChamaDialog } from './AdminCreateChamaDialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function AdminChamasModule() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('chama_groups')
        .select('id, name, contribution_amount, contribution_frequency, is_public, created_at, max_members, profile_image_url')
        .order('created_at', { ascending: false });
      const ids = (data || []).map((g) => g.id);
      const { data: members } = await supabase.from('chama_members').select('group_id, id').in('group_id', ids);
      const counts = new Map<string, number>();
      (members || []).forEach((m: any) => counts.set(m.group_id, (counts.get(m.group_id) || 0) + 1));
      const { data: savings } = await supabase.from('chama_savings').select('group_id, amount').in('group_id', ids);
      const totals = new Map<string, number>();
      (savings || []).forEach((s: any) => totals.set(s.group_id, (totals.get(s.group_id) || 0) + Number(s.amount)));
      setGroups((data || []).map((g) => ({ ...g, member_count: counts.get(g.id) || 0, total_savings: totals.get(g.id) || 0 })));
      setLoading(false);
  };

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('chama_groups')
        .select('id, name, contribution_amount, contribution_frequency, is_public, created_at, max_members, profile_image_url')
        .order('created_at', { ascending: false });
      const ids = (data || []).map((g) => g.id);
      const { data: members } = await supabase.from('chama_members').select('group_id, id').in('group_id', ids);
      const counts = new Map<string, number>();
      (members || []).forEach((m: any) => counts.set(m.group_id, (counts.get(m.group_id) || 0) + 1));
      const { data: savings } = await supabase.from('chama_savings').select('group_id, amount').in('group_id', ids);
      const totals = new Map<string, number>();
      (savings || []).forEach((s: any) => totals.set(s.group_id, (totals.get(s.group_id) || 0) + Number(s.amount)));
      setGroups((data || []).map((g) => ({ ...g, member_count: counts.get(g.id) || 0, total_savings: totals.get(g.id) || 0 })));
      setLoading(false);
    })();
  }, []);

  const filtered = groups.filter((g) => !search || g.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Chama Groups" description={`${groups.length} groups`} icon={Users} />
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search groups…" className="pl-9" />
      </div>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div> :
       filtered.length === 0 ? <AdminEmptyState icon={Users} title="No groups" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((g) => (
            <Card key={g.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center font-bold shrink-0">
                  {g.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {g.member_count}/{g.max_members || '∞'} members • KES {Number(g.contribution_amount).toLocaleString()} {g.contribution_frequency}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant={g.is_public ? 'secondary' : 'outline'} className="text-[10px]">{g.is_public ? 'Public' : 'Private'}</Badge>
                    <span className="text-xs font-bold">KES {g.total_savings.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{format(new Date(g.created_at), 'MMM d')}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
