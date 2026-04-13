import { useState, useEffect, useCallback } from 'react';
import { ArrowDownToLine, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Props {
  groupId: string;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string; phone: string } }>;
  myRole: string;
  savings: number;
}

export function ChamaWithdrawals({ groupId, members, myRole, savings }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [approvals, setApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  const isTreasurer = myRole === 'treasurer';
  const isChair = myRole === 'chairperson';
  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);
  const leaders = members.filter(m => ['chairperson', 'secretary', 'treasurer'].includes(m.role));

  const getMemberName = (userId: string) => members.find(m => m.user_id === userId)?.profile?.full_name || 'Unknown';
  const getMemberRole = (userId: string) => members.find(m => m.user_id === userId)?.role || 'member';

  const fetchData = useCallback(async () => {
    const { data: wd } = await supabase
      .from('chama_withdrawals')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (wd) setWithdrawals(wd);

    if (wd?.length) {
      const wdIds = wd.map(w => w.id);
      const { data: ap } = await supabase
        .from('chama_withdrawal_approvals')
        .select('*')
        .in('withdrawal_id', wdIds);
      if (ap) setApprovals(ap);
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    fetchData();

    // Real-time subscription for instant UI updates
    const wdChannel = supabase
      .channel('wd-realtime-' + groupId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chama_withdrawals', filter: `group_id=eq.${groupId}` }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chama_withdrawal_approvals' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(wdChannel); };
  }, [groupId, fetchData]);

  const handleSubmitRequest = async () => {
    if (!user || !amount) return;
    setSubmitting(true);
    try {
      const { data: wdId, error } = await supabase.rpc('request_chama_withdrawal_secure', {
        _group_id: groupId,
        _requested_by: user.id,
        _amount: parseInt(amount),
        _reason: reason.trim() || null,
      });

      if (error) {
        toast({ title: 'Withdrawal Unsuccessful', description: error.message, variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      // Create approval records for all leaders
      const approvalRecords = leaders.map(l => ({
        withdrawal_id: wdId,
        user_id: l.user_id,
        approved: null,
      }));
      await supabase.from('chama_withdrawal_approvals').insert(approvalRecords);

      // Notify leaders
      await supabase.from('notifications').insert(
        leaders.map(l => ({
          user_id: l.user_id,
          title: 'Withdrawal Request',
          message: `${getMemberName(user.id)} has requested a withdrawal of KES ${parseInt(amount).toLocaleString()}. Savings have been debited. Please review and approve or reject.`,
        }))
      );

      toast({ title: 'Request Submitted', description: 'Savings debited immediately. Leaders have been notified.' });
      setRequestOpen(false);
      setAmount(''); setReason('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproval = async (withdrawalId: string, decision: 'approved' | 'rejected') => {
    if (!user) return;
    setVoting(withdrawalId);
    try {
      // Update my approval — the DB trigger handles status + reversal automatically
      const { error } = await supabase.from('chama_withdrawal_approvals')
        .update({ approved: decision === 'approved' })
        .eq('withdrawal_id', withdrawalId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({ title: decision === 'approved' ? 'Approved' : 'Rejected', description: 'Vote recorded. Status will update automatically.' });

      // Immediate re-fetch (trigger has already updated status)
      await fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setVoting(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { color: string; label: string }> = {
      pending: { color: 'bg-accent/10 text-accent', label: 'Pending Leaders' },
      approved_by_leaders: { color: 'bg-blue-500/10 text-blue-500', label: 'Awaiting Admin' },
      approved: { color: 'bg-emerald-500/10 text-emerald-500', label: 'Approved' },
      rejected: { color: 'bg-destructive/10 text-destructive', label: 'Rejected' },
      disbursed: { color: 'bg-primary/10 text-primary', label: 'Disbursed' },
    };
    const s = map[status] || { color: 'bg-muted text-muted-foreground', label: status };
    return <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${s.color}`}>{s.label}</span>;
  };

  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;
  const approvedCount = withdrawals.filter(w => ['approved', 'approved_by_leaders', 'disbursed'].includes(w.status)).length;
  const totalWithdrawn = withdrawals.filter(w => w.status === 'disbursed').reduce((s, w) => s + w.amount, 0);

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Withdrawn</p>
          <p className="text-xl font-bold">KES {totalWithdrawn.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-xl font-bold text-accent">{pendingCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Approved</p>
          <p className="text-xl font-bold text-emerald-500">{approvedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Group Balance</p>
          <p className="text-xl font-bold text-primary">KES {savings.toLocaleString()}</p>
        </Card>
      </div>

      {(isTreasurer || isChair) && (
        <div className="flex gap-2 flex-wrap">
          <Button onClick={() => setRequestOpen(true)} className="gap-2">
            <ArrowDownToLine size={16} /> Request Withdrawal
          </Button>
        </div>
      )}

      {/* Withdrawals List */}
      <div className="space-y-3">
        {withdrawals.map(w => {
          const wdApprovals = approvals.filter(a => a.withdrawal_id === w.id);
          const myApproval = wdApprovals.find(a => a.user_id === user?.id);
          // Only show buttons when status is EXACTLY 'pending' and user hasn't voted
          const canApprove = isLeader && w.status === 'pending' && myApproval && myApproval.approved === null;
          const isVoting = voting === w.id;

          return (
            <Card key={w.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold">KES {w.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">
                    By {getMemberName(w.requested_by)} · {new Date(w.created_at).toLocaleDateString('en-KE')}
                  </p>
                  {w.reason && <p className="text-xs text-muted-foreground mt-1">{w.reason}</p>}
                </div>
                {getStatusBadge(w.status)}
              </div>

              {/* Approval status */}
              <div className="flex gap-2 flex-wrap mt-2">
                {wdApprovals.map(a => (
                  <span key={a.id} className={`text-[10px] px-2 py-0.5 rounded-full ${
                    a.approved === true ? 'bg-emerald-500/10 text-emerald-500' :
                    a.approved === false ? 'bg-destructive/10 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {getMemberRole(a.user_id)}: {a.approved === true ? 'approved' : a.approved === false ? 'rejected' : 'pending'}
                  </span>
                ))}
              </div>

              {canApprove && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" 
                    disabled={isVoting} onClick={() => handleApproval(w.id, 'approved')}>
                    {isVoting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1" 
                    disabled={isVoting} onClick={() => handleApproval(w.id, 'rejected')}>
                    {isVoting ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />} Reject
                  </Button>
                </div>
              )}

              {/* Show rejection/approval admin reason */}
              {w.admin_reason && (
                <p className="text-[10px] text-muted-foreground mt-2 italic">Admin: {w.admin_reason}</p>
              )}
            </Card>
          );
        })}
        {withdrawals.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground text-sm">No withdrawal requests yet</Card>
        )}
      </div>

      {/* Request Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request Withdrawal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-accent/5 border border-accent/10">
              <p className="text-[11px] text-muted-foreground">
                ⚠️ Savings will be debited immediately. If rejected, all members' savings will be restored exactly.
              </p>
              <ul className="text-[10px] text-muted-foreground mt-2 space-y-1 list-disc ml-3">
                <li>Members with zero savings will block withdrawal</li>
                <li>Members with arrears will block withdrawal</li>
                <li>Partial withdrawal: minimum KES 50 balance per member</li>
              </ul>
            </div>
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} max={savings} className="mt-1" />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this withdrawal needed?" className="mt-1" />
            </div>
            <Button onClick={handleSubmitRequest} disabled={submitting || !amount} className="w-full">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
