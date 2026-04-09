import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  PiggyBank, Lock, Target, Plus, ArrowRight, Clock, CheckCircle2,
  TrendingUp, Calendar, Loader2, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { FeatureDisabled } from '@/components/FeatureDisabled';

interface PersonalSavings {
  id: string;
  user_id: string;
  name: string;
  type: 'target' | 'lock';
  target_amount: number;
  saved_amount: number;
  interest_rate: number;
  start_date: string;
  maturity_date: string;
  status: string;
  created_at: string;
}

interface SavingsDeposit {
  id: string;
  savings_id: string;
  amount: number;
  stk_reference: string | null;
  created_at: string;
}

interface WithdrawalRequest {
  id: string;
  savings_id: string;
  reason: string;
  penalty_percentage: number;
  status: string;
  admin_reason: string | null;
  created_at: string;
}

export default function SavingsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { isEnabled } = usePlatformSettings();
  const savingsDisabled = !isEnabled('savings_enabled');
  const [savings, setSavings] = useState<PersonalSavings[]>([]);
  const [deposits, setDeposits] = useState<SavingsDeposit[]>([]);
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [selectedSavings, setSelectedSavings] = useState<PersonalSavings | null>(null);
  const [selectedWithdrawalRequest, setSelectedWithdrawalRequest] = useState<WithdrawalRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stkPolling, setStkPolling] = useState(false);
  const [receiptDeposit, setReceiptDeposit] = useState<SavingsDeposit | null>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'target' | 'lock'>('target');
  const [newTarget, setNewTarget] = useState('');
  const [newDuration, setNewDuration] = useState('6');

  // Deposit form
  const [depositAmount, setDepositAmount] = useState('');
  const [initialDeposit, setInitialDeposit] = useState('');

  // Withdraw form
  const [withdrawReason, setWithdrawReason] = useState('');

  useEffect(() => {
    if (user) fetchAll();
  }, [user]);

  const fetchAll = async () => {
    const [{ data: s }, { data: d }, { data: w }] = await Promise.all([
      supabase.from('personal_savings').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('personal_savings_deposits').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
      supabase.from('savings_withdrawal_requests').select('*').eq('user_id', user!.id).order('created_at', { ascending: false }),
    ]);
    setSavings((s || []) as PersonalSavings[]);
    setDeposits((d || []) as SavingsDeposit[]);
    setWithdrawalRequests((w || []) as WithdrawalRequest[]);
    setLoading(false);
  };

  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;

  const handleCreate = async () => {
    if (!newName || !newTarget || Number(newTarget) < 100) {
      toast.error('Please fill all fields. Minimum target: KES 100');
      return;
    }
    if (!initialDeposit || Number(initialDeposit) < 10) {
      toast.error('Initial deposit required. Minimum: KES 10');
      return;
    }
    if (Number(initialDeposit) > Number(newTarget)) {
      toast.error('Initial deposit cannot exceed target amount');
      return;
    }
    const phone = profile?.phone;
    if (!phone) { toast.error('No phone number found'); return; }

    setSubmitting(true);
    const maturityDate = new Date();
    maturityDate.setMonth(maturityDate.getMonth() + Number(newDuration));

    // Create savings plan first
    const { data: newSavings, error } = await supabase.from('personal_savings').insert({
      user_id: user!.id,
      name: newName,
      type: newType,
      target_amount: Number(newTarget),
      interest_rate: newType === 'lock' ? 10 : 0,
      maturity_date: maturityDate.toISOString().split('T')[0],
    }).select().single();

    if (error || !newSavings) { toast.error('Failed to create savings'); setSubmitting(false); return; }

    // Initiate STK push for initial deposit
    try {
      const { data: stkData, error: stkError } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone,
          amount: Number(initialDeposit),
          userId: user!.id,
          purpose: 'personal_savings',
          savingsId: newSavings.id,
        },
      });

      if (stkError || stkData?.error) throw new Error(stkData?.error || 'STK push failed');
      toast.success('Savings plan created! Complete M-Pesa payment on your phone');
      setCreateOpen(false);
      setNewName(''); setNewTarget(''); setNewType('target'); setNewDuration('6'); setInitialDeposit('');
      setSubmitting(false);

      if (stkData?.reference) {
        setStkPolling(true);
        pollStkStatus(stkData.reference, newSavings.id);
      }
      fetchAll();
    } catch (err: any) {
      toast.error(err.message || 'Payment initiation failed');
      setSubmitting(false);
      fetchAll(); // Still show the created plan
    }
  };

  const handleDeposit = async () => {
    if (!selectedSavings || !depositAmount || Number(depositAmount) < 10) {
      toast.error('Minimum deposit: KES 10');
      return;
    }
    setSubmitting(true);
    try {
      const phone = profile?.phone;
      if (!phone) { toast.error('No phone number found'); setSubmitting(false); return; }

      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone,
          amount: Number(depositAmount),
          userId: user!.id,
          purpose: 'personal_savings',
          savingsId: selectedSavings.id,
        },
      });

      if (error || data?.error) throw new Error(data?.error || 'STK push failed');
      toast.success('M-Pesa prompt sent to your phone!');
      setDepositOpen(false);
      setDepositAmount('');

      // Poll for status
      if (data?.reference) {
        setStkPolling(true);
        pollStkStatus(data.reference, selectedSavings.id);
      }
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    }
    setSubmitting(false);
  };

  const pollStkStatus = async (reference: string, _savingsId: string) => {
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      const { data } = await supabase
        .from('stk_transactions')
        .select('status, amount')
        .eq('reference', reference)
        .single();

      if (data?.status === 'success') {
        clearInterval(poll);
        setStkPolling(false);
        // The mpesa-callback edge function already records the deposit and updates saved_amount
        // Just refresh data here
        toast.success(`KES ${data.amount.toLocaleString()} deposited successfully!`);
        fetchAll();
      } else if (data?.status === 'failed') {
        clearInterval(poll);
        setStkPolling(false);
        toast.error('Payment failed. Please try again.');
      } else if (attempts >= 20) {
        clearInterval(poll);
        setStkPolling(false);
        toast.info('Payment is still processing. Check transactions for updates.');
      }
    }, 3000);
  };

  const handleWithdrawRequest = async () => {
    if (!selectedSavings || !withdrawReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    const existing = withdrawalRequests.find(
      w => w.savings_id === selectedSavings.id && w.status === 'pending'
    );
    if (existing) { toast.error('You already have a pending withdrawal request'); return; }

    setSubmitting(true);
    const { error } = await supabase.rpc('request_savings_withdrawal', {
      _savings_id: selectedSavings.id,
      _user_id: user!.id,
      _reason: withdrawReason,
      _penalty_percentage: 20,
    });

    if (error) { toast.error(error.message || 'Failed to submit request'); setSubmitting(false); return; }

    await supabase.from('notifications').insert({
      user_id: user!.id,
      title: 'Savings Withdrawal Request Submitted',
      message: `Your savings of ${formatCurrency(selectedSavings.saved_amount)} from "${selectedSavings.name}" has been debited and submitted for review. If rejected, funds will be restored. Early withdrawal incurs a 20% penalty.`,
    });

    toast.success('Savings debited. Request submitted for admin review.');
    setWithdrawOpen(false);
    setWithdrawReason('');
    setSubmitting(false);
    fetchAll();
  };

  const totalSaved = savings.reduce((sum, s) => sum + s.saved_amount, 0);
  const totalTarget = savings.reduce((sum, s) => sum + s.target_amount, 0);
  const lockSavings = savings.filter(s => s.type === 'lock');
  const targetSavings = savings.filter(s => s.type === 'target');
  const projectedInterest = lockSavings.reduce((sum, s) => {
    const monthsRemaining = Math.max(0, (new Date(s.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30));
    return sum + (s.saved_amount * (s.interest_rate / 100) * (monthsRemaining / 12));
  }, 0);

  if (savingsDisabled) {
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-8"><FeatureDisabled title="Savings Unavailable" message="Personal savings feature is currently disabled. Please contact support." /></div>
      </DashboardLayout>
    );
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-5 lg:p-8 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted/40 animate-pulse rounded-xl" />)}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-5 lg:p-8 space-y-6 max-w-[1200px]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2">
              <PiggyBank className="text-accent" size={24} /> My Savings
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Grow your money with Target & Lock savings</p>
          </div>
          <Button variant="gold" onClick={() => setCreateOpen(true)} className="shadow-gold">
            <Plus size={16} /> New Savings Plan
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Saved</p>
            <p className="text-xl font-bold text-success">{formatCurrency(totalSaved)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Total Target</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(totalTarget)}</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Lock Savings</p>
            <p className="text-xl font-bold text-accent">{lockSavings.length} plans</p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-muted-foreground">Projected Interest</p>
            <p className="text-xl font-bold text-success">{formatCurrency(Math.round(projectedInterest))}</p>
          </Card>
        </div>

        {/* STK Polling indicator */}
        {stkPolling && (
          <Card className="p-4 border-accent/30 bg-accent/5">
            <div className="flex items-center gap-3">
              <Loader2 className="animate-spin text-accent" size={20} />
              <div>
                <p className="font-semibold text-sm">Processing Payment...</p>
                <p className="text-xs text-muted-foreground">Complete the M-Pesa prompt on your phone</p>
              </div>
            </div>
          </Card>
        )}

        {/* Savings Tabs */}
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All ({savings.length})</TabsTrigger>
            <TabsTrigger value="target">Target ({targetSavings.length})</TabsTrigger>
            <TabsTrigger value="lock">Lock ({lockSavings.length})</TabsTrigger>
          </TabsList>

          {['all', 'target', 'lock'].map(tab => (
            <TabsContent key={tab} value={tab} className="mt-4 space-y-3">
              {(tab === 'all' ? savings : tab === 'target' ? targetSavings : lockSavings).length === 0 ? (
                <Card className="p-8 text-center">
                  <PiggyBank size={32} className="mx-auto mb-3 text-muted-foreground" />
                  <p className="font-medium">No {tab !== 'all' ? tab : ''} savings plans yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Create a savings plan to start growing your money</p>
                  <Button variant="gold" className="mt-4" onClick={() => { setNewType(tab === 'lock' ? 'lock' : 'target'); setCreateOpen(true); }}>
                    <Plus size={14} /> Create Plan
                  </Button>
                </Card>
              ) : (
                (tab === 'all' ? savings : tab === 'target' ? targetSavings : lockSavings).map((s, i) => {
                  const progress = s.target_amount > 0 ? Math.min(100, Math.round((s.saved_amount / s.target_amount) * 100)) : 0;
                  const daysLeft = Math.max(0, Math.ceil((new Date(s.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                  const isMatured = daysLeft === 0;
                  const wr = withdrawalRequests.find(w => w.savings_id === s.id && w.status === 'pending');

                  return (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 * i }}
                    >
                      <Card
                        className="cursor-pointer hover:border-accent/30 transition-all"
                        onClick={() => { setSelectedSavings(s); setDetailOpen(true); }}
                      >
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                'w-10 h-10 rounded-xl flex items-center justify-center',
                                s.type === 'lock' ? 'bg-accent/10' : 'bg-primary/10'
                              )}>
                                {s.type === 'lock' ? <Lock size={18} className="text-accent" /> : <Target size={18} className="text-primary" />}
                              </div>
                              <div>
                                <p className="font-semibold text-sm">{s.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={cn(
                                    'text-[10px] px-2 py-0.5 rounded-full font-medium',
                                    s.type === 'lock' ? 'bg-accent/10 text-accent' : 'bg-primary/10 text-primary'
                                  )}>
                                    {s.type === 'lock' ? '🔒 Lock · 10% p.a.' : '🎯 Target'}
                                  </span>
                                  {isMatured && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success font-medium">Matured</span>}
                                  {wr && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">Withdrawal Pending</span>}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm">{formatCurrency(s.saved_amount)}</p>
                              <p className="text-[10px] text-muted-foreground">of {formatCurrency(s.target_amount)}</p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-muted-foreground">
                              <span>{daysLeft} days left</span>
                              <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="gold"
                              size="sm"
                              className="flex-1 text-xs"
                              onClick={(e) => { e.stopPropagation(); setSelectedSavings(s); setDepositOpen(true); }}
                            >
                              Deposit
                            </Button>
                            {s.saved_amount > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                disabled={!!wr}
                                onClick={(e) => { e.stopPropagation(); setSelectedSavings(s); setWithdrawOpen(true); }}
                              >
                                {wr ? 'Pending...' : isMatured ? 'Withdraw' : 'Request Withdrawal'}
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Recent Deposits */}
        {deposits.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp size={16} className="text-accent" /> Recent Deposits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {deposits.slice(0, 5).map(d => {
                const s = savings.find(sv => sv.id === d.savings_id);
                return (
                  <div
                    key={d.id}
                    role="button"
                    tabIndex={0}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setReceiptDeposit(d)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setReceiptDeposit(d);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                        <CheckCircle2 size={16} className="text-success" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{s?.name || 'Savings'} · {formatCurrency(d.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(d.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-success/10 text-success">Confirmed</span>
                      <ArrowRight size={14} className="text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => navigate('/dashboard/transactions')}>
                View All Transactions <ArrowRight size={14} />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Withdrawal Requests */}
        {withdrawalRequests.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle size={16} className="text-destructive" /> Withdrawal Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {withdrawalRequests.map(wr => {
                const s = savings.find(sv => sv.id === wr.savings_id);
                const estimatedPayout = s ? Math.max(0, Math.round(s.saved_amount * (1 - wr.penalty_percentage / 100))) : null;
                const statusColor = wr.status === 'approved'
                  ? 'text-success bg-success/10'
                  : wr.status === 'rejected'
                    ? 'text-destructive bg-destructive/10'
                    : 'text-accent bg-accent/10';

                return (
                  <div
                    key={wr.id}
                    role="button"
                    tabIndex={0}
                    className="p-3 rounded-xl bg-muted/40 space-y-2 cursor-pointer hover:bg-muted/60 transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setSelectedWithdrawalRequest(wr)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedWithdrawalRequest(wr);
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{s?.name || 'Savings'}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(wr.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn('text-[11px] font-medium px-2 py-1 rounded-full capitalize', statusColor)}>{wr.status}</span>
                        <ArrowRight size={14} className="text-muted-foreground" />
                      </div>
                    </div>

                    <p className="text-xs text-foreground/80 line-clamp-2">{wr.reason || 'No reason provided'}</p>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">Estimated payout</span>
                      <span className="font-semibold text-foreground">{estimatedPayout !== null ? formatCurrency(estimatedPayout) : '—'}</span>
                    </div>

                    {wr.admin_reason && (
                      <p className="text-xs text-foreground/80">
                        <span className="text-muted-foreground">Admin:</span> {wr.admin_reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Savings Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Create Savings Plan</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Savings Name</Label>
              <Input placeholder="e.g. Emergency Fund, Car Savings" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div>
              <Label>Savings Type</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => setNewType('target')}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    newType === 'target' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                  )}
                >
                  <Target size={20} className="text-primary mb-2" />
                  <p className="font-semibold text-sm">Target Savings</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Save towards a goal. No interest earned.</p>
                </button>
                <button
                  onClick={() => setNewType('lock')}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    newType === 'lock' ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'
                  )}
                >
                  <Lock size={20} className="text-accent mb-2" />
                  <p className="font-semibold text-sm">Lock Savings</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Earn <span className="font-bold text-accent">10% p.a.</span> interest on locked funds.</p>
                </button>
              </div>
            </div>
            <div>
              <Label>Target Amount (KES)</Label>
              <Input type="number" placeholder="10000" value={newTarget} onChange={e => setNewTarget(e.target.value)} />
            </div>
            <div>
              <Label>Duration</Label>
              <Select value={newDuration} onValueChange={setNewDuration}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Months</SelectItem>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">12 Months</SelectItem>
                  <SelectItem value="24">24 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Initial Deposit (KES)</Label>
              <Input type="number" placeholder="500" value={initialDeposit} onChange={e => setInitialDeposit(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Min: KES 10 · Paid via M-Pesa to {profile?.phone}</p>
            </div>
            {newType === 'lock' && newTarget && (
              <Card className="p-3 bg-accent/5 border-accent/20">
                <p className="text-xs text-muted-foreground">Projected Interest (10% p.a.)</p>
                <p className="font-bold text-accent">
                  {formatCurrency(Math.round(Number(newTarget) * 0.10 * (Number(newDuration) / 12)))}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">Over {newDuration} months</p>
              </Card>
            )}
            <Button variant="gold" className="w-full" onClick={handleCreate} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Create & Pay Initial Deposit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit Dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Deposit to {selectedSavings?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-3 bg-muted/40">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="font-bold">{formatCurrency(selectedSavings?.saved_amount || 0)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">Target</span>
                <span className="font-medium">{formatCurrency(selectedSavings?.target_amount || 0)}</span>
              </div>
            </Card>
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" placeholder="500" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1">Min: KES 10 · Payment via M-Pesa to {profile?.phone}</p>
            </div>
            <Button variant="gold" className="w-full" onClick={handleDeposit} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
              Pay via M-Pesa
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Request Dialog */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Request Early Withdrawal</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-4 bg-destructive/5 border-destructive/20">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Early Withdrawal Penalty</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Withdrawing before maturity may incur a <span className="font-bold text-destructive">20% penalty</span> on your savings.
                    Your request will be reviewed by an admin.
                  </p>
                  {selectedSavings && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs">Balance: <span className="font-bold">{formatCurrency(selectedSavings.saved_amount)}</span></p>
                      <p className="text-xs">After penalty: <span className="font-bold text-destructive">{formatCurrency(Math.round(selectedSavings.saved_amount * 0.8))}</span></p>
                      <p className="text-xs text-muted-foreground">Maturity: {new Date(selectedSavings.maturity_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
            <div>
              <Label>Reason for Early Withdrawal</Label>
              <Textarea placeholder="Why do you need to withdraw early?" value={withdrawReason} onChange={e => setWithdrawReason(e.target.value)} />
            </div>
            <Button variant="destructive" className="w-full" onClick={handleWithdrawRequest} disabled={submitting}>
              {submitting ? <Loader2 className="animate-spin" size={16} /> : null}
              Submit Withdrawal Request
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{selectedSavings?.name}</DialogTitle></DialogHeader>
          {selectedSavings && (() => {
            const progress = selectedSavings.target_amount > 0 ? Math.min(100, Math.round((selectedSavings.saved_amount / selectedSavings.target_amount) * 100)) : 0;
            const daysLeft = Math.max(0, Math.ceil((new Date(selectedSavings.maturity_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
            const isMatured = daysLeft === 0;
            const myDeposits = deposits.filter(d => d.savings_id === selectedSavings.id);
            const earnedInterest = selectedSavings.type === 'lock'
              ? Math.round(selectedSavings.saved_amount * (selectedSavings.interest_rate / 100) * (
                  Math.min(
                    (Date.now() - new Date(selectedSavings.start_date).getTime()) / (1000 * 60 * 60 * 24 * 365),
                    (new Date(selectedSavings.maturity_date).getTime() - new Date(selectedSavings.start_date).getTime()) / (1000 * 60 * 60 * 24 * 365)
                  )
                ))
              : 0;

            return (
              <div className="space-y-4">
                <div className="text-center py-3">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center',
                    selectedSavings.type === 'lock' ? 'bg-accent/10' : 'bg-primary/10'
                  )}>
                    {selectedSavings.type === 'lock' ? <Lock size={24} className="text-accent" /> : <Target size={24} className="text-primary" />}
                  </div>
                  <p className="text-3xl font-bold font-display">{formatCurrency(selectedSavings.saved_amount)}</p>
                  <p className="text-sm text-muted-foreground">of {formatCurrency(selectedSavings.target_amount)}</p>
                </div>

                <Progress value={progress} className="h-3" />

                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">Type</p>
                    <p className="font-semibold text-sm">{selectedSavings.type === 'lock' ? '🔒 Lock (10% p.a.)' : '🎯 Target'}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">Days Left</p>
                    <p className="font-semibold text-sm">{isMatured ? 'Matured ✅' : `${daysLeft} days`}</p>
                  </Card>
                  <Card className="p-3">
                    <p className="text-[10px] text-muted-foreground uppercase">Deposits</p>
                    <p className="font-semibold text-sm">{myDeposits.length}</p>
                  </Card>
                  {selectedSavings.type === 'lock' && (
                    <Card className="p-3">
                      <p className="text-[10px] text-muted-foreground uppercase">Earned Interest</p>
                      <p className="font-semibold text-sm text-success">{formatCurrency(earnedInterest)}</p>
                    </Card>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="gold" className="flex-1" onClick={() => { setDetailOpen(false); setDepositOpen(true); }}>
                    Deposit
                  </Button>
                  <Button variant="outline" onClick={() => setDetailOpen(false)}>Close</Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Withdrawal Request Details Dialog */}
      <Dialog open={!!selectedWithdrawalRequest} onOpenChange={(open) => { if (!open) setSelectedWithdrawalRequest(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-center">Withdrawal Request</DialogTitle></DialogHeader>
          {selectedWithdrawalRequest && (() => {
            const s = savings.find(sv => sv.id === selectedWithdrawalRequest.savings_id);
            const estimatedPayout = s
              ? Math.max(0, Math.round(s.saved_amount * (1 - selectedWithdrawalRequest.penalty_percentage / 100)))
              : null;
            const statusColor = selectedWithdrawalRequest.status === 'approved'
              ? 'text-success bg-success/10'
              : selectedWithdrawalRequest.status === 'rejected'
                ? 'text-destructive bg-destructive/10'
                : 'text-accent bg-accent/10';

            return (
              <div className="space-y-4">
                <div className="text-center py-3 border-b border-dashed border-border/50">
                  <p className="font-display font-black text-lg tracking-wide text-foreground">DASNET VENTURES</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase mt-1">Savings Withdrawal Request</p>
                </div>

                <div className="text-center py-3">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <span className={cn('inline-block mt-2 text-[11px] font-bold px-3 py-1 rounded-full capitalize', statusColor)}>
                    {selectedWithdrawalRequest.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  {[
                    ['Savings Plan', s?.name || 'Savings'],
                    ['Current Balance', s ? formatCurrency(s.saved_amount) : '—'],
                    ['Penalty', `${selectedWithdrawalRequest.penalty_percentage}%`],
                    ['Estimated Payout', estimatedPayout !== null ? formatCurrency(estimatedPayout) : '—'],
                    ['Requested On', new Date(selectedWithdrawalRequest.created_at).toLocaleDateString('en-KE', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-1.5 border-b border-dashed border-border/30 gap-4">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-right max-w-[55%]">{value}</span>
                    </div>
                  ))}
                </div>

                <Card className="p-3 bg-muted/30 border-border/40">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Reason</p>
                  <p className="text-sm mt-1 text-foreground/90">{selectedWithdrawalRequest.reason || 'No reason provided'}</p>
                </Card>

                {selectedWithdrawalRequest.admin_reason && (
                  <Card className="p-3 bg-muted/30 border-border/40">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Admin Response</p>
                    <p className="text-sm mt-1 text-foreground/90">{selectedWithdrawalRequest.admin_reason}</p>
                  </Card>
                )}

                <Button variant="outline" className="w-full" onClick={() => setSelectedWithdrawalRequest(null)}>Close</Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Deposit Receipt Dialog */}
      <Dialog open={!!receiptDeposit} onOpenChange={(open) => { if (!open) setReceiptDeposit(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-center">Deposit Receipt</DialogTitle></DialogHeader>
          {receiptDeposit && (() => {
            const s = savings.find(sv => sv.id === receiptDeposit.savings_id);
            return (
              <div className="space-y-4">
                {/* Branded Header */}
                <div className="text-center py-3 border-b border-dashed border-border/50">
                  <p className="font-display font-black text-lg tracking-wide text-foreground">DASNET VENTURES</p>
                  <p className="text-[10px] text-muted-foreground tracking-widest uppercase mt-1">Savings Deposit Confirmation</p>
                </div>

                {/* Amount */}
                <div className="text-center py-4">
                  <p className="text-3xl font-bold font-display text-success">{formatCurrency(receiptDeposit.amount)}</p>
                  <span className="inline-block mt-2 text-[11px] font-bold px-3 py-1 rounded-full bg-success/10 text-success">✓ Confirmed</span>
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  {[
                    ['Savings Plan', s?.name || 'Savings'],
                    ['Plan Type', s?.type === 'lock' ? '🔒 Lock Savings' : '🎯 Target Savings'],
                    ['Reference', receiptDeposit.stk_reference || '—'],
                    ['Date', new Date(receiptDeposit.created_at).toLocaleDateString('en-KE', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })],
                    ['Balance After', s ? formatCurrency(s.saved_amount) : '—'],
                    ['Target', s ? formatCurrency(s.target_amount) : '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between py-1.5 border-b border-dashed border-border/30">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-semibold text-right max-w-[55%] truncate">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="text-center pt-2 border-t border-dashed border-border/50">
                  <p className="text-[10px] text-muted-foreground">Thank you for saving with Dasnet</p>
                </div>

                <Button variant="outline" className="w-full" onClick={() => setReceiptDeposit(null)}>Close</Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
