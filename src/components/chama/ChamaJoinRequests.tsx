import { useState, useEffect } from 'react';
import { Search, Users, DollarSign, Clock, ChevronRight, ShieldCheck, Send, Loader2, CheckCircle2, AlertCircle, RefreshCcw, Plus } from 'lucide-react';
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
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();
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
      // Fetch active memberships
      const { data: memberships } = await supabase.from('chama_members').select('group_id').eq('user_id', user.id);
      if (memberships) setMyMemberships(memberships.map(m => m.group_id));

      // Fetch all join requests for this user
      const { data: requests } = await supabase.from('chama_join_requests').select('*').eq('user_id', user.id);
      if (requests) setMyRequests(requests);
    }

    setLoading(false);
  };

  useEffect(() => { 
    fetchGroups(); 
    if (profile?.phone) setPayPhone(profile.phone);
  }, [user, profile]);

  const filteredGroups = groups.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleRequestJoin = async (groupId: string) => {
    if (!user) return;
    setRequesting(true);
    try {
      const { error } = await supabase.from('chama_join_requests').insert({
        group_id: groupId,
        user_id: user.id,
        status: 'pending'
      });
      if (error) throw error;

      toast({ title: 'Request Sent', description: 'Group leaders have been notified.' });
      fetchGroups();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setRequesting(false);
    }
  };

  const handleReapply = async (requestId: string) => {
    setRequesting(true);
    try {
      // Delete the rejected request to fix unique constraint error
      await supabase.from('chama_join_requests').delete().eq('id', requestId);
      toast({ title: "Reset successful", description: "You can now request to join again." });
      fetchGroups();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setRequesting(false);
    }
  };

  const handlePayJoiningFee = async (group: any) => {
    if (!user || !payPhone.trim()) {
      toast({ title: "Phone Required", description: "Please enter your M-Pesa phone number.", variant: "destructive" });
      return;
    }
    
    setPayingFee(true);
    try {
      const { error } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone: payPhone.trim(),
          amount: group.joining_fee,
          userId: user.id,
          purpose: 'chama_joining_fee',
          groupId: group.id,
        },
      });

      if (error) throw error;

      toast({ 
        title: 'STK Push Sent', 
        description: `Please enter your PIN to pay KES ${group.joining_fee.toLocaleString()}.` 
      });
      
      setSelectedGroup(null);
    } catch (error: any) {
      toast({ title: 'Payment Error', description: error.message, variant: 'destructive' });
    } finally {
      setPayingFee(false);
    }
  };

  const getRequest = (groupId: string) => myRequests.find(r => r.group_id === groupId);

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        {/* RESTORED HEADER WITH CREATE BUTTON */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Explore Chama Groups</h1>
            <p className="text-sm text-slate-500 font-medium">Browse available groups or create your own</p>
          </div>
          <Button 
            onClick={() => navigate('/dashboard/chama/create')} 
            className="bg-primary hover:bg-primary/90 text-white font-bold px-6 h-11 rounded-xl shadow-lg shadow-primary/20 gap-2"
          >
            <Plus size={18} /> Create New Group
          </Button>
        </div>

        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search groups by name or description..." 
            className="pl-9 h-11 bg-white shadow-sm" 
          />
        </div>

        <div className="space-y-3">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)
          ) : filteredGroups.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
               <Users size={48} className="mx-auto text-slate-200 mb-4" />
               <p className="text-slate-500 font-medium">No groups match your search.</p>
            </Card>
          ) : (
            filteredGroups.map(group => {
              const isMember = myMemberships.includes(group.id);
              const request = getRequest(group.id);

              return (
                <Card 
                  key={group.id} 
                  className="p-4 hover:border-primary/50 transition-all cursor-pointer shadow-sm group bg-white border-slate-100" 
                  onClick={() => setSelectedGroup(group)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <Users className="text-slate-400 group-hover:text-primary" size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{group.name}</h3>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 font-black uppercase tracking-widest">
                          <span className="flex items-center gap-1"><Users size={10} /> {group.member_count} Members</span>
                          <span className="flex items-center gap-1"><Clock size={10} /> {FREQUENCY_LABELS[group.contribution_frequency]}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0">
                      {isMember ? (
                        <span className="text-[10px] px-2 py-1 rounded bg-emerald-50 text-emerald-600 font-black uppercase">Member</span>
                      ) : request?.status === 'pending' ? (
                        <span className="text-[10px] px-2 py-1 rounded bg-yellow-50 text-yellow-600 font-black uppercase">Pending</span>
                      ) : request?.status === 'approved' ? (
                        <span className="text-[10px] px-2 py-1 rounded bg-blue-600 text-white font-black uppercase italic animate-pulse">Pay Fee</span>
                      ) : (
                        <ChevronRight size={18} className="text-slate-300" />
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          {selectedGroup && (
            <>
              <div className="bg-slate-900 p-6 text-white">
                <DialogTitle className="text-2xl font-black uppercase tracking-tighter">{selectedGroup.name}</DialogTitle>
                <p className="text-slate-400 text-xs mt-1 font-medium">{selectedGroup.description || 'No description provided.'}</p>
              </div>

              <div className="p-6 space-y-6 bg-white">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Savings Plan</p>
                    <p className="font-bold text-slate-900">KES {selectedGroup.contribution_amount} / {FREQUENCY_LABELS[selectedGroup.contribution_frequency]}</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Joining Fee</p>
                    <p className="font-bold text-slate-900">KES {selectedGroup.joining_fee || 0}</p>
                  </div>
                </div>

                {selectedGroup.terms && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400">Terms & Conditions</Label>
                    <ScrollArea className="h-32 rounded-xl border p-4 bg-slate-50/50">
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{selectedGroup.terms}</p>
                    </ScrollArea>
                  </div>
                )}

                <div className="pt-2">
                  {myMemberships.includes(selectedGroup.id) ? (
                    <Button className="w-full h-12 bg-emerald-600 text-white font-black uppercase" disabled>
                      <CheckCircle2 className="mr-2" size={18} /> You are a member
                    </Button>
                  ) : getRequest(selectedGroup.id)?.status === 'approved' ? (
                    <div className="space-y-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="flex items-center gap-2 text-blue-700">
                        <CheckCircle2 size={18} />
                        <p className="text-sm font-black uppercase tracking-tight">Approved!</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-500">M-Pesa Phone</Label>
                        <Input 
                          value={payPhone} 
                          onChange={e => setPayPhone(e.target.value)} 
                          placeholder="07XXXXXXXX" 
                          className="h-12 bg-white border-blue-200" 
                        />
                      </div>
                      <Button 
                        onClick={() => handlePayJoiningFee(selectedGroup)} 
                        disabled={payingFee} 
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest shadow-lg shadow-blue-200 gap-2"
                      >
                        {payingFee ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Pay KES {selectedGroup.joining_fee}</>}
                      </Button>
                    </div>
                  ) : getRequest(selectedGroup.id)?.status === 'pending' ? (
                    <div className="p-5 bg-yellow-50 border border-yellow-100 rounded-2xl text-center space-y-2">
                      <Clock className="mx-auto text-yellow-500 animate-pulse" size={24} />
                      <p className="text-xs font-black uppercase text-yellow-700">Under Review</p>
                    </div>
                  ) : getRequest(selectedGroup.id)?.status === 'rejected' ? (
                    <div className="space-y-3">
                      <div className="p-5 bg-destructive/5 rounded-2xl border border-destructive/10 text-center">
                        <AlertCircle className="mx-auto text-destructive mb-2" />
                        <p className="text-xs font-black uppercase text-destructive">Declined</p>
                      </div>
                      <Button 
                        onClick={() => handleReapply(getRequest(selectedGroup.id).id)} 
                        disabled={requesting} 
                        className="w-full h-11 variant-outline text-[10px] font-bold uppercase gap-2"
                      >
                        <RefreshCcw size={14} /> Reapply
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => handleRequestJoin(selectedGroup.id)} 
                      disabled={requesting} 
                      className="w-full h-14 bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest shadow-xl"
                    >
                      {requesting ? <Loader2 className="animate-spin" /> : "Request to Join"}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
 
