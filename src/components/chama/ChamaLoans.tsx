import { useState, useEffect } from 'react';
import { Landmark, Plus, Check, X, AlertCircle, Clock, Ban } from 'lucide-react';
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
        // Check if current user has an active/pending loan
        const myActive = loanData.find(l => 
          l.borrower_id === user.id && ['pending', 'approved', 'active'].includes(l.status)
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

      // 4. Calculate Probation
      const myMemberRecord = members.find(m => m.user_id === user.id);
      if (myMemberRecord && group.new_member_probation_months > 0) {
        const joinedDate = new Date(myMemberRecord.joined_at);
        const probationEndDate = new Date(joinedDate);
        probationEndDate.setMonth(joinedDate.getMonth() + group.new_member_probation_months);
        
        const isUnder = new Date() < probationEndDate;
        const diffTime = probationEndDate.getTime() - new Date().getTime();
        const diffMonths = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 30));
        setProbationStatus({ isUnder, remaining: diffMonths });
      }
    } catch (err) {
      console.error("Error fetching loan data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [groupId, user, members]);

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
        user_id: user.id,
        borrower_id: user.id,
        amount: amt,
        interest_rate: interestRate,
        total_repayment: totalRepayment,
        duration_months: maxDuration,
        outstanding_balance: totalRepayment,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending'
      } as any);

      if (error) throw new Error(error.message);

      toast({ title: 'Success', description: 'Loan application submitted for review.' });
      setApplyOpen(false);
      setAmount('');
      fetchData();
    } catch (error: any) {
      toast({ 
        title: 'Application Blocked', 
        description: error.message, 
        variant: 'destructive' 
      });
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

      toast({ title: `Loan ${decision} successfully` });
      setRejectOpen(null);
      setRejectReason('');
      fetchData();
    } catch (error: any) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    }
  };

  if (!loanEnabled) {
    return (
      <Card className="p-8 text-center">
        <Landmark size={40} className="mx-auto text-muted-foreground/30 mb-3" />
        <h3 className="font-semibold mb-1">Lending Disabled</h3>
        <p className="text-sm text-muted-foreground">The chairperson has not enabled the loan feature.</p>
      </Card>
    );
  }

  // Final Eligibility Logic
  const isEligible = userSavings >= minSavingsRequired && !hasArrears && !activeLoan && !probationStatus.isUnder;

  return (
    <div className="space-y-4">
      {/* Dynamic Blocker Alerts */}
      {activeLoan && (
        <Alert className="bg-blue-50 border-blue-200">
          <Clock className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-800">Pending Application</AlertTitle>
          <AlertDescription className="text-blue-700">
            You already have a {activeLoan.status} loan of KES {activeLoan.amount.toLocaleString()}.
          </AlertDescription>
        </Alert>
      )}

      {hasArrears && (
        <Alert variant="destructive" className="bg-destructive/5">
          <Ban className="h-4 w-4" />
          <AlertTitle>Unpaid Penalties</AlertTitle>
          <AlertDescription>
            You must clear all outstanding penalties and arrears before applying for a loan.
          </AlertDescription>
        </Alert>
      )}

      {probationStatus.isUnder && (
        <Alert className="bg-amber-50 border-amber-200">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-800">Probation Period</AlertTitle>
          <AlertDescription className="text-amber-700">
            New members must wait {group.new_member_probation_months} months. You have {probationStatus.remaining} months left.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 bg-muted/20 border-none shadow-none text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Your Savings</p>
          <p className="text-sm font-black">KES {userSavings.toLocaleString()}</p>
        </Card>
        <Card className="p-3 bg-muted/20 border-none shadow-none text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Min Needed</p>
          <p className="text-sm font-black text-primary">KES {minSavingsRequired.toLocaleString()}</p>
        </Card>
        <Card className="p-3 bg-muted/20 border-none shadow-none text-center">
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Limit</p>
          <p className="text-sm font-black">KES {maxAmount.toLocaleString()}</p>
        </Card>
      </div>

      <Button 
        onClick={() => setApplyOpen(true)} 
        className="w-full h-12 text-md font-bold"
        disabled={!isEligible || loading}
      >
        {loading ? 'Verifying...' : isEligible ? 'Apply for Loan' : 'Ineligible to Borrow'}
      </Button>

      {/* Loan History Table */}
      <Card className="overflow-hidden border-muted/40">
        <div className="p-4 bg-muted/10 border-b flex justify-between items-center">
          <h3 className="font-bold text-sm">Loan Activity</h3>
          <span className="text-[10px] text-muted-foreground bg-white px-2 py-0.5 rounded border">
            {loans.length} Total
          </span>
        </div>
        
        <div className="divide-y divide-muted/30">
          {loans.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No loan history found.</div>
          ) : (
            loans.map(loan => (
              <div key={loan.id} className="p-4 hover:bg-muted/5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-bold">{getMemberName(loan.borrower_id)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(loan.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className={`text-[10px] px-2 py-1 rounded font-black uppercase ${
                    loan.status === 'pending' ? 'bg-amber-100 text-amber-700' : 
                    loan.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {loan.status}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-muted/10 p-2 rounded">
                  <p><span className="text-muted-foreground">Principal:</span> KES {loan.amount.toLocaleString()}</p>
                  <p><span className="text-muted-foreground">Total Due:</span> KES {loan.total_repayment.toLocaleString()}</p>
                </div>

                {isChair && loan.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="flex-1 bg-emerald-600" onClick={() => handleDecision(loan.id, 'approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 border-destructive text-destructive" onClick={() => setRejectOpen(loan.id)}>
                      Reject
                    </Button>
                  </div>
                )}
                
                {loan.reject_reason && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded flex gap-2 items-start">
                    <X size={12} className="text-red-500 mt-0.5" />
                    <p className="text-[11px] text-red-700 italic">{loan.reject_reason}</p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Application Dialog */}
      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request New Loan</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Loan Amount (KES)</Label>
              <Input 
                type="number" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                placeholder={`Maximum ${maxAmount.toLocaleString()}`}
                className="text-lg font-bold h-12" 
              />
            </div>
            
            <div className="bg-muted/30 p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Interest Rate</span>
                <span className="font-bold">{interestRate}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-bold">{maxDuration} Months</span>
              </div>
              {amount && (
                <div className="flex justify-between text-md pt-2 border-t font-black text-primary">
                  <span>Payback Total</span>
                  <span>KES {Math.round(parseInt(amount) * (1 + interestRate / 100)).toLocaleString()}</span>
                </div>
              )}
            </div>

            <Button onClick={handleApply} disabled={applying} className="w-full h-12">
              {applying ? 'Verifying with Database...' : 'Confirm Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={() => setRejectOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Decline Application</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Label>Reason for rejection</Label>
            <Textarea 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)} 
              placeholder="e.g. Outstanding arrears not shown in system..."
              rows={3} 
            />
            <Button variant="destructive" onClick={() => rejectOpen && handleDecision(rejectOpen, 'rejected', rejectReason)} className="w-full">
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
