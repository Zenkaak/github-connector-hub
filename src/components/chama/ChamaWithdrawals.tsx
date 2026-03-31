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
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawalType, setWithdrawalType] = useState<'regular' | 'dissolution'>('regular');

  const isTreasurer = myRole === 'treasurer';
  const isChair = myRole === 'chairperson';
  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);
  const leaders = members.filter(m => ['chairperson', 'secretary', 'treasurer'].includes(m.role));

  const getMemberName = (userId: string) => members.find(m => m.user_id === userId)?.profile?.full_name || 'Unknown';

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
    if (!user || !amount || !phone) return;
    setSubmitting(true);
    try {
      const { data: wd, error } = await supabase.from('chama_withdrawals').insert({
        group_id: groupId,
        requested_by: user.id,
        amount: parseInt(amount),
        reason: reason.trim() || null,
        phone: phone.trim(),
        withdrawal_type: withdrawalType,
      } as any).select().single();

      if (error) throw error;

      // Create approval records for all 3 leaders
      const approvalRecords = leaders.map(l => ({
        withdrawal_id: wd.id,
        user_id: l.user_id,
        approved: null,
      }));
      await supabase.from('chama_withdrawal_approvals').insert(approvalRecords as any);

      // Notify all leaders
      await supabase.from('notifications').insert(
        leaders.map(l => ({
          user_id: l.user_id,
          title: 'Withdrawal Request',
          message: `Treasurer has requested a withdrawal of KES ${parseInt(amount).toLocaleString()}. Please review and approve or reject.`,
        }))
      );

      toast({ title: 'Request Submitted', description: 'Leaders have been notified for approval.' });
      setRequestOpen(false);
      setAmount(''); setReason(''); setPhone('');
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
        .update({ approved: decision === 'approved' } as any)
        .eq('withdrawal_id', withdrawalId)
        .eq('user_id', user.id);

      // Check all approvals for this withdrawal
      const { data: allApprovals } = await supabase
        .from('chama_withdrawal_approvals')
        .select('*')
        .eq('withdrawal_id', withdrawalId);

      if (!allApprovals) return;

      const updatedApprovals = allApprovals.map(a => a.approver_id === user.id ? { ...a, decision } : a);
      const rejected = updatedApprovals.find(a => a.decision === 'rejected');
      const allApproved = updatedApprovals.every(a => a.decision === 'approved');

      if (rejected) {
        // Notify all 3 leaders about rejection
        const rejectorRole = members.find(m => m.user_id === rejected.approver_id)?.role || 'leader';
        const roleLabel = rejectorRole.charAt(0).toUpperCase() + rejectorRole.slice(1);

        await supabase.from('chama_withdrawals')
          .update({ status: 'rejected', updated_at: new Date().toISOString() })
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
        // All approved → send to admin
        await supabase.from('chama_withdrawals')
          .update({ status: 'approved_by_leaders', updated_at: new Date().toISOString() })
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
      pending_leaders: { color: 'bg-accent/10 text-accent', label: 'Pending Leaders' },
      approved_by_leaders: { color: 'bg-blue-500/10 text-blue-500', label: 'Awaiting Admin' },
      approved: { color: 'bg-emerald-500/10 text-emerald-500', label: 'Approved' },
      rejected: { color: 'bg-destructive/10 text-destructive', label: 'Rejected' },
      disbursed: { color: 'bg-primary/10 text-primary', label: 'Disbursed' },
    };
    const s = map[status] || { color: 'bg-muted text-muted-foreground', label: status };
    return <span className={`text-[11px] px-2 py-1 rounded-full font-medium ${s.color}`}>{s.label}</span>;
  };

  const getTypeBadge = (type: string) => {
    const map: Record<string, { color: string; label: string }> = {
      regular: { color: 'bg-primary/10 text-primary', label: 'Regular' },
      leave_refund: { color: 'bg-accent/10 text-accent', label: 'Leave Refund' },
      dissolution: { color: 'bg-destructive/10 text-destructive', label: 'Dissolution' },
    };
    const t = map[type] || { color: 'bg-muted text-muted-foreground', label: type };
    return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${t.color}`}>{t.label}</span>;
  };

  const pendingCount = withdrawals.filter(w => w.status === 'pending_leaders').length;
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
          {isTreasurer && (
            <Button onClick={() => { setWithdrawalType('regular'); setRequestOpen(true); }} className="gap-2">
              <ArrowDownToLine size={16} /> Request Withdrawal
            </Button>
          )}
          {isChair && (
            <Button onClick={() => { setWithdrawalType('dissolution'); setRequestOpen(true); }} variant="destructive" className="gap-2">
              <Trash2 size={16} /> Dissolution Withdrawal
            </Button>
          )}
        </div>
      )}

      {/* Withdrawals List */}
      <div className="space-y-3">
        {withdrawals.map(w => {
          const wdApprovals = approvals.filter(a => a.withdrawal_id === w.id);
          const myApproval = wdApprovals.find(a => a.approver_id === user?.id);
          const canApprove = isLeader && w.status === 'pending_leaders' && myApproval?.decision === 'pending';

          return (
            <Card key={w.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold">KES {w.amount.toLocaleString()}</p>
                    {getTypeBadge((w as any).withdrawal_type || 'regular')}
                  </div>
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
                    a.decision === 'approved' ? 'bg-emerald-500/10 text-emerald-500' :
                    a.decision === 'rejected' ? 'bg-destructive/10 text-destructive' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {a.approver_role}: {a.decision}
                  </span>
                ))}
              </div>

              {canApprove && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="success" className="gap-1" onClick={() => handleApproval(w.id, 'approved')}>
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
          <DialogHeader><DialogTitle>{withdrawalType === 'dissolution' ? 'Dissolution Withdrawal' : 'Request Withdrawal'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} max={savings} className="mt-1" />
            </div>
            <div>
              <Label>Recipient Phone (M-Pesa)</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0712345678" className="mt-1" />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this withdrawal needed?" className="mt-1" />
            </div>
            <Button onClick={handleSubmitRequest} disabled={submitting || !amount || !phone} className="w-full">
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
