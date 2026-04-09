import { useState, useEffect } from 'react';
import { Landmark, Plus, Check, X, AlertCircle, Clock, Ban, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInMonths, addMonths } from 'date-fns';

interface Props {
  groupId: string;
  group: any;
  members: Array<{ 
    user_id: string; 
    role: string; 
    joined_at?: string; 
    profile?: { full_name: string } 
  }>;
  myRole: string;
}

export function ChamaLoans({ groupId, group, members, myRole }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // --- STATE MANAGEMENT ---
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [applying, setApplying] = useState(false);
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  const [userSavings, setUserSavings] = useState(0);
  const [hasArrears, setHasArrears] = useState(false);
  const [activeLoan, setActiveLoan] = useState<any>(null);
  const [probationStatus, setProbationStatus] = useState<{ isUnder: boolean; remaining: number }>({ isUnder: false, remaining: 0 });

  const isChair = myRole === 'chairperson';
  const loanEnabled = group?.loan_enabled;
  const maxAmount = group?.loan_max_amount || 0;
  const interestRate = group?.loan_interest_rate || 5;
  const maxDuration = group?.loan_max_duration_months || 3;
  const minSavingsRequired = group?.min_savings_before_loan || 0;

  // --- DATA FETCHING ---
  const fetchData = async () => {
    if (!user || !groupId) return;
    setLoading(true);
    try {
      // 1. Fetch Group Loans
      const { data: loanData } = await supabase
        .from('chama_loans')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      
      if (loanData) {
        setLoans(loanData);
        const myActive = loanData.find(l => 
          ((l as any).borrower_id === user.id || l.user_id === user.id) && ['pending', 'approved', 'active', 'disbursed'].includes(l.status)
        );
        setActiveLoan(myActive);
      }

      // 2. Fetch User Savings
      const { data: savingsData } = await supabase
        .from('chama_savings')
        .select('amount')
        .eq('group_id', groupId)
        .eq('user_id', user.id);
      
      const total = savingsData?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
      setUserSavings(total);

      // 3. Check for Penalties
      const { data: penaltyData } = await supabase
        .from('chama_penalties')
        .select('id')
        .eq('user_id', user.id)
        .eq('group_id', groupId)
        .eq('is_paid', false)
        .limit(1);
      setHasArrears(!!penaltyData?.length);

      // 4. PROBATION CALCULATION (Exact 3-Month Countdown)
      const myMemberRecord = members.find(m => m.user_id === user.id);
      if (myMemberRecord && group.new_member_probation_months > 0) {
        const joinedDate = new Date(myMemberRecord.joined_at);
        const now = new Date();
        const probationEndDate = addMonths(joinedDate, group.new_member_probation_months);
        
        const isUnder = now < probationEndDate;
        const monthsRemaining = Math.max(0, differenceInMonths(probationEndDate, now));

        setProbationStatus({ 
          isUnder, 
          remaining: isUnder ? (monthsRemaining === 0 ? 1 : monthsRemaining) : 0 
        });
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [groupId, user, members]);

  const getMemberName = (uid: string) => members.find(m => m.user_id === uid)?.profile?.full_name || 'Member';

  // --- ACTIONS ---
  const handleApply = async () => {
    if (!user) return;
    const amt = parseInt(amount);
    
    if (!amt || amt <= 0 || amt > maxAmount) {
      toast({ title: 'Invalid Amount', description: `Limit is KES ${maxAmount.toLocaleString()}`, variant: 'destructive' });
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
        user_id: user.id,
        amount: amt,
        interest_rate: interestRate,
        total_repayment: totalRepayment,
        duration_months: maxDuration,
        outstanding_balance: totalRepayment,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending'
      } as any);

      if (error) throw error;
      toast({ title: 'Success', description: 'Your application is now pending approval.' });
      setApplyOpen(false);
      setAmount('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setApplying(false);
    }
  };

  const handleDecision = async (loanId: string, decision: 'approved' | 'rejected', reason?: string) => {
    try {
      const { error } = await supabase.from('chama_loans').update({
        chairperson_decision: decision,
        status: decision,
        reject_reason: reason || null,
        disbursed_at: decision === 'approved' ? new Date().toISOString() : null
      } as any).eq('id', loanId);
      
      if (error) throw error;
      toast({ title: `Loan ${decision}!` });
      setRejectOpen(null);
      setRejectReason('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (!loanEnabled) {
    return (
      <Card className="p-12 text-center border-dashed border-border/40">
        <Landmark size={48} className="mx-auto text-muted-foreground/30 mb-4" />
        <h3 className="font-bold text-muted-foreground italic">Loan applications are disabled for this group.</h3>
      </Card>
    );
  }

  const isEligible = userSavings >= minSavingsRequired && !hasArrears && !activeLoan && !probationStatus.isUnder;

  return (
    <div className="space-y-4">
      {/* Probation Message */}
      {probationStatus.isUnder && (
        <Alert className="bg-amber-500/10 border-amber-500/30 border-2 shadow-sm">
          <AlertCircle className="h-5 w-5 text-amber-400" />
          <AlertTitle className="text-amber-300 font-black text-xs uppercase">Probationary Period</AlertTitle>
          <AlertDescription className="text-amber-200 font-bold">
            You must be a member for {group.new_member_probation_months} months. Unlocks in <span className="underline decoration-2">{probationStatus.remaining} months</span>.
          </AlertDescription>
        </Alert>
      )}

      {/* Info Boxes - High Contrast Visibility Fix */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center border-border/40">
          <p className="text-[10px] text-muted-foreground font-black uppercase">Max Limit</p>
          <p className="text-sm font-black text-foreground">KES {maxAmount.toLocaleString()}</p>
        </Card>
        <Card className="p-3 text-center border-border/40">
          <p className="text-[10px] text-primary font-black uppercase">Min Needed</p>
          <p className="text-sm font-black text-foreground">KES {minSavingsRequired.toLocaleString()}</p>
        </Card>
        <Card className="p-3 text-center border-border/40">
          <p className="text-[10px] text-muted-foreground font-black uppercase">Interest</p>
          <p className="text-sm font-black text-foreground">{interestRate}%</p>
        </Card>
      </div>

      <Button 
        onClick={() => setApplyOpen(true)} 
        className="w-full h-14 text-lg font-black shadow-lg transition-all active:scale-95" 
        disabled={!isEligible || loading}
      >
        {isEligible ? 'Apply for Loan' : 'Check Eligibility Requirements'}
      </Button>

      {/* History Card */}
      <Card className="overflow-hidden border-border/40">
        <div className="p-4 bg-[hsl(var(--navy-800))] flex items-center gap-2">
          <Receipt size={18} className="text-accent" />
          <h3 className="font-black text-sm uppercase tracking-tight text-foreground">Loan Transactions</h3>
        </div>
        
        <div className="divide-y divide-border/20">
          {loans.length === 0 ? (
            <p className="p-10 text-center text-muted-foreground font-medium">No transactions found</p>
          ) : (
            loans.map(loan => (
              <div key={loan.id} className="p-4 hover:bg-muted/20 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-black text-foreground">{getMemberName((loan as any).borrower_id || loan.user_id)}</p>
                    <p className="text-[10px] text-muted-foreground font-bold">{format(new Date(loan.created_at), 'PPP')}</p>
                  </div>
                  <div className={`text-[10px] px-3 py-1 rounded-full font-black uppercase ${
                    loan.status === 'pending' ? 'bg-amber-500/15 text-amber-400' : 
                    loan.status === 'approved' ? 'bg-emerald-500/15 text-emerald-400' : 
                    loan.status === 'rejected' ? 'bg-rose-500/15 text-rose-400' : 'bg-muted text-muted-foreground'
                  }`}>
                    {loan.status}
                  </div>
                </div>

                <div className="flex justify-between items-center bg-muted/30 p-3 rounded-xl border border-border/30">
                   <div className="text-[11px] text-muted-foreground font-bold uppercase">
                     Principal: <span className="text-foreground font-black ml-1">KES {loan.amount.toLocaleString()}</span>
                   </div>
                   <div className="text-[11px] text-primary font-bold uppercase">
                     Due: <span className="text-primary font-black ml-1 underline">KES {loan.total_repayment.toLocaleString()}</span>
                   </div>
                </div>

                {isChair && loan.status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 font-black" onClick={() => handleDecision(loan.id, 'approved')}>
                      APPROVE
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 text-rose-400 border-rose-500/30 font-black" onClick={() => setRejectOpen(loan.id)}>
                      REJECT
                    </Button>
                  </div>
                )}
                
                {loan.reject_reason && (
                  <div className="mt-3 p-3 bg-rose-500/10 text-rose-300 text-[11px] rounded-lg border border-rose-500/20 font-medium italic">
                    <span className="font-black uppercase not-italic mr-1 text-rose-400">Rejection Note:</span> {loan.reject_reason}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Apply Modal */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle className="text-2xl font-black">Borrow Funds</DialogTitle></DialogHeader>
          <div className="space-y-6 pt-4">
            <div className="space-y-2">
              <Label className="text-[10px] text-muted-foreground font-black uppercase">Loan Amount (KES)</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder="0.00"
                className="h-16 text-3xl font-black border-2 focus:border-primary" 
              />
            </div>
            <div className="bg-[hsl(var(--navy-800))] p-6 rounded-2xl">
              <div className="flex justify-between font-black text-xl">
                <span className="text-muted-foreground">Total Due</span>
                <span className="text-emerald-400 font-black">
                  KES {amount ? Math.round(Number(amount) * (1 + interestRate / 100)).toLocaleString() : 0}
                </span>
              </div>
            </div>
            <Button onClick={handleApply} disabled={applying} className="w-full h-16 text-xl font-black shadow-xl">
              {applying ? 'Processing...' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Modal */}
      <Dialog open={!!rejectOpen} onOpenChange={() => setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-red-600 font-black uppercase">Reject Loan Request</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <Label className="text-muted-foreground font-black uppercase text-[10px]">Reason for Rejection</Label>
            <Textarea 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)} 
              placeholder="Provide context for the member..."
              className="resize-none h-32"
            />
            <Button variant="destructive" onClick={() => rejectOpen && handleDecision(rejectOpen, 'rejected', rejectReason)} className="w-full h-12 font-black">
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
 
