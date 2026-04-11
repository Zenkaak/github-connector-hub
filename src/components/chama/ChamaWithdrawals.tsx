import { useState, useEffect } from 'react';
import { ArrowDownToLine, Check, X, Clock, Trash2 } from 'lucide-react';
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

  const isTreasurer = myRole === 'treasurer';
  const isChair = myRole === 'chairperson';
  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);
  const leaders = members.filter(m => ['chairperson', 'secretary', 'treasurer'].includes(m.role));

  const getMemberName = (userId: string) => members.find(m => m.user_id === userId)?.profile?.full_name || 'Unknown';
  const getMemberRole = (userId: string) => members.find(m => m.user_id === userId)?.role || 'member';

  const fetchData = async () => {
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
  };

  useEffect(() => { fetchData(); }, [groupId]);

  const handleSubmitRequest = async () => {
    if (!user || !amount) return;
    setSubmitting(true);
    try {
      // Use secure RPC that immediately debits all member savings
      const { data: wdId, error } = await supabase.rpc('request_chama_withdrawal_secure', {
        _group_id: groupId,
        _requested_by: user.id,
        _amount: parseInt(amount),
        _reason: reason.trim() || null,
      });

      if (error) throw error;

      // Create approval records for all 3 leaders
      const approvalRecords = leaders.map(l => ({
        withdrawal_id: wdId,
        user_id: l.user_id,
        approved: null,
      }));
      await supabase.from('chama_withdrawal_approvals').insert(approvalRecords);

      // Notify all leaders
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
    try {
      // Update my approval
      await supabase.from('chama_withdrawal_approvals')
        .update({ approved: decision === 'approved' })
        .eq('withdrawal_id', withdrawalId)
        .eq('user_id', user.id);

      // Check all approvals for this withdrawal
      const { data: allApprovals } = await supabase
        .from('chama_withdrawal_approvals')
        .select('*')
        .eq('withdrawal_id', withdrawalId);

      if (!allApprovals) return;

      const updatedApprovals = allApprovals.map((a: any) => a.user_id === user.id ? { ...a, approved: decision === 'approved' } : a);
      const rejected = updatedApprovals.find((a: any) => a.approved === false);
      const allApproved = updatedApprovals.every((a: any) => a.approved === true);

      if (rejected) {
        const rejectorRole = getMemberRole(rejected.user_id);
        const roleLabel = rejectorRole.charAt(0).toUpperCase() + rejectorRole.slice(1);

        await supabase.from('chama_withdrawals')
          .update({ status: 'rejected' })
          .eq('id', withdrawalId);

        await supabase.from('notifications').insert(
          leaders.map(l => ({
            user_id: l.user_id,
            title: 'Withdrawal Declined',
            message: `${roleLabel} declined the withdrawal request. Please liaise with them and retry.`,
          }))
        );
        toast({ title: 'Withdrawal Rejected', description: 'Leaders have been notified.' });
      } else if (allApproved) {
        await supabase.from('chama_withdrawals')
          .update({ status: 'approved_by_leaders' })
          .eq('id', withdrawalId);

        toast({ title: 'All Leaders Approved', description: 'Withdrawal sent to admin for final approval.' });
      } else {
        toast({ title: decision === 'approved' ? 'Approved' : 'Rejected' });
      }

      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
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
          const canApprove = isLeader && w.status === 'pending' && myApproval && myApproval.approved === null;

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
                  <Button size="sm" className="gap-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApproval(w.id, 'approved')}>
                    <Check size={14} /> Approve
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleApproval(w.id, 'rejected')}>
                    <X size={14} /> Reject
                  </Button>
                </div>
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
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} max={savings} className="mt-1" />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this withdrawal needed?" className="mt-1" />
            </div>
            <p className="text-xs text-muted-foreground">This request will be sent to all leaders (Chairperson, Secretary, Treasurer) for approval before going to admin.</p>
            <Button onClick={handleSubmitRequest} disabled={submitting || !amount} className="w-full">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
