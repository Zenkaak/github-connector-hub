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
import { format } from 'date-fns';

interface Props {
  groupId: string;
  group: any;
  members: Array<{ 
    user_id: string; 
    role: string; 
    joined_at: string; 
    profile?: { full_name: string } 
  }>;
  myRole: string;
}

export function ChamaLoans({ groupId, group, members, myRole }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State Management
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [applying, setApplying] = useState(false);
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  
  // Eligibility State
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
          l.borrower_id === user.id && ['pending', 'approved', 'active', 'disbursed'].includes(l.status)
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

      // 3. Check Arrears/Penalties
      const { data: penaltyData } = await supabase
        .from('chama_penalties')
        .select('id')
        .eq('user_id', user.id)
        .eq('group_id', groupId)
        .eq('status', 'unpaid')
        .limit(1);
      setHasArrears(!!penaltyData?.length);

      // 4. PRECISE Probation Calculation
      const myMemberRecord = members.find(m => m.user_id === user.id);
      if (myMemberRecord && group.new_member_probation_months > 0) {
        const joinedDate = new Date(myMemberRecord.joined_at);
        const now = new Date();
        
        const probationEndDate = new Date(joinedDate);
        probationEndDate.setMonth(joinedDate.getMonth() + group.new_member_probation_months);
        
        const isUnder = now < probationEndDate;
        
        // Exact month diff
        let monthsLeft = (probationEndDate.getFullYear() - now.getFullYear()) * 12 + 
                         (probationEndDate.getMonth() - now.getMonth());
        
        // Adjust if current day hasn't reached join day yet
        if (now.getDate() < joinedDate.getDate() && monthsLeft > 0) {
          // Keep current monthsLeft
        } else if (now.getDate() >= joinedDate.getDate() && monthsLeft > 0) {
          // If we passed the day of the month, the "remaining" whole months is less
          monthsLeft = Math.max(1, monthsLeft);
        }

        setProbationStatus({ isUnder, remaining: isUnder ? Math.max(1, monthsLeft) : 0 });
      }
    } catch (err) {
      console.error("Error fetching loan data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [groupId, user, members]);

  const getMemberName = (uid: string) => members.find(m => m.user_id === uid)?.profile?.full_name || 'Unknown Member';

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
        user_id: user.id, // Compatibility for some schemas
        amount: amt,
        interest_rate: interestRate,
        total_repayment: totalRepayment,
        duration_months: maxDuration,
        outstanding_balance: totalRepayment,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending'
      } as any);

      if (error) throw new Error(error.message);

      toast({ title: 'Application Sent', description: 'Your request is pending chairperson approval.' });
      setApplyOpen(false);
      setAmount('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Request Failed', description: error.message, variant: 'destructive' });
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

      toast({ title: `Loan ${decision}` });
      setRejectOpen(null);
      setRejectReason('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (!loanEnabled) {
    return (
      <Card className="p-8 text-center border-dashed">
        <Landmark size={40} className="mx-auto text-muted-foreground/20 mb-3" />
        <h3 className="font-semibold text-muted-foreground">Lending is Currently Disabled</h3>
      </Card>
    );
  }

  const isEligible = userSavings >= minSavingsRequired && !hasArrears && !activeLoan && !probationStatus.isUnder;

  return (
    <div className="space-y-4">
      {/* Blockers */}
      {activeLoan && (
        <Alert className="border-blue-200 bg-blue-50/50">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800 text-xs font-bold uppercase tracking-tight">Active Loan Found</AlertTitle>
          <AlertDescription className="text-blue-700 text-sm">
            You currently have a <strong>{activeLoan.status}</strong> loan. Clear it to borrow again.
          </AlertDescription>
        </Alert>
      )}

      {hasArrears && (
        <Alert variant="destructive" className="bg-red-50 border-red-100">
          <Ban className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-red-800 text-xs font-bold">Outstanding Arrears</AlertTitle>
          <AlertDescription className="text-red-700 text-sm">
            Please pay your pending penalties/arrears to unlock borrowing.
          </AlertDescription>
        </Alert>
      )}

      {probationStatus.isUnder && (
        <Alert className="bg-amber-50 border-amber-100">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800 text-xs font-bold uppercase">Probation Period</AlertTitle>
          <AlertDescription className="text-amber-700 text-sm">
            Eligibility unlocks in <strong>{probationStatus.remaining} {probationStatus.remaining === 1 ? 'month' : 'months'}</strong>.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 text-center border-none bg-muted/40 shadow-none">
          <p className="text-[10px] text-muted-foreground font-bold uppercase">Limit</p>
          <p className="text-sm font-black">KES {maxAmount.toLocaleString()}</p>
        </Card>
        <Card className="p-3 text-center border-none bg-primary/5 shadow-none">
          <p className="text-[10px] text-primary/70 font-bold uppercase">Min Savings</p>
          <p className="text-sm font-black text-primary">KES {minSavingsRequired.toLocaleString()}</p>
        </Card>
        <Card className="p-3 text-center border-none bg-muted/40 shadow-none">
          <p className="text-[10px] text-muted-foreground font-bold uppercase">Interest</p>
          <p className="text-sm font-black">{interestRate}%</p>
        </Card>
      </div>

      <Button 
        onClick={() => setApplyOpen(true)} 
        className="w-full h-12 text-md font-bold transition-all active:scale-95"
        disabled={!isEligible || loading}
      >
        {loading ? 'Validating...' : isEligible ? 'Apply for Loan' : 'Ineligible to Borrow'}
      </Button>

      {/* History */}
      <Card className="overflow-hidden border-muted/60">
        <div className="p-4 bg-muted/10 border-b flex items-center gap-2">
          <Receipt size={16} className="text-muted-foreground" />
          <h3 className="font-bold text-sm">Loan Transactions</h3>
        </div>
        
        <div className="divide-y divide-muted/30">
          {loans.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground italic">No loan records found</div>
          ) : (
            loans.map(loan => (
              <div key={loan.id} className="p-4 hover:bg-muted/5 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{getMemberName(loan.borrower_id)}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {format(new Date(loan.created_at), 'PPP')}
                    </p>
                  </div>
                  <div className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tighter ${
                    loan.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                    loan.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                    loan.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {loan.status}
                  </div>
                </div>

                <div className="flex justify-between items-center bg-muted/20 p-2 rounded-md">
                   <div className="text-[11px]">
                     <span className="text-muted-foreground">Borrowed:</span> 
                     <span className="ml-1 font-bold">KES {loan.amount.toLocaleString()}</span>
                   </div>
                   <div className="text-[11px]">
                     <span className="text-muted-foreground">Due:</span> 
                     <span className="ml-1 font-bold text-primary">KES {loan.total_repayment.toLocaleString()}</span>
                   </div>
                </div>

                {isChair && loan.status === 'pending' && (
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-8" onClick={() => handleDecision(loan.id, 'approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 border-red-200 text-red-600 hover:bg-red-50 h-8" onClick={() => setRejectOpen(loan.id)}>
                      Reject
                    </Button>
                  </div>
                )}
                
                {loan.reject_reason && (
                  <div className="mt-3 p-2 bg-red-50/50 border border-red-100 rounded text-[11px] text-red-700">
                    <strong>Rejection Note:</strong> {loan.reject_reason}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Dialogs */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle className="text-xl">Borrow Funds</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-bold">Amount to Request</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-bold text-muted-foreground">KES</span>
                <Input 
                  type="number" 
                  value={amount} 
                  onChange={e => setAmount(e.target.value)} 
                  placeholder="0.00"
                  className="pl-12 h-12 text-lg font-black" 
                />
              </div>
            </div>
            
            <div className="bg-slate-900 text-white p-4 rounded-xl space-y-3">
              <div className="flex justify-between text-xs opacity-70">
                <span>Interest ({interestRate}%)</span>
                <span>KES {amount ? Math.round(Number(amount) * (interestRate / 100)).toLocaleString() : 0}</span>
              </div>
              <div className="flex justify-between font-black border-t border-white/10 pt-2">
                <span>Total Payable</span>
                <span className="text-primary-foreground">
                  KES {amount ? Math.round(Number(amount) * (1 + interestRate / 100)).toLocaleString() : 0}
                </span>
              </div>
            </div>

            <Button onClick={handleApply} disabled={applying} className="w-full h-12">
              {applying ? 'Processing...' : 'Submit Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectOpen} onOpenChange={() => setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Loan Request</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Label>Reason for rejection</Label>
            <Textarea 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)} 
              placeholder="e.g. Does not meet secondary criteria..."
              rows={3} 
            />
            <Button variant="destructive" onClick={() => rejectOpen && handleDecision(rejectOpen, 'rejected', rejectReason)} className="w-full h-11">
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
 
