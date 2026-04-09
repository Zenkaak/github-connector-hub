import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, AlertCircle, CreditCard, Calendar, TrendingUp, Wallet, Loader2, CheckCircle, Receipt, Clock, Hash, Smartphone } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ActivationModal } from '@/components/ActivationModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LoanApplication {
  id: string;
  loan_type: string;
  applied_amount: number;
  generated_limit: number;
  employment_status: string;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed';
  admin_message: string | null;
  created_at: string;
}

interface Disbursement {
  id: string;
  loan_id: string;
  disbursed_amount: number;
  outstanding_balance: number;
  monthly_repayment: number;
  interest_rate: number;
  repayment_due_date: string;
  status: string;
  disbursed_at: string;
}

interface RepaymentRecord {
  id: string;
  amount: number;
  mpesa_receipt: string | null;
  status: string;
  created_at: string;
  paid_at: string | null;
  reference: string;
}

export default function LoanApplicationsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [disbursements, setDisbursements] = useState<Disbursement[]>([]);
  const [repayments, setRepayments] = useState<Record<string, RepaymentRecord[]>>({});
  const [loading, setLoading] = useState(true);
  const [showActivation, setShowActivation] = useState(false);
  const [selectedApp, setSelectedApp] = useState<LoanApplication | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayLoading, setRepayLoading] = useState(false);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchData();
    if (location.state?.showActivation) setShowActivation(true);
  }, [user, location]);

  const fetchData = async () => {
    try {
      const [appRes, disbRes] = await Promise.all([
        supabase.from('loan_applications').select('*').eq('user_id', user?.id).order('created_at', { ascending: false }),
        supabase.from('loan_disbursements').select('*').eq('user_id', user?.id).order('created_at', { ascending: false }),
      ]);
      if (appRes.data) setApplications(appRes.data as LoanApplication[]);
      if (disbRes.data) {
        setDisbursements(disbRes.data as Disbursement[]);
        // Fetch repayment records for each disbursement
        const repMap: Record<string, RepaymentRecord[]> = {};
        for (const disb of disbRes.data) {
          const { data: reps } = await supabase
            .from('stk_transactions')
            .select('id, amount, mpesa_receipt, status, created_at, paid_at, reference')
            .eq('purpose', 'loan_repayment')
            .eq('disbursement_id', disb.id)
            .order('created_at', { ascending: false });
          if (reps) repMap[disb.loan_id] = reps as RepaymentRecord[];
        }
        setRepayments(repMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

  const handleActivationSuccess = () => {
    setShowActivation(false);
    refreshProfile();
  };

  const getDisbursement = (loanId: string) => disbursements.find((d) => d.loan_id === loanId);

  const [repayStep, setRepayStep] = useState<'form' | 'polling' | 'success' | 'failed'>('form');

  const handleRepayViaStk = async () => {
    if (!selectedApp || !repayAmount || !profile?.phone) return;
    const disb = getDisbursement(selectedApp.id);
    if (!disb) return;
    setRepayLoading(true);
    setRepayStep('polling');
    try {
      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: { phone: profile.phone, amount: Number(repayAmount), userId: user!.id, loanId: selectedApp.id, disbursementId: disb.id, purpose: 'loan_repayment' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const pollStatus = async (attempts = 0): Promise<boolean> => {
        if (attempts >= 30) throw new Error('Payment timeout. Please check your M-Pesa messages.');
        await new Promise((r) => setTimeout(r, 3000));
        const { data: statusData, error: statusErr } = await supabase.functions.invoke('check-stk-status', {
          body: { reference: data.reference },
        });
        if (statusErr) throw statusErr;
        if (statusData.status === 'success') return true;
        if (statusData.status === 'failed') throw new Error(statusData.message || 'Payment failed');
        return pollStatus(attempts + 1);
      };

      const success = await pollStatus();
      if (success) {
        setRepayStep('success');
        toast.success('Repayment received successfully!');
        fetchData();
        setTimeout(() => {
          setSelectedApp(null);
          setRepayAmount('');
          setRepayStep('form');
        }, 2500);
      }
    } catch (err: any) {
      setRepayStep('failed');
      toast.error(err.message || 'Payment initiation failed');
    } finally {
      setRepayLoading(false);
    }
  };

  const handleRepayClose = () => {
    setSelectedApp(null);
    setRepayAmount('');
    setRepayStep('form');
  };

  return (
    <DashboardLayout>
      <div className="p-5 lg:p-8 space-y-6 max-w-[1000px]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">My Applications</h1>
            <p className="text-sm text-muted-foreground mt-1">Track and manage your loan applications</p>
          </div>
          {!profile?.is_active && (
            <Button variant="gold" size="sm" onClick={() => setShowActivation(true)}>
              <AlertCircle size={14} />
              Activate (KES 349)
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner w-8 h-8 border-primary border-t-transparent" />
          </div>
        ) : applications.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <FileText className="text-muted-foreground" size={28} />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">No Applications Yet</h3>
              <p className="text-muted-foreground text-sm text-center max-w-md">
                You haven't applied for any loans yet. Browse our products and apply for one that suits your needs.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {applications.map((app, i) => {
              const disb = getDisbursement(app.id);
              const totalToPay = disb ? disb.outstanding_balance : null;
              const interestAmount = disb ? disb.outstanding_balance - disb.disbursed_amount : null;
              const daysUntilDue = disb ? Math.ceil((new Date(disb.repayment_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
              const totalOwed = disb ? disb.disbursed_amount * (1 + disb.interest_rate / 100) : 0;
              const totalPaid = totalOwed - (disb?.outstanding_balance || 0);
              const repaymentProgress = totalOwed > 0 ? Math.max(0, Math.min(100, (totalPaid / totalOwed) * 100)) : 0;
              const loanRepayments = repayments[app.id] || [];
              const isExpanded = expandedLoan === app.id;

              return (
                <motion.div
                  key={app.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="border-border/50 hover:shadow-md transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <CreditCard className="text-primary" size={18} />
                          </div>
                          <div>
                            <h3 className="font-semibold capitalize">{app.loan_type.replace('_', ' ')} Loan</h3>
                            <p className="text-xs text-muted-foreground">
                              {new Date(app.created_at).toLocaleDateString('en-KE', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={app.status} />
                      </div>

                      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Applied</p>
                          <p className="font-bold text-base">{formatCurrency(app.applied_amount)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Limit</p>
                          <p className="font-bold text-base">{formatCurrency(app.generated_limit)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Employment</p>
                          <p className="font-medium text-sm capitalize">{app.employment_status.replace('_', ' ')}</p>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-0.5">Status</p>
                          <p className="font-medium text-sm capitalize">{app.status}</p>
                        </div>
                      </div>

                      {/* Repayment Details for approved/disbursed loans */}
                      {disb && (app.status === 'approved' || app.status === 'disbursed') && (
                        <div className="mt-4 p-4 rounded-xl bg-muted/40 border border-border/50 space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                            <TrendingUp size={14} className="text-accent" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Repayment Schedule</h4>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Disbursed</p>
                              <p className="font-bold text-sm text-success">{formatCurrency(disb.disbursed_amount)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Interest ({disb.interest_rate}%)</p>
                              <p className="font-bold text-sm text-accent">{formatCurrency(totalOwed - disb.disbursed_amount)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Total Paid</p>
                              <p className="font-bold text-sm text-emerald-400">{formatCurrency(totalPaid)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-muted-foreground uppercase">Outstanding</p>
                              <p className="font-bold text-sm text-rose-400">{formatCurrency(disb.outstanding_balance)}</p>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Repayment Progress</span>
                              <span className="font-bold">{Math.round(repaymentProgress)}%</span>
                            </div>
                            <Progress value={repaymentProgress} className="h-2.5" />
                          </div>

                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Calendar size={12} className="text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                Due: {new Date(disb.repayment_due_date).toLocaleDateString('en-KE', { month: 'long', day: 'numeric', year: 'numeric' })}
                                {daysUntilDue !== null && (
                                  <span className={cn('ml-1 font-semibold', daysUntilDue <= 3 ? 'text-destructive' : daysUntilDue <= 7 ? 'text-accent' : 'text-success')}>
                                    ({daysUntilDue > 0 ? `${daysUntilDue} days left` : 'Overdue'})
                                  </span>
                                )}
                              </span>
                            </div>
                            {disb.outstanding_balance > 0 && (
                              <Button
                                variant="gold"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => {
                                  setSelectedApp(app);
                                  setRepayAmount(String(disb.outstanding_balance));
                                }}
                              >
                                <Wallet size={12} /> Pay via M-Pesa
                              </Button>
                            )}
                          </div>

                          {/* Repayment History */}
                          {loanRepayments.length > 0 && (
                            <div className="mt-2">
                              <button
                                onClick={() => setExpandedLoan(isExpanded ? null : app.id)}
                                className="flex items-center gap-2 text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
                              >
                                <Receipt size={12} />
                                {isExpanded ? 'Hide' : 'View'} Repayment History ({loanRepayments.length})
                              </button>

                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="mt-3 space-y-2"
                                >
                                  {loanRepayments.map((rep) => (
                                    <div key={rep.id} className="p-3 rounded-lg bg-background/60 border border-border/30 flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className={cn(
                                          "w-8 h-8 rounded-lg flex items-center justify-center",
                                          rep.status === 'success' ? "bg-emerald-500/10" : rep.status === 'pending' ? "bg-amber-500/10" : "bg-rose-500/10"
                                        )}>
                                          {rep.status === 'success' ? <CheckCircle size={14} className="text-emerald-400" /> :
                                           rep.status === 'pending' ? <Clock size={14} className="text-amber-400" /> :
                                           <AlertCircle size={14} className="text-rose-400" />}
                                        </div>
                                        <div>
                                          <p className="text-xs font-bold text-foreground">{formatCurrency(rep.amount)}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[9px] text-muted-foreground">
                                              {new Date(rep.paid_at || rep.created_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })}
                                            </span>
                                            {rep.mpesa_receipt && (
                                              <Badge variant="outline" className="text-[8px] h-4 px-1.5 font-mono">
                                                {rep.mpesa_receipt}
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <Badge className={cn("text-[8px] font-bold",
                                        rep.status === 'success' ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                                        rep.status === 'pending' ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                                        "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                      )}>
                                        {rep.status === 'success' ? 'Paid' : rep.status === 'pending' ? 'Pending' : 'Failed'}
                                      </Badge>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </div>
                          )}

                          {/* Till Number Info */}
                          <div className="p-2 rounded-lg bg-muted/30 border border-border/30 mt-1">
                            <p className="text-[10px] text-muted-foreground">You can also pay directly via M-Pesa Buy Goods:</p>
                            <p className="text-xs font-bold">Till: 8448104 (DASNET VENTURES LTD)</p>
                          </div>

                          <div className={cn('text-[10px] font-semibold px-2 py-1 rounded-full w-fit',
                            disb.status === 'active' ? 'bg-accent/10 text-accent' :
                            disb.status === 'paid' ? 'bg-success/10 text-success' :
                            'bg-muted text-muted-foreground'
                          )}>
                            {disb.status === 'active' ? '● Active Loan' : disb.status === 'paid' ? '✓ Fully Paid' : disb.status}
                          </div>
                        </div>
                      )}

                      {app.admin_message && (
                        <div className="mt-4 p-3.5 rounded-xl bg-muted/50 border border-border/50">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Admin Message</p>
                          <p className="text-sm">{app.admin_message}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Repay via STK Dialog */}
        <Dialog open={!!selectedApp} onOpenChange={(o) => !o && handleRepayClose()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet size={18} /> Repay via M-Pesa
              </DialogTitle>
            </DialogHeader>

            {repayStep === 'form' && selectedApp && (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
                  <p className="text-xs text-muted-foreground">Outstanding Balance</p>
                  <p className="text-2xl font-bold font-display text-primary">
                    {formatCurrency(getDisbursement(selectedApp.id)?.outstanding_balance || 0)}
                  </p>
                </div>
                <div>
                  <Label className="text-xs">Amount to Pay (KES)</Label>
                  <Input type="number" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} placeholder="Enter amount" className="mt-1" />
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-1">
                  <p className="text-xs text-muted-foreground">STK Push will be sent to:</p>
                  <p className="font-semibold text-sm">{profile?.phone || '—'}</p>
                  <p className="text-xs text-muted-foreground mt-2">Or pay directly via M-Pesa Buy Goods:</p>
                  <p className="font-semibold text-sm">Till: 8448104 (DASNET VENTURES LTD)</p>
                </div>
                <p className="text-xs text-muted-foreground">An M-Pesa STK push will be sent to your phone. Enter your M-Pesa PIN to complete the payment.</p>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleRepayClose}>Cancel</Button>
                  <Button variant="gold" onClick={handleRepayViaStk} disabled={repayLoading || !repayAmount || Number(repayAmount) <= 0}>Pay Now</Button>
                </div>
              </div>
            )}

            {repayStep === 'polling' && (
              <div className="py-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
                  <Loader2 className="animate-spin text-accent" size={32} />
                </div>
                <h3 className="font-semibold text-lg mb-2">Processing Payment</h3>
                <p className="text-muted-foreground text-sm">Please check your phone and enter your M-Pesa PIN to complete the repayment.</p>
              </div>
            )}

            {repayStep === 'success' && (
              <div className="py-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle className="text-success" size={32} />
                </div>
                <h3 className="font-semibold text-lg mb-2">Payment Received!</h3>
                <p className="text-muted-foreground text-sm">Your loan repayment has been processed successfully.</p>
              </div>
            )}

            {repayStep === 'failed' && (
              <div className="py-8 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="text-destructive" size={32} />
                </div>
                <h3 className="font-semibold text-lg mb-2">Payment Failed</h3>
                <p className="text-muted-foreground text-sm mb-4">The payment could not be completed. Please try again.</p>
                <Button variant="gold" onClick={() => setRepayStep('form')}>Retry</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ActivationModal
          open={showActivation}
          onClose={() => setShowActivation(false)}
          onSuccess={handleActivationSuccess}
        />
      </div>
    </DashboardLayout>
  );
}
