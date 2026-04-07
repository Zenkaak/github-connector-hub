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
      const { data: memberships } = await supabase.from('chama_members').select('group_id').eq('user_id', user.id);
      if (memberships) setMyMemberships(memberships.map(m => m.group_id));

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
      await supabase.from('chama_join_requests').delete().eq('id', requestId);
      toast({ title: "Status Reset", description: "You can now request again." });
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
      toast({ title: 'STK Push Sent', description: 'Complete payment on your phone.' });
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
        {/* RESTORED HEADER SECTION */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900">Chama Groups</h1>
            <p className="text-sm text-slate-500 font-medium">Browse available groups or create your own</p>
          </div>
          <Button 
            onClick={() => navigate('/dashboard/chama/create')} 
            className="bg-primary hover:bg-primary/90 text-white font-bold px-6 h-11 rounded-xl shadow-lg shadow-primary/20 gap-2"
          >
            <Plus size={18} /> Create New Group
          </Button>
        </div>

        {/* SEARCH SECTION */}
        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            placeholder="Search by name or description..." 
            className="pl-12 h-12 bg-white border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/20" 
          />
        </div>

        {/* GROUPS LIST */}
        <div className="space-y-4">
          {loading ? (
            [1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-2xl" />)
          ) : filteredGroups.length === 0 ? (
            <Card className="p-16 text-center border-2 border-dashed border-slate-200 bg-transparent">
               <Users size={48} className="mx-auto text-slate-200 mb-4" />
               <p className="text-slate-400 font-bold uppercase text-sm tracking-widest">No groups found</p>
            </Card>
          ) : (
            filteredGroups.map(group => {
              const isMember = myMemberships.includes(group.id);
              const request = getRequest(group.id);

              return (
                <Card 
                  key={group.id} 
                  className="p-5 hover:border-primary/40 transition-all cursor-pointer shadow-sm border-slate-100 group bg-white rounded-2xl" 
                  onClick={() => setSelectedGroup(group)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors border border-slate-100">
                        <Users className="text-slate-400 group-hover:text-primary" size={24} />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-900 text-lg leading-tight">{group.name}</h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-500 font-black uppercase tracking-wider">
                          <span className="flex items-center gap-1.5"><Users size={12} className="text-slate-300" /> {group.member_count} Members</span>
                          <span className="flex items-center gap-1.5"><DollarSign size={12} className="text-slate-300" /> KES {group.contribution_amount}</span>
                          <span className="flex items-center gap-1.5"><Clock size={12} className="text-slate-300" /> {FREQUENCY_LABELS[group.contribution_frequency]}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 ml-4">
                      {isMember ? (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-[10px] font-black uppercase tracking-tighter">Member</span>
                      ) : request?.status === 'pending' ? (
                        <span className="px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-600 text-[10px] font-black uppercase tracking-tighter">Pending</span>
                      ) : request?.status === 'approved' ? (
                        <span className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-[10px] font-black uppercase italic animate-pulse">Pay Fee</span>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:bg-primary group-hover:text-white transition-all">
                          <ChevronRight size={20} />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* DETAIL DIALOG */}
      <Dialog open={!!selectedGroup} onOpenChange={() => setSelectedGroup(null)}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
          {selectedGroup && (
            <>
              <div className="bg-slate-900 p-8 text-white relative">
                <DialogTitle className="text-3xl font-black uppercase tracking-tighter">{selectedGroup.name}</DialogTitle>
                <p className="text-slate-400 text-sm mt-2 font-medium leading-relaxed">{selectedGroup.description || 'A community for collective growth.'}</p>
              </div>

              <div className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Savings Plan</p>
                    <p className="font-black text-slate-900">KES {selectedGroup.contribution_amount} / {FREQUENCY_LABELS[selectedGroup.contribution_frequency]}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Joining Fee</p>
                    <p className="font-black text-slate-900">KES {selectedGroup.joining_fee || 0}</p>
                  </div>
                </div>

                {selectedGroup.terms && (
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Rules & Terms</Label>
                    <ScrollArea className="h-40 rounded-2xl border border-slate-100 p-5 bg-slate-50/50">
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-medium">{selectedGroup.terms}</p>
                    </ScrollArea>
                  </div>
                )}

                <div className="pt-2">
                  {myMemberships.includes(selectedGroup.id) ? (
                    <Button className="w-full h-14 bg-emerald-600 text-white font-black uppercase rounded-2xl" disabled>
                      <CheckCircle2 className="mr-2" size={20} /> Already a Member
                    </Button>
                  ) : getRequest(selectedGroup.id)?.status === 'approved' ? (
                    <div className="space-y-4 p-5 bg-blue-50 rounded-3xl border border-blue-100 shadow-inner">
                      <div className="flex items-center gap-3 text-blue-700">
                        <CheckCircle2 size={22} />
                        <p className="text-sm font-black uppercase italic tracking-tight">Approved! Complete Joining</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">M-Pesa Number</Label>
                        <Input 
                          value={payPhone} 
                          onChange={e => setPayPhone(e.target.value)} 
                          className="h-12 bg-white rounded-xl border-blue-200 focus:ring-blue-500" 
                        />
                      </div>
                      <Button 
                        onClick={() => handlePayJoiningFee(selectedGroup)} 
                        disabled={payingFee} 
                        className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-200 gap-2"
                      >
                        {payingFee ? <Loader2 className="animate-spin" /> : <><Send size={18} /> Pay KES {selectedGroup.joining_fee} Now</>}
                      </Button>
                    </div>
                  ) : getRequest(selectedGroup.id)?.status === 'pending' ? (
                    <div className="p-6 bg-yellow-50 border border-yellow-100 rounded-3xl text-center space-y-2">
                      <Clock className="mx-auto text-yellow-500 animate-pulse" size={28} />
                      <p className="text-xs font-black uppercase text-yellow-700 tracking-widest">Request Pending</p>
                      <p className="text-[10px] text-yellow-600 font-bold italic">Reviewing your application...</p>
                    </div>
                  ) : getRequest(selectedGroup.id)?.status === 'rejected' ? (
                    <div className="space-y-4">
                      <div className="p-6 bg-destructive/5 rounded-3xl border border-destructive/10 text-center">
                        <AlertCircle className="mx-auto text-destructive mb-2" size={24} />
                        <p className="text-xs font-black uppercase text-destructive tracking-widest">Declined</p>
                        <p className="text-[10px] text-slate-500 mt-2 italic font-medium">"{getRequest(selectedGroup.id)?.reject_reason || 'Does not meet criteria.'}"</p>
                      </div>
                      <Button onClick={() => handleReapply(getRequest(selectedGroup.id).id)} disabled={requesting} className="w-full h-12 variant-outline border-slate-200 text-slate-600 font-black uppercase text-[10px] rounded-2xl gap-2">
                        <RefreshCcw size={14} /> Reset & Reapply
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={() => handleRequestJoin(selectedGroup.id)} 
                      disabled={requesting} 
                      className="w-full h-16 bg-slate-900 hover:bg-black text-white font-black uppercase tracking-widest rounded-2xl shadow-xl transition-all active:scale-[0.98]"
                    >
                      {requesting ? <Loader2 className="animate-spin" /> : "Request to Join Group"}
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
 
