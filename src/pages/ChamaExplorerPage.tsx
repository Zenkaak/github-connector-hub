import { useState, useEffect } from 'react';
import { Search, Users, DollarSign, Clock, ChevronRight, ShieldCheck, Send, Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const FREQUENCY_LABELS: Record<string, string> = {
  every_2_hours: 'Every 2 Hours',
  daily: 'Daily',
  every_2_days: 'Every 2 Days',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export default function ChamaExplorerPage() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [myMemberships, setMyMemberships] = useState<string[]>([]);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [requesting, setRequesting] = useState(false);
  const [payingFee, setPayingFee] = useState(false);
  const [payPhone, setPayPhone] = useState('');

  const fetchGroups = async () => {
    const { data: allGroups } = await supabase.from('chama_groups').select('*').order('created_at', { ascending: false });

    if (allGroups) {
      const enriched = await Promise.all(
        allGroups.map(async g => {
          const { data: countData } = await supabase.rpc('get_active_chama_member_count', { _group_id: g.id });
          return { ...g, member_count: countData || 0 };
        })
      );
      setGroups(enriched);
    }

    if (user) {
      const { data: memberships } = await supabase.from('chama_members').select('group_id').eq('user_id', user.id).or('is_active.eq.true,is_active.is.null');
      if (memberships) setMyMemberships(memberships.map(m => m.group_id));

      const { data: requests } = await supabase.from('chama_join_requests').select('*').eq('user_id', user.id);
      if (requests) setMyRequests(requests);
    }

    setLoading(false);
  };

  useEffect(() => { fetchGroups(); }, [user]);

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleRequestJoin = async (groupId: string) => {
    if (!user) return;

    if (myMemberships.length >= 3) {
      toast({ title: 'Limit Reached', description: 'You can only join a maximum of 3 Chama groups.', variant: 'destructive' });
      return;
    }

    setRequesting(true);
    try {
      const { error } = await supabase.from('chama_join_requests').insert({
        group_id: groupId,
        user_id: user.id,
      } as any);
      if (error) throw error;

      const { data: leaders } = await supabase.from('chama_members').select('user_id, role').eq('group_id', groupId).in('role', ['chairperson', 'secretary', 'treasurer']);

      const { data: userProfile } = await supabase.from('profiles').select('full_name').eq('user_id', user.id).single();

      if (leaders) {
        await supabase.from('notifications').insert(
          leaders.map(l => ({
            user_id: l.user_id,
            title: 'New Join Request',
            message: `${userProfile?.full_name || 'A user'} has requested to join your group. Review in the Requests tab.`,
          }))
        );
      }

      toast({ title: 'Request Sent', description: 'Group officials have been notified of your request.' });
      setSelectedGroup(null);
      fetchGroups();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setRequesting(false);
    }
  };

  const handlePayJoiningFee = async (group: any) => {
    if (!user || !payPhone.trim()) return;
    setPayingFee(true);
    try {
      const phone = payPhone.trim();
      if (phone.length < 10) throw new Error('Enter a valid phone number');
      
      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone,
          amount: group.joining_fee,
          userId: user.id,
          purpose: 'chama_join',
          groupId: group.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: 'STK Push Sent', description: `Check your phone to pay KES ${group.joining_fee.toLocaleString()} joining fee.` });
      setSelectedGroup(null);
      setPayPhone('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setPayingFee(false);
    }
  };

  const getRequestStatus = (groupId: string) => {
    const req = myRequests.find(r => r.group_id === groupId);
    return req?.status;
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold">Explore Chama Groups</h1>
          <p className="text-sm text-muted-foreground mt-1">Browse and join available savings groups</p>
        </div>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search groups by name..."
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
          </div>
        ) : filteredGroups.length === 0 ? (
          <Card className="p-12 text-center">
            <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg mb-1">No Groups Found</h3>
            <p className="text-sm text-muted-foreground">Try a different search term</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredGroups.map(group => {
              const isMember = myMemberships.includes(group.id);
              const requestStatus = getRequestStatus(group.id);

              return (
                <Card
                  key={group.id}
                  className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => !isMember && setSelectedGroup(group)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Users size={22} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{group.name}</h3>
                        {group.description && <p className="text-xs text-muted-foreground line-clamp-1">{group.description}</p>}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users size={11} /> {group.member_count} members</span>
                          <span className="flex items-center gap-1"><DollarSign size={11} /> KES {group.savings_amount || 0} {FREQUENCY_LABELS[group.savings_frequency] || ''}</span>
                          {(group.joining_fee || 0) > 0 && <span className="flex items-center gap-1"><ShieldCheck size={11} /> Fee: KES {group.joining_fee}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isMember ? (
                        <span className="text-[11px] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">Joined</span>
                      ) : requestStatus === 'pending' ? (
                        <span className="text-[11px] px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 font-medium">Pending</span>
                      ) : requestStatus === 'approved' ? (
                        <span className="text-[11px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-500 font-medium">Pay Fee</span>
                      ) : (
                        <ChevronRight size={18} className="text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Group detail / join dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={() => { setSelectedGroup(null); setPayPhone(''); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selectedGroup?.name}</DialogTitle></DialogHeader>
          {selectedGroup && (
            <div className="space-y-4">
              {selectedGroup.description && (
                <p className="text-sm text-muted-foreground">{selectedGroup.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Card className="p-3">
                  <p className="text-[11px] text-muted-foreground">Members</p>
                  <p className="font-bold">{selectedGroup.member_count}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-[11px] text-muted-foreground">Savings</p>
                  <p className="font-bold">KES {selectedGroup.savings_amount || 0} {FREQUENCY_LABELS[selectedGroup.savings_frequency] || ''}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-[11px] text-muted-foreground">Joining Fee</p>
                  <p className="font-bold">{selectedGroup.joining_fee > 0 ? `KES ${selectedGroup.joining_fee}` : 'Free'}</p>
                </Card>
                <Card className="p-3">
                  <p className="text-[11px] text-muted-foreground">Refund Policy</p>
                  <p className="font-bold text-xs">
                    {selectedGroup.refund_policy === 'no_refund' ? 'No Refund' : selectedGroup.refund_policy === 'full_refund' ? 'Full Refund' : `${selectedGroup.refund_percentage}%`}
                  </p>
                </Card>
              </div>

              {selectedGroup.terms_and_conditions && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Terms & Conditions</h4>
                  <ScrollArea className="h-[200px] rounded border p-3">
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{selectedGroup.terms_and_conditions}</p>
                  </ScrollArea>
                </div>
              )}

              {getRequestStatus(selectedGroup.id) === 'approved' && selectedGroup.joining_fee > 0 ? (
                /* Approved but needs to pay joining fee */
                <div className="space-y-3">
                  <Card className="p-4 bg-blue-500/5 border-blue-500/20">
                    <p className="text-sm font-semibold text-blue-600">✅ Your request has been approved!</p>
                    <p className="text-xs text-muted-foreground mt-1">Pay the joining fee of KES {selectedGroup.joining_fee.toLocaleString()} to complete your registration.</p>
                  </Card>
                  <div>
                    <Label>M-Pesa Phone Number</Label>
                    <Input
                      value={payPhone}
                      onChange={e => setPayPhone(e.target.value)}
                      placeholder="0712345678"
                      className="mt-1"
                      defaultValue={profile?.phone || ''}
                    />
                  </div>
                  <Button
                    onClick={() => handlePayJoiningFee(selectedGroup)}
                    disabled={payingFee || !payPhone.trim()}
                    className="w-full gap-2"
                  >
                    {payingFee ? (
                      <><Loader2 size={14} className="animate-spin" /> Processing...</>
                    ) : (
                      <><Send size={14} /> Pay KES {selectedGroup.joining_fee.toLocaleString()} Joining Fee</>
                    )}
                  </Button>
                </div>
              ) : getRequestStatus(selectedGroup.id) === 'pending' ? (
                <Card className="p-3 bg-yellow-500/5 border-yellow-500/20 text-center">
                  <p className="text-sm text-yellow-600">Your join request is pending review</p>
                </Card>
              ) : getRequestStatus(selectedGroup.id) === 'rejected' ? (
                <Card className="p-3 bg-destructive/5 border-destructive/20 text-center">
                  <p className="text-sm text-destructive">Your request was rejected</p>
                </Card>
              ) : (
                <Button onClick={() => handleRequestJoin(selectedGroup.id)} disabled={requesting} className="w-full">
                  {requesting ? 'Sending Request...' : 'Request to Join'}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
