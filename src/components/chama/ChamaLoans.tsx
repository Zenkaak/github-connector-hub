import { useState, useEffect } from 'react';
import { Landmark, Plus, Check, X } from 'lucide-react';
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
  group: any;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string } }>;
  myRole: string;
}

export function ChamaLoans({ groupId, group, members, myRole }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [applying, setApplying] = useState(false);
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isChair = myRole === 'chairperson';
  const loanEnabled = group?.loan_enabled;
  const maxAmount = group?.loan_max_amount || 0;
  const interestRate = group?.loan_interest_rate || 5;
  const maxDuration = group?.loan_max_duration_months || 3;

  const fetchLoans = async () => {
    const { data } = await supabase
      .from('chama_loans')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (data) setLoans(data);
    setLoading(false);
  };

  useEffect(() => { fetchLoans(); }, [groupId]);

  const getMemberName = (uid: string) => members.find(m => m.user_id === uid)?.profile?.full_name || 'Unknown';

  const handleApply = async () => {
    if (!user) return;
    const amt = parseInt(amount);
    if (!amt || amt <= 0 || amt > maxAmount) {
      toast({ title: 'Invalid Amount', description: `Max loan amount is KES ${maxAmount.toLocaleString()}`, variant: 'destructive' });
      return;
    }
    setApplying(true);
    try {
      const totalRepayment = Math.round(amt * (1 + interestRate / 100));
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + maxDuration);

      const { error } = await supabase.from('chama_loans').insert({
        group_id: groupId,
        borrower_id: user.id,
        amount: amt,
        interest_rate: interestRate,
        total_repayment: totalRepayment,
        duration_months: maxDuration,
        outstanding_balance: totalRepayment,
        due_date: dueDate.toISOString().split('T')[0],
      } as any);
      if (error) throw error;

      // Notify chairperson
      const chair = members.find(m => m.role === 'chairperson');
      if (chair) {
        await supabase.from('notifications').insert({
          user_id: chair.user_id,
          title: 'New Loan Request',
          message: `${getMemberName(user.id)} has requested a loan of KES ${amt.toLocaleString()}. Review in the Loans tab.`,
        });
      }

      toast({ title: 'Loan Applied', description: 'Your request has been submitted for review.' });
      setApplyOpen(false);
      setAmount('');
      fetchLoans();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const handleDecision = async (loanId: string, decision: 'approved' | 'rejected', reason?: string) => {
    try {
      const updateData: any = {
        chairperson_decision: decision,
        status: decision,
      };
      if (reason) updateData.reject_reason = reason;
      if (decision === 'approved') updateData.disbursed_at = new Date().toISOString();

      const { error } = await supabase.from('chama_loans').update(updateData).eq('id', loanId);
      if (error) throw error;

      const loan = loans.find(l => l.id === loanId);
      if (loan) {
        await supabase.from('notifications').insert({
          user_id: loan.borrower_id,
          title: decision === 'approved' ? 'Loan Approved ✅' : 'Loan Rejected ❌',
          message: decision === 'approved'
            ? `Your loan of KES ${loan.amount.toLocaleString()} has been approved. Total repayment: KES ${loan.total_repayment.toLocaleString()}.`
            : `Your loan request was rejected. Reason: ${reason || 'No reason provided.'}`,
        });
      }

      toast({ title: decision === 'approved' ? 'Loan Approved' : 'Loan Rejected' });
      setRejectOpen(null);
      setRejectReason('');
      fetchLoans();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (!loanEnabled) {
    return (
      <Card className="p-8 text-center">
        <Landmark size={40} className="mx-auto text-muted-foreground/30 mb-3" />
        <h3 className="font-semibold mb-1">Loans Not Enabled</h3>
        <p className="text-sm text-muted-foreground">
          {isChair ? 'Enable loans in the Settings tab to allow members to borrow from the group.' : 'The Chairperson has not enabled group lending yet.'}
        </p>
      </Card>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-600',
    approved: 'bg-emerald-500/10 text-emerald-600',
    rejected: 'bg-destructive/10 text-destructive',
  };

  return (
    <div className="space-y-4">
      {/* Loan info */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Max Amount</p>
          <p className="font-bold">KES {maxAmount.toLocaleString()}</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Interest</p>
          <p className="font-bold">{interestRate}%</p>
        </Card>
        <Card className="p-3 text-center">
          <p className="text-[11px] text-muted-foreground">Max Duration</p>
          <p className="font-bold">{maxDuration} mo</p>
        </Card>
      </div>

      <Button onClick={() => setApplyOpen(true)} className="gap-2">
        <Plus size={16} /> Apply for Loan
      </Button>

      {/* Loans list */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Loan History</h3>
        </div>
        {loading ? (
          <div className="p-4"><div className="h-16 bg-muted animate-pulse rounded" /></div>
        ) : loans.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No loan records yet</div>
        ) : (
          <div className="divide-y">
            {loans.map(loan => (
              <div key={loan.id} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium">{getMemberName(loan.borrower_id)}</p>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[loan.status] || ''}`}>
                    {loan.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  KES {loan.amount.toLocaleString()} · Repay KES {loan.total_repayment.toLocaleString()} · Due {loan.due_date}
                </p>
                {isChair && loan.status === 'pending' && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => handleDecision(loan.id, 'approved')}>
                      <Check size={12} /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => setRejectOpen(loan.id)}>
                      <X size={12} /> Reject
                    </Button>
                  </div>
                )}
                {loan.reject_reason && (
                  <p className="text-xs text-destructive mt-1">Reason: {loan.reject_reason}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Apply Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Group Loan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (KES) - Max {maxAmount.toLocaleString()}</Label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} min={1} max={maxAmount} className="mt-1" />
            </div>
            <p className="text-xs text-muted-foreground">
              Interest: {interestRate}% · Duration: {maxDuration} months
              {amount && parseInt(amount) > 0 && (
                <> · Total repayment: <strong>KES {Math.round(parseInt(amount) * (1 + interestRate / 100)).toLocaleString()}</strong></>
              )}
            </p>
            <Button onClick={handleApply} disabled={applying} className="w-full">
              {applying ? 'Submitting...' : 'Submit Loan Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={() => { setRejectOpen(null); setRejectReason(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Loan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for rejection</Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} className="mt-1" />
            </div>
            <Button variant="destructive" onClick={() => rejectOpen && handleDecision(rejectOpen, 'rejected', rejectReason)} className="w-full">
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
