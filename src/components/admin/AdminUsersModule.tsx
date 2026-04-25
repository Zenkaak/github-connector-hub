import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, Shield, Ban, CheckCircle2, MessageSquare, Loader2, X } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function AdminUsersModule() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, user_id, full_name, email, phone, is_active, is_verified, is_admin, disable_reason, created_at, county')
      .order('created_at', { ascending: false })
      .limit(200);
    // load wallets
    const userIds = (data || []).map((u) => u.user_id);
    const { data: wallets } = await supabase.from('wallets').select('user_id, balance').in('user_id', userIds);
    const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, Number(w.balance || 0)]));
    setUsers((data || []).map((u) => ({ ...u, balance: walletMap.get(u.user_id) || 0 })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    return !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.phone?.includes(q);
  });

  const toggleActive = async (user: any) => {
    setActionLoading(true);
    const { error } = await supabase.from('profiles').update({
      is_active: !user.is_active,
      disable_reason: user.is_active ? 'Disabled by admin' : null,
    }).eq('user_id', user.user_id);
    if (error) toast.error(error.message);
    else { toast.success(user.is_active ? 'User disabled' : 'User enabled'); load(); setSelected(null); }
    setActionLoading(false);
  };

  const toggleVerified = async (user: any) => {
    setActionLoading(true);
    const { error } = await supabase.from('profiles').update({ is_verified: !user.is_verified }).eq('user_id', user.user_id);
    if (error) toast.error(error.message);
    else { toast.success('Updated'); load(); setSelected(null); }
    setActionLoading(false);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selected) return;
    setActionLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('admin_messages').insert({
      admin_id: user!.id, user_id: selected.user_id, message: messageText, type: 'admin_notice',
    });
    if (!error) {
      await supabase.from('notifications').insert({
        user_id: selected.user_id, title: 'Message from Admin', message: messageText, type: 'admin_message',
      });
      toast.success('Message sent');
      setMessageOpen(false); setMessageText('');
    } else toast.error(error.message);
    setActionLoading(false);
  };

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Users" description={`${users.length} registered members`} icon={Users} />

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone…" className="pl-9" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState icon={Users} title="No users found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
                className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="h-10 w-10 rounded-full bg-accent/10 text-accent flex items-center justify-center font-semibold text-sm shrink-0">
                  {(u.full_name || 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground truncate">{u.full_name || 'Unnamed'}</p>
                    {u.is_admin && <Badge variant="default" className="text-[10px]">Admin</Badge>}
                    {u.is_verified && <Badge variant="secondary" className="text-[10px]">Verified</Badge>}
                    {!u.is_active && <Badge variant="destructive" className="text-[10px]">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{u.phone || '—'} • {u.email || '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground tabular-nums">KES {u.balance.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(u.created_at), 'MMM d')}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* User detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.full_name || 'Unnamed user'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Phone</p><p className="font-medium">{selected.phone || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Email</p><p className="font-medium truncate">{selected.email || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">County</p><p className="font-medium">{selected.county || '—'}</p></div>
                  <div><p className="text-xs text-muted-foreground">Wallet</p><p className="font-bold">KES {selected.balance.toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Joined</p><p className="font-medium">{format(new Date(selected.created_at), 'MMM d, yyyy')}</p></div>
                  <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">{selected.is_active ? 'Active' : 'Disabled'}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => toggleVerified(selected)} disabled={actionLoading}>
                    <CheckCircle2 size={14} /> {selected.is_verified ? 'Unverify' : 'Verify'}
                  </Button>
                  <Button variant={selected.is_active ? 'destructive' : 'success'} size="sm" onClick={() => toggleActive(selected)} disabled={actionLoading}>
                    {selected.is_active ? <><Ban size={14} /> Disable</> : <><CheckCircle2 size={14} /> Enable</>}
                  </Button>
                  <Button variant="outline" size="sm" className="col-span-2" onClick={() => setMessageOpen(true)}>
                    <MessageSquare size={14} /> Send Message
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Message {selected?.full_name}</DialogTitle></DialogHeader>
          <Textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type your message…" rows={5} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
            <Button onClick={sendMessage} disabled={actionLoading || !messageText.trim()}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
