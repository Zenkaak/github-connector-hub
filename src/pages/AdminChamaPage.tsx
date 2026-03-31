import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, PiggyBank, Crown, Search, Eye, ArrowDownLeft,
  Loader2, TrendingUp, Calendar, Wallet, ChevronDown, ChevronUp, HandCoins,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GroupDetail {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  contribution_frequency: string | null;
  contribution_amount: number | null;
  created_at: string;
}

export default function AdminChamaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<GroupDetail[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [savings, setSavings] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [harambees, setHarambees] = useState<any[]>([]);
  const [harambeeContributions, setHarambeeContributions] = useState<any[]>([]);
  const [joinRequests, setJoinRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Withdrawal review
  const [selectedWd, setSelectedWd] = useState<any | null>(null);
  const [wdAction, setWdAction] = useState('');
  const [wdReason, setWdReason] = useState('');
  const [wdFeeAmount, setWdFeeAmount] = useState('');
  const [wdLoading, setWdLoading] = useState(false);

  // Join request review
  const [selectedJr, setSelectedJr] = useState<any | null>(null);
  const [jrAction, setJrAction] = useState('');
  const [jrFeeAmount, setJrFeeAmount] = useState('');
  const [jrReason, setJrReason] = useState('');
  const [jrLoading, setJrLoading] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const [gRes, mRes, sRes, wRes, pRes, lRes, hRes, hcRes, jrRes] = await Promise.all([
      supabase.from('chama_groups').select('*').order('created_at', { ascending: false }),
      supabase.from('chama_members').select('*'),
      supabase.from('chama_savings').select('*').order('created_at', { ascending: false }),
      supabase.from('chama_withdrawals').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name, phone, email'),
      supabase.from('chama_leave_requests').select('*').eq('status', 'pending_admin').order('created_at', { ascending: false }),
      supabase.from('chama_harambees').select('*').order('created_at', { ascending: false }),
      supabase.from('chama_harambee_contributions').select('*').order('created_at', { ascending: false }),
      supabase.from('chama_join_requests').select('*').order('created_at', { ascending: false }),
    ]);
    if (gRes.data) setGroups(gRes.data);
    if (mRes.data) setMembers(mRes.data);
    if (sRes.data) setSavings(sRes.data);
    if (wRes.data) setWithdrawals(wRes.data);
    if (pRes.data) setProfiles(pRes.data);
    if (lRes.data) setLeaveRequests(lRes.data);
    if (hRes.data) setHarambees(hRes.data);
    if (hcRes.data) setHarambeeContributions(hcRes.data);
    if (jrRes.data) setJoinRequests(jrRes.data);
    setLoading(false);
  };

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || 'Unknown';
  const getPhone = (userId: string) => profiles.find(p => p.user_id === userId)?.phone || '';
  const formatCurrency = (n: number) => `KES ${n.toLocaleString()}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const totalSavings = savings.reduce((s, r) => s + r.amount, 0);
  const totalGroups = groups.length;
  const totalMembers = new Set(members.map(m => m.user_id)).size;
  const pendingWithdrawals = withdrawals.filter(w => w.status === 'approved_by_leaders').length;
  const activeHarambees = harambees.filter(h => h.status === 'active').length;
  const totalHarambeeCollected = harambees.reduce((s, h) => s + (h.collected_amount || 0), 0);

  const filteredGroups = groups.filter(g =>
    !search || g.name.toLowerCase().includes(search.toLowerCase())
  );

  const roleLabels: Record<string, string> = { chairperson: 'Chair', secretary: 'Sec', treasurer: 'Treas', member: 'Member' };
  const roleColors: Record<string, string> = {
    chairperson: 'bg-accent/10 text-accent',
    secretary: 'bg-blue-500/10 text-blue-500',
    treasurer: 'bg-emerald-500/10 text-emerald-500',
    member: 'bg-muted text-muted-foreground',
  };

  const handleWdAction = async () => {
    if (!selectedWd || !wdAction) return;
    setWdLoading(true);
    try {
      const group = groups.find(g => g.id === selectedWd.group_id);
      const groupMems = members.filter(m => m.group_id === selectedWd.group_id);
      const leaders = groupMems.filter(m => ['chairperson', 'secretary', 'treasurer'].includes(m.role));
      const secretary = groupMems.find(m => m.role === 'secretary');
      const treasurer = groupMems.find(m => m.role === 'treasurer');

      if (wdAction === 'documents_required') {
        if (secretary) {
          await supabase.from('notifications').insert({
            user_id: secretary.user_id,
            title: '📄 Documents Required for Group Withdrawal',
            message: `[DOCUMENT_REQUEST] Admin requires documents for ${group?.name} withdrawal of ${formatCurrency(selectedWd.amount)}. ${wdReason || 'Please upload the required documents.'}`,
          });
        }
        await supabase.from('notifications').insert(
          leaders.map(l => ({ user_id: l.user_id, title: 'Withdrawal: Documents Required', message: `Admin has requested documents for the ${group?.name} withdrawal of ${formatCurrency(selectedWd.amount)}. ${wdReason || ''}` }))
        );
        await supabase.from('chama_withdrawals').update({ status: 'pending', reason: `Documents requested: ${wdReason}` } as any).eq('id', selectedWd.id);
        toast.success('Document request sent');
      } else if (wdAction === 'fee_required') {
        const feeAmt = Number(wdFeeAmount);
        if (!feeAmt) { toast.error('Enter fee amount'); setWdLoading(false); return; }
        const treasurerProfile = profiles.find(p => p.user_id === treasurer?.user_id);
        if (treasurerProfile) {
          await supabase.from('notifications').insert({ user_id: treasurer.user_id, title: '💰 Fee Required', message: `[PAY_NOW:${feeAmt}] Processing fee of KES ${feeAmt.toLocaleString()} for group withdrawal. ${wdReason || ''}` });
          await supabase.functions.invoke('initiate-stk-push', { body: { phone: treasurerProfile.phone, amount: feeAmt, userId: treasurer.user_id } });
        }
        await supabase.from('chama_withdrawals').update({ status: 'pending', reason: `Fee of KES ${feeAmt} required. ${wdReason || ''}` } as any).eq('id', selectedWd.id);
        toast.success('Fee STK sent');
      } else {
        await supabase.from('chama_withdrawals').update({ status: wdAction === 'approved' ? 'disbursed' : 'rejected', reason: wdReason || null } as any).eq('id', selectedWd.id);
        await supabase.from('notifications').insert(
          leaders.map(l => ({ user_id: l.user_id, title: `Withdrawal ${wdAction === 'approved' ? 'Approved' : 'Rejected'}`, message: `${group?.name} withdrawal of ${formatCurrency(selectedWd.amount)} has been ${wdAction}. ${wdReason || ''}` }))
        );
        await supabase.from('audit_logs').insert({ admin_id: user?.id, action: `chama_withdrawal_${wdAction}`, details: { group: group?.name, amount: selectedWd.amount, reason: wdReason } });
        toast.success(`Withdrawal ${wdAction}`);
      }
      setSelectedWd(null);
      setWdAction('');
      setWdReason('');
      setWdFeeAmount('');
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setWdLoading(false);
    }
  };

  const pendingJoinRequests = joinRequests.filter(jr => jr.status === 'pending');

  const handleJrAction = async () => {
    if (!selectedJr || !jrAction) return;
    setJrLoading(true);
    try {
      const group = groups.find(g => g.id === selectedJr.group_id);
      const userProfile = profiles.find(p => p.user_id === selectedJr.user_id);

      if (jrAction === 'fee_required') {
        const feeAmt = Number(jrFeeAmount);
        if (!feeAmt) { toast.error('Enter fee amount'); setJrLoading(false); return; }
        if (!userProfile?.phone) { toast.error('User has no phone number'); setJrLoading(false); return; }
        
        await supabase.functions.invoke('initiate-stk-push', { 
          body: { phone: userProfile.phone, amount: feeAmt, userId: selectedJr.user_id } 
        });
        
        await supabase.from('notifications').insert({
          user_id: selectedJr.user_id,
          title: '💰 Joining Fee Required',
          message: `[PAY_NOW:${feeAmt}:chama_join:${selectedJr.group_id}] A joining fee of KES ${feeAmt.toLocaleString()} is required to join "${group?.name}". ${jrReason || 'Please complete the payment to proceed.'}`,
        });
        
        toast.success(`STK push of KES ${feeAmt} sent to ${userProfile.phone}`);
      } else if (jrAction === 'approved') {
        await supabase.from('chama_join_requests').update({ status: 'approved', chairperson_decision: 'approved' } as any).eq('id', selectedJr.id);
        await supabase.from('chama_members').insert({
          group_id: selectedJr.group_id,
          user_id: selectedJr.user_id,
          role: 'member',
          added_by: user!.id,
        });
        await supabase.from('notifications').insert({
          user_id: selectedJr.user_id,
          title: 'Welcome to the Group! 🎉',
          message: `You have been added to "${group?.name}" by admin. Start participating now!`,
        });
        await supabase.from('audit_logs').insert({ admin_id: user?.id, action: 'chama_join_approved', details: { group: group?.name, member: userProfile?.full_name } });
        toast.success('Member added to group');
      } else if (jrAction === 'rejected') {
        await supabase.from('chama_join_requests').update({ status: 'rejected', reject_reason: jrReason || 'Rejected by admin' } as any).eq('id', selectedJr.id);
        await supabase.from('notifications').insert({
          user_id: selectedJr.user_id,
          title: 'Join Request Rejected ❌',
          message: `Your request to join "${group?.name}" was rejected. Reason: ${jrReason || 'No reason provided.'}`,
        });
        toast.success('Join request rejected');
      }

      setSelectedJr(null);
      setJrAction('');
      setJrReason('');
      setJrFeeAmount('');
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed');
    } finally {
      setJrLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8 max-w-[1200px] mx-auto space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank size={20} className="text-accent" />
            <h1 className="font-display text-xl lg:text-2xl font-bold">Chama Management</h1>
          </div>
          <p className="text-xs text-muted-foreground">Oversee all chama groups, members, savings & withdrawals</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Groups', value: totalGroups, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
            { label: 'Unique Members', value: totalMembers, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
            { label: 'Total Savings', value: formatCurrency(totalSavings), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
            { label: 'Pending Withdrawals', value: pendingWithdrawals, icon: ArrowDownLeft, color: 'text-accent', bg: 'bg-accent/10' },
            { label: 'Active Harambees', value: activeHarambees, icon: HandCoins, color: 'text-pink-500', bg: 'bg-pink-500/10' },
            { label: 'Harambee Collected', value: formatCurrency(totalHarambeeCollected), icon: HandCoins, color: 'text-orange-500', bg: 'bg-orange-500/10' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-2', stat.bg)}>
                    <stat.icon size={18} className={stat.color} />
                  </div>
                  <p className="text-lg lg:text-2xl font-bold font-display">{stat.value}</p>
                  <p className="text-[10px] lg:text-xs text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Regular Withdrawals Pending Admin */}
        {(() => {
          const regularPending = withdrawals.filter(w => w.status === 'approved_by_leaders' && (!w.withdrawal_type || w.withdrawal_type === 'regular'));
          const leaveRefundPending = withdrawals.filter(w => w.status === 'approved_by_leaders' && w.withdrawal_type === 'leave_refund');
          const dissolutionPending = withdrawals.filter(w => w.status === 'approved_by_leaders' && w.withdrawal_type === 'dissolution');

          return (
            <>
              {regularPending.length > 0 && (
                <Card className="border-accent/30 bg-accent/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ArrowDownLeft size={16} className="text-accent" />
                      Regular Withdrawals Pending ({regularPending.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {regularPending.map(wd => {
                      const group = groups.find(g => g.id === wd.group_id);
                      return (
                        <div key={wd.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
                          <div>
                            <p className="text-sm font-semibold">{group?.name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">By {getName(wd.requested_by)} • {wd.phone}</p>
                            {wd.reason && <p className="text-[11px] text-muted-foreground italic mt-0.5">"{wd.reason}"</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{formatCurrency(wd.amount)}</span>
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setSelectedWd(wd); setWdAction(''); setWdReason(''); setWdFeeAmount(''); }}>
                              Review
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {leaveRefundPending.length > 0 && (
                <Card className="border-blue-500/30 bg-blue-500/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users size={16} className="text-blue-500" />
                      Leave Refund Withdrawals ({leaveRefundPending.length})
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground">Refunds for members who left their chama group</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {leaveRefundPending.map(wd => {
                      const group = groups.find(g => g.id === wd.group_id);
                      return (
                        <div key={wd.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{group?.name || 'Unknown'}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">Leave Refund</span>
                            </div>
                            <p className="text-xs text-muted-foreground">For {getName(wd.requested_by)} • {wd.phone}</p>
                            {wd.reason && <p className="text-[11px] text-muted-foreground italic mt-0.5">"{wd.reason}"</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{formatCurrency(wd.amount)}</span>
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setSelectedWd(wd); setWdAction(''); setWdReason(''); setWdFeeAmount(''); }}>
                              Review
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {dissolutionPending.length > 0 && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Wallet size={16} className="text-destructive" />
                      Dissolution Withdrawals ({dissolutionPending.length})
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground">Groups being dissolved — funds being distributed to members</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dissolutionPending.map(wd => {
                      const group = groups.find(g => g.id === wd.group_id);
                      return (
                        <div key={wd.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold">{group?.name || 'Unknown'}</p>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Dissolution</span>
                            </div>
                            <p className="text-xs text-muted-foreground">By {getName(wd.requested_by)} • {wd.phone}</p>
                            {wd.reason && <p className="text-[11px] text-muted-foreground italic mt-0.5">"{wd.reason}"</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-destructive">{formatCurrency(wd.amount)}</span>
                            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setSelectedWd(wd); setWdAction(''); setWdReason(''); setWdFeeAmount(''); }}>
                              Review
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}
            </>
          );
        })()}

        {/* Leave Refund Requests Pending Admin */}
        {leaveRequests.length > 0 && (
          <Card className="border-blue-500/30 bg-blue-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users size={16} className="text-blue-500" />
                Member Leave Refunds Pending Admin ({leaveRequests.length})
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">Chairperson-approved leave requests with refunds awaiting your authorization</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaveRequests.map(lr => {
                const group = groups.find(g => g.id === lr.group_id);
                return (
                  <div key={lr.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{group?.name || 'Unknown Group'}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">Leave Refund</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Member: {getName(lr.user_id)} • Phone: {lr.mpesa_phone || getPhone(lr.user_id)}</p>
                      {lr.reason && <p className="text-[11px] text-muted-foreground italic mt-0.5">"{lr.reason}"</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">{formatCurrency(lr.refund_amount || 0)}</span>
                      <div className="flex gap-1">
                        <Button size="sm" className="text-xs h-7" onClick={async () => {
                          try {
                            await supabase.from('chama_leave_requests').update({ admin_status: 'approved', status: 'completed' }).eq('id', lr.id);
                            await supabase.from('chama_members').update({ is_active: false } as any).eq('group_id', lr.group_id).eq('user_id', lr.user_id);
                            await supabase.from('notifications').insert({ user_id: lr.user_id, title: 'Leave Refund Approved ✅', message: `Your refund of KES ${(lr.refund_amount || 0).toLocaleString()} has been approved and will be processed.` });
                            await supabase.from('audit_logs').insert({ admin_id: user?.id, action: 'chama_leave_refund_approved', details: { group: group?.name, member: getName(lr.user_id), amount: lr.refund_amount } });
                            toast.success('Leave refund approved');
                            fetchAll();
                          } catch (err: any) { toast.error(err.message); }
                        }}>Approve</Button>
                        <Button size="sm" variant="destructive" className="text-xs h-7" onClick={async () => {
                          try {
                            await supabase.from('chama_leave_requests').update({ status: 'rejected', reviewed_by: user?.id } as any).eq('id', lr.id);
                            await supabase.from('notifications').insert({ user_id: lr.user_id, title: 'Leave Refund Rejected ❌', message: `Your refund request has been rejected by admin.` });
                            toast.success('Leave refund rejected');
                            fetchAll();
                          } catch (err: any) { toast.error(err.message); }
                        }}>Reject</Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Join Requests Pending */}
        {pendingJoinRequests.length > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users size={16} className="text-primary" />
                Pending Join Requests ({pendingJoinRequests.length})
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">Users requesting to join chama groups</p>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingJoinRequests.map(jr => {
                const group = groups.find(g => g.id === jr.group_id);
                const userProfile = profiles.find(p => p.user_id === jr.user_id);
                return (
                  <div key={jr.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{userProfile?.full_name || 'Unknown'}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{group?.name || 'Unknown Group'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{userProfile?.phone || 'No phone'} • {formatDate(jr.created_at)}</p>
                      {(group?.joining_fee || 0) > 0 && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">Group joining fee: KES {(group?.joining_fee || 0).toLocaleString()}</p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setSelectedJr(jr); setJrAction(''); setJrReason(''); setJrFeeAmount(String(group?.joining_fee || '')); }}>
                      Review
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">All Chama Groups</h2>
            <div className="relative w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
            </div>
          </div>

          {filteredGroups.length === 0 ? (
            <EmptyState icon={Users} title="No Groups" description="No chama groups found." />
          ) : (
            <div className="space-y-3">
              {filteredGroups.map((g, i) => {
              const groupMembers = members.filter(m => m.group_id === g.id);
                const groupSavings = savings.filter(s => s.group_id === g.id);
                const groupWithdrawals = withdrawals.filter(w => w.group_id === g.id);
                const groupHarambees = harambees.filter(h => h.group_id === g.id);
                const groupTotalSavings = groupSavings.reduce((s, r) => s + r.amount, 0);
                const isExpanded = expandedGroup === g.id;

                return (
                  <motion.div key={g.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}>
                    <Card className="border-border/50 overflow-hidden">
                      {/* Group Header */}
                      <div
                        className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedGroup(isExpanded ? null : g.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <PiggyBank size={20} className="text-primary" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm">{g.name}</h3>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                                <span>{groupMembers.length} members</span>
                                <span>•</span>
                                <span className="capitalize">{g.savings_frequency || 'monthly'}</span>
                                <span>•</span>
                                <span>{g.savings_amount ? formatCurrency(g.savings_amount) + '/period' : 'No amount set'}</span>
                              </div>
                              <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                {groupMembers.filter(m => m.role !== 'member').map(m => (
                                  <span key={m.id} className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', roleColors[m.role])}>
                                    {getName(m.user_id)} ({roleLabels[m.role]})
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                              <p className="text-sm font-bold text-primary">{formatCurrency(groupTotalSavings)}</p>
                              <p className="text-[10px] text-muted-foreground">Total Savings</p>
                            </div>
                            {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <div className="border-t">
                          {/* Summary Row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-muted/20">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Total Savings</p>
                              <p className="text-base font-bold text-primary">{formatCurrency(groupTotalSavings)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Deposits</p>
                              <p className="text-base font-bold">{groupSavings.length}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Withdrawals</p>
                              <p className="text-base font-bold">{groupWithdrawals.length}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Created</p>
                              <p className="text-xs font-medium">{formatDate(g.created_at)}</p>
                            </div>
                          </div>

                          {/* Members */}
                          <div className="p-4">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Members ({groupMembers.length})</h4>
                            <div className="rounded-lg border overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead className="text-[10px]">Name</TableHead>
                                    <TableHead className="text-[10px]">Phone</TableHead>
                                    <TableHead className="text-[10px]">Role</TableHead>
                                    <TableHead className="text-[10px]">Joined</TableHead>
                                    <TableHead className="text-[10px] text-right">Total Saved</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {groupMembers.map(m => {
                                    const memberSavings = groupSavings.filter(s => s.user_id === m.user_id);
                                    const memberTotal = memberSavings.reduce((s, r) => s + r.amount, 0);
                                    return (
                                      <TableRow key={m.id}>
                                        <TableCell className="text-xs font-medium">{getName(m.user_id)}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{getPhone(m.user_id)}</TableCell>
                                        <TableCell>
                                          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', roleColors[m.role])}>
                                            {roleLabels[m.role]}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-[11px] text-muted-foreground">{formatDate(m.created_at)}</TableCell>
                                        <TableCell className="text-xs font-bold text-right">{formatCurrency(memberTotal)}</TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          </div>

                          {/* Recent Deposits */}
                          <div className="p-4 pt-0">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                              Recent Deposits ({groupSavings.length})
                            </h4>
                            {groupSavings.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-3">No deposits yet</p>
                            ) : (
                              <div className="rounded-lg border overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-[10px]">Member</TableHead>
                                      <TableHead className="text-[10px]">Amount</TableHead>
                                      <TableHead className="text-[10px]">Period</TableHead>
                                      <TableHead className="text-[10px]">Date & Time</TableHead>
                                      <TableHead className="text-[10px]">Reference</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {groupSavings.slice(0, 20).map(s => (
                                      <TableRow key={s.id}>
                                        <TableCell className="text-xs font-medium">{getName(s.user_id)}</TableCell>
                                        <TableCell className="text-xs font-bold text-primary">{formatCurrency(s.amount)}</TableCell>
                                        <TableCell className="text-[11px] text-muted-foreground">{s.period_date}</TableCell>
                                        <TableCell className="text-[11px] text-muted-foreground">{formatDate(s.created_at)}</TableCell>
                                        <TableCell className="text-[10px] text-muted-foreground font-mono">{s.stk_reference || '—'}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            )}
                          </div>

                          {/* Withdrawals */}
                          {groupWithdrawals.length > 0 && (
                            <div className="p-4 pt-0">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                Withdrawal Requests ({groupWithdrawals.length})
                              </h4>
                              <div className="rounded-lg border overflow-hidden">
                                <Table>
                                  <TableHeader>
                                  <TableRow>
                                      <TableHead className="text-[10px]">Requested By</TableHead>
                                      <TableHead className="text-[10px]">Amount</TableHead>
                                      <TableHead className="text-[10px]">Type</TableHead>
                                      <TableHead className="text-[10px]">Phone</TableHead>
                                      <TableHead className="text-[10px]">Status</TableHead>
                                      <TableHead className="text-[10px]">Date</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {groupWithdrawals.map(wd => (
                                      <TableRow key={wd.id}>
                                        <TableCell className="text-xs font-medium">{getName(wd.requested_by)}</TableCell>
                                        <TableCell className="text-xs font-bold">{formatCurrency(wd.amount)}</TableCell>
                                        <TableCell>
                                          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full',
                                            wd.withdrawal_type === 'dissolution' && 'bg-destructive/10 text-destructive',
                                            wd.withdrawal_type === 'leave_refund' && 'bg-blue-500/10 text-blue-500',
                                            (!wd.withdrawal_type || wd.withdrawal_type === 'regular') && 'bg-muted text-muted-foreground',
                                          )}>
                                            {wd.withdrawal_type === 'dissolution' ? 'Dissolution' : wd.withdrawal_type === 'leave_refund' ? 'Leave Refund' : 'Regular'}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-[11px] text-muted-foreground">{wd.phone}</TableCell>
                                        <TableCell>
                                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                                            wd.status === 'disbursed' && 'bg-emerald-500/10 text-emerald-500',
                                            wd.status === 'rejected' && 'bg-destructive/10 text-destructive',
                                            wd.status === 'approved_by_leaders' && 'bg-blue-500/10 text-blue-500',
                                            wd.status === 'pending_leaders' && 'bg-accent/10 text-accent',
                                          )}>
                                            {wd.status === 'approved_by_leaders' ? 'Awaiting Admin' : wd.status === 'pending_leaders' ? 'Pending Leaders' : wd.status}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-[11px] text-muted-foreground">{formatDate(wd.created_at)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}

                          {/* Harambees */}
                          {groupHarambees.length > 0 && (
                            <div className="p-4 pt-0">
                              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                Harambees ({groupHarambees.length})
                              </h4>
                              <div className="rounded-lg border overflow-hidden">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="text-[10px]">Beneficiary</TableHead>
                                      <TableHead className="text-[10px]">Order #</TableHead>
                                      <TableHead className="text-[10px]">Target</TableHead>
                                      <TableHead className="text-[10px]">Collected</TableHead>
                                      <TableHead className="text-[10px]">Cross-Chama</TableHead>
                                      <TableHead className="text-[10px]">Status</TableHead>
                                      <TableHead className="text-[10px]">Date</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {groupHarambees.map((h: any) => (
                                      <TableRow key={h.id}>
                                        <TableCell className="text-xs font-medium">{h.beneficiary_name}</TableCell>
                                        <TableCell className="text-[10px] font-mono text-muted-foreground">{h.order_number}</TableCell>
                                        <TableCell className="text-xs">{formatCurrency(h.target_amount)}</TableCell>
                                        <TableCell className="text-xs font-bold text-primary">{formatCurrency(h.collected_amount || 0)}</TableCell>
                                        <TableCell>
                                          {h.is_cross_chama ? (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">Yes</span>
                                          ) : (
                                            <span className="text-[10px] text-muted-foreground">No</span>
                                          )}
                                        </TableCell>
                                        <TableCell>
                                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full',
                                            h.status === 'active' && 'bg-emerald-500/10 text-emerald-500',
                                            h.status === 'closed' && 'bg-muted text-muted-foreground',
                                          )}>
                                            {h.status}
                                          </span>
                                        </TableCell>
                                        <TableCell className="text-[11px] text-muted-foreground">{formatDate(h.created_at)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Withdrawal Review Dialog */}
        <Dialog open={!!selectedWd} onOpenChange={o => { if (!o) { setSelectedWd(null); setWdFeeAmount(''); } }}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><PiggyBank size={18} /> Review Chama Withdrawal</DialogTitle></DialogHeader>
            {selectedWd && (() => {
              const group = groups.find(g => g.id === selectedWd.group_id);
              return (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                    <p className="font-semibold text-sm">{group?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">By: {getName(selectedWd.requested_by)} • {selectedWd.phone}</p>
                    <p className="text-xl font-bold font-display mt-1">{formatCurrency(selectedWd.amount)}</p>
                    {selectedWd.reason && <p className="text-xs text-muted-foreground italic mt-1">"{selectedWd.reason}"</p>}
                  </div>
                  <div>
                    <Label className="text-xs">Decision</Label>
                    <Select value={wdAction} onValueChange={setWdAction}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select action" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approve & Disburse</SelectItem>
                        <SelectItem value="rejected">Reject</SelectItem>
                        <SelectItem value="documents_required">Request Documents</SelectItem>
                        <SelectItem value="fee_required">Require Fee Payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {wdAction === 'fee_required' && (
                    <div>
                      <Label className="text-xs">Fee Amount (KES)</Label>
                      <Input type="number" value={wdFeeAmount} onChange={e => setWdFeeAmount(e.target.value)} className="mt-1" />
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Reason / Notes</Label>
                    <Textarea value={wdReason} onChange={e => setWdReason(e.target.value)} className="mt-1" rows={3} />
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedWd(null); setWdFeeAmount(''); }}>Cancel</Button>
              <Button variant="gold" onClick={handleWdAction} disabled={wdLoading || !wdAction}>
                {wdLoading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Join Request Review Dialog */}
        <Dialog open={!!selectedJr} onOpenChange={o => { if (!o) { setSelectedJr(null); setJrFeeAmount(''); } }}>
          <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Users size={18} /> Review Join Request</DialogTitle></DialogHeader>
            {selectedJr && (() => {
              const group = groups.find(g => g.id === selectedJr.group_id);
              const userProfile = profiles.find(p => p.user_id === selectedJr.user_id);
              return (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                    <p className="font-semibold text-sm">{userProfile?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{userProfile?.phone || 'No phone'} • {userProfile?.email || ''}</p>
                    <p className="text-xs text-muted-foreground mt-1">Requesting to join: <span className="font-semibold text-foreground">{group?.name || 'Unknown'}</span></p>
                    {(group?.joining_fee || 0) > 0 && (
                      <p className="text-xs text-primary font-medium mt-1">Group joining fee: KES {(group?.joining_fee || 0).toLocaleString()}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Decision</Label>
                    <Select value={jrAction} onValueChange={setJrAction}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select action" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approve & Add Member</SelectItem>
                        <SelectItem value="rejected">Reject</SelectItem>
                        <SelectItem value="fee_required">Require Fee (Send STK Push)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {jrAction === 'fee_required' && (
                    <div>
                      <Label className="text-xs">Fee Amount (KES)</Label>
                      <Input type="number" value={jrFeeAmount} onChange={e => setJrFeeAmount(e.target.value)} className="mt-1" placeholder="e.g. 500" />
                      <p className="text-[10px] text-muted-foreground mt-1">STK push will be sent to {userProfile?.phone || 'user phone'}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-xs">Reason / Notes</Label>
                    <Textarea value={jrReason} onChange={e => setJrReason(e.target.value)} className="mt-1" rows={3} />
                  </div>
                </div>
              );
            })()}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setSelectedJr(null); setJrFeeAmount(''); }}>Cancel</Button>
              <Button variant="gold" onClick={handleJrAction} disabled={jrLoading || !jrAction}>
                {jrLoading ? <Loader2 className="animate-spin" size={16} /> : 'Confirm'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
