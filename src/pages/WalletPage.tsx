import { useEffect, useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Loader2,
  Clock,
  TrendingUp,
  HandCoins,
  ShieldCheck,
  Smartphone,
  Globe,
  Lock,
  History,
  Search,
  Info,
  CreditCard,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Activity,
  X,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/EmptyState';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SendMoneyDialog } from '@/components/SendMoneyDialog';
import { RequestMoneyDialog } from '@/components/RequestMoneyDialog';
import { TransferDetailsDialog } from '@/components/TransferDetailsDialog';
import { MoneyRequestsSection } from '@/components/MoneyRequestsSection';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { FeatureDisabled } from '@/components/FeatureDisabled';

interface WalletData { id: string; balance: number; }
interface WalletTransaction { id: string; type: 'credit' | 'debit' | 'withdrawal'; amount: number; description: string | null; reference_id: string | null; created_at: string; status?: string; }
interface WithdrawalRequest { id: string; amount: number; phone: string; status: 'pending' | 'completed' | 'rejected'; admin_reason: string | null; created_at: string; }
interface Transfer { id: string; sender_id: string; receiver_id: string; amount: number; reason: string | null; sender_name: string | null; receiver_name: string | null; status: string; created_at: string; cancelled_at: string | null; }

export default function WalletPage() {
  const { user, profile } = useAuth();
  const { isEnabled } = usePlatformSettings();
  const walletDisabled = !isEnabled('wallet_enabled');

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);

  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [depositDialog, setDepositDialog] = useState(false);
  const [sendMoneyOpen, setSendMoneyOpen] = useState(false);
  const [requestMoneyOpen, setRequestMoneyOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPhone, setDepositPhone] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // NEW: Deposit status tracking
  const [depositStatus, setDepositStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [depositStatusMessage, setDepositStatusMessage] = useState('');
  const depositPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const depositChannelRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (depositPollingRef.current) clearInterval(depositPollingRef.current);
      if (depositChannelRef.current) supabase.removeChannel(depositChannelRef.current);
    };
  }, []);

  const fetchWalletData = async () => {
    if (!user) return;
    try {
      const [w, t, wd, tr] = await Promise.all([
        supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('withdrawal_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('wallet_transfers').select('*').or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`).order('created_at', { ascending: false })
      ]);
      if (w.data) setWallet(w.data);
      if (t.data) setTransactions(t.data as any);
      if (wd.data) setWithdrawals(wd.data as any);
      if (tr.data) setTransfers(tr.data as any);
    } catch {
      toast.error("Failed to load wallet data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
    const channel = supabase.channel('wallet_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user?.id}` }, fetchWalletData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user?.id}` }, fetchWalletData)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesType = filterType === 'all' || tx.type === filterType;
      const matchesSearch = tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) || tx.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [transactions, filterType, searchQuery]);

  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'credit').reduce((a, b) => a + b.amount, 0);
    const expense = transactions.filter(t => t.type === 'debit' || t.type === 'withdrawal').reduce((a, b) => a + b.amount, 0);
    const escrow = withdrawals.filter(w => w.status === 'pending').reduce((a, b) => a + b.amount, 0);
    return { income, expense, escrow };
  }, [transactions, withdrawals]);

  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amt);

  const exportStatement = () => {
    const headers = ["Date", "ID", "Type", "Amount", "Description"];
    const rows = transactions.map(t => [new Date(t.created_at).toLocaleString(), t.id, t.type, t.amount, t.description]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `statement_${user?.id.slice(0, 5)}.csv`);
    document.body.appendChild(link);
    link.click();
    toast.success("Statement exported");
  };

  const handleWithdraw = async () => {
    if (!wallet || !withdrawAmount || !withdrawPhone) return;
    const amount = Number(withdrawAmount);
    if (amount < 100 || amount > wallet.balance) return toast.error("Invalid amount");
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('request_withdrawal_secure' as any, {
        _user_id: user!.id, _amount: amount, _phone: withdrawPhone.trim(),
      });
      if (error) throw error;
      toast.success("Withdrawal request submitted");
      setWithdrawDialog(false);
      setWithdrawAmount('');
      setWithdrawPhone('');
      fetchWalletData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  // ========== FIXED: handleDeposit now tracks payment status ==========
  const startDepositPolling = (reference: string) => {
    if (depositPollingRef.current) clearInterval(depositPollingRef.current);

    depositPollingRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('stk_transactions')
          .select('status, result_desc')
          .eq('reference', reference)
          .maybeSingle();

        if (error || !data) return;

        if (data.status === 'success' || data.status === 'Completed') {
          setDepositStatus('success');
          setDepositStatusMessage('Deposit received successfully! Your wallet has been credited. 🎉');
          setActionLoading(false);
          fetchWalletData();
          if (depositPollingRef.current) clearInterval(depositPollingRef.current);
        } else if (data.status === 'failed' || data.status === 'Cancelled') {
          setDepositStatus('failed');
          setDepositStatusMessage(data.result_desc || 'Payment failed or was cancelled.');
          setActionLoading(false);
          if (depositPollingRef.current) clearInterval(depositPollingRef.current);
        }
      } catch (err) {
        console.error('Deposit polling error:', err);
      }
    }, 5000);
  };

  const subscribeToDeposit = (reference: string) => {
    if (depositChannelRef.current) {
      supabase.removeChannel(depositChannelRef.current);
    }

    depositChannelRef.current = supabase
      .channel(`deposit-status-${reference}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stk_transactions',
          filter: `reference=eq.${reference}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;

          if (row.status === 'success' || row.status === 'Completed') {
            setDepositStatus('success');
            setDepositStatusMessage('Deposit received successfully! Your wallet has been credited. 🎉');
            setActionLoading(false);
            fetchWalletData();
            if (depositPollingRef.current) clearInterval(depositPollingRef.current);
          } else if (row.status === 'failed' || row.status === 'Cancelled') {
            setDepositStatus('failed');
            setDepositStatusMessage(row.result_desc || 'Payment failed or was cancelled.');
            setActionLoading(false);
            if (depositPollingRef.current) clearInterval(depositPollingRef.current);
          }
        }
      )
      .subscribe();
  };

  const handleDeposit = async () => {
    if (!depositAmount || !depositPhone) return;
    setActionLoading(true);
    setDepositStatus('pending');
    setDepositStatusMessage('Sending M-Pesa prompt to your phone...');

    try {
      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: { phone: depositPhone.trim(), amount: Number(depositAmount), userId: user!.id, purpose: 'wallet_deposit' },
      });
      if (error) throw error;

      const reference = data?.reference;
      if (reference) {
        setDepositStatusMessage('Check your phone for the M-Pesa prompt. Enter your PIN to complete.');
        subscribeToDeposit(reference);
        startDepositPolling(reference);
      } else {
        setDepositStatusMessage('STK push sent. Check your phone.');
      }
    } catch {
      setDepositStatus('failed');
      setDepositStatusMessage('M-Pesa service unavailable. Please try again.');
      setActionLoading(false);
    }
  };

  const resetDepositState = () => {
    setDepositDialog(false);
    setDepositStatus('idle');
    setDepositStatusMessage('');
    setDepositAmount('');
    setDepositPhone('');
    if (depositPollingRef.current) clearInterval(depositPollingRef.current);
    if (depositChannelRef.current) supabase.removeChannel(depositChannelRef.current);
  };
  // ========== END FIX ==========

  if (walletDisabled) return <DashboardLayout><FeatureDisabled /></DashboardLayout>;
  if (loading) return <DashboardLayout><div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-accent" size={28} /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 space-y-6 max-w-[1400px] mx-auto">

        {/* Wallet Balance Card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="premium-card border-none bg-gradient-to-br from-[hsl(var(--navy-800))] via-[hsl(var(--navy-700))] to-[hsl(var(--navy-900))] overflow-hidden relative">
            <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-accent/5 rounded-full blur-[80px]" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />

            <CardContent className="p-6 md:p-10 relative z-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1">Available Balance</p>
                  <div className="flex items-center gap-3">
                    <h2 className="text-4xl md:text-6xl font-bold text-foreground tracking-tight">
                      {showBalance ? formatCurrency(wallet?.balance || 0) : 'KES ••••••'}
                    </h2>
                    <button onClick={() => setShowBalance(!showBalance)} className="text-foreground/40 hover:text-foreground transition-colors">
                      {showBalance ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <Wallet size={24} className="text-accent" />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setSendMoneyOpen(true)} variant="gold" className="h-12 px-6 rounded-xl font-semibold gap-2 shadow-[var(--shadow-gold)]">
                  <Send size={16} /> Send Money
                </Button>
                <Button onClick={() => setRequestMoneyOpen(true)} variant="outline" className="h-12 px-6 rounded-xl font-semibold gap-2 border-border/50 text-foreground hover:bg-muted/50">
                  <HandCoins size={16} /> Request
                </Button>
                <Button onClick={() => setWithdrawDialog(true)} variant="outline" className="h-12 px-6 rounded-xl font-semibold gap-2 border-border/50 text-foreground hover:bg-muted/50">
                  <ArrowUpRight size={16} /> Withdraw
                </Button>
                <Button onClick={() => setDepositDialog(true)} variant="outline" className="h-12 px-6 rounded-xl font-semibold gap-2 border-border/50 text-foreground hover:bg-muted/50">
                  <ArrowDownLeft size={16} /> Deposit
                </Button>
              </div>
            </CardContent>

            <div className="border-t border-border/20 px-6 md:px-10 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground/40">
                <ShieldCheck size={12} />
                <span className="text-[10px] font-semibold uppercase tracking-wider">Secured</span>
              </div>
              <span className="text-[10px] font-mono text-foreground/30">{wallet?.id.slice(0, 12).toUpperCase()}</span>
            </div>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: 'Pending', val: stats.escrow, icon: Clock, color: 'text-accent', bg: 'bg-accent/10' },
            { label: 'Total In', val: stats.income, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
            { label: 'Total Out', val: stats.expense, icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10' },
            { label: 'Transactions', val: transactions.length, icon: Activity, color: 'text-accent', bg: 'bg-accent/10', isRaw: true }
          ].map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <Card className="border-border/40 bg-card hover:border-accent/30 transition-all">
                <CardContent className="p-4">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", m.bg)}>
                    <m.icon className={m.color} size={18} />
                  </div>
                  <p className="text-lg font-bold text-foreground tracking-tight">
                    {m.isRaw ? m.val : formatCurrency(m.val)}
                  </p>
                  <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{m.label}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Transactions */}
          <div className="lg:col-span-8">
            <Card className="border-border/40">
              <CardHeader className="p-5 border-b border-border/30">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <History size={18} className="text-accent" /> Transaction History
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">Your recent wallet activity</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportStatement} className="h-8 rounded-lg text-xs gap-1.5 font-medium">
                      <Download size={13} /> Export
                    </Button>
                    <Button variant="ghost" size="sm" onClick={fetchWalletData} className="h-8 rounded-lg text-xs gap-1.5 font-medium text-muted-foreground">
                      <RefreshCw size={13} /> Refresh
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input
                      placeholder="Search transactions..."
                      className="pl-9 h-9 bg-muted/40 border-border/30 rounded-lg text-sm"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Tabs value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                    <TabsList className="h-9 bg-muted/50 rounded-lg">
                      <TabsTrigger value="all" className="text-xs rounded-md px-4 data-[state=active]:bg-card">All</TabsTrigger>
                      <TabsTrigger value="credit" className="text-xs rounded-md px-4 data-[state=active]:bg-card data-[state=active]:text-success">In</TabsTrigger>
                      <TabsTrigger value="debit" className="text-xs rounded-md px-4 data-[state=active]:bg-card data-[state=active]:text-destructive">Out</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {filteredTransactions.length === 0 ? (
                  <div className="py-16 flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <Search size={20} className="text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium text-muted-foreground">No transactions found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {filteredTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        onClick={() => setSelectedTx(tx)}
                        className="p-4 flex items-center justify-between hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center",
                            tx.type === 'credit' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                          )}>
                            {tx.type === 'credit' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{tx.description || tx.type.charAt(0).toUpperCase() + tx.type.slice(1)}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-sm font-bold", tx.type === 'credit' ? "text-success" : "text-foreground")}>
                            {tx.type === 'credit' ? '+' : '-'} {formatCurrency(tx.amount)}
                          </p>
                          <p className="text-[10px] text-muted-foreground font-mono">{tx.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-4 space-y-4">
            {/* Quick Info */}
            <Card className="border-border/40">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                    <Globe size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">DASNET Wallet</p>
                    <p className="text-[11px] text-muted-foreground">Instant M-Pesa deposits & withdrawals</p>
                  </div>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { icon: ShieldCheck, text: 'Bank-grade security' },
                    { icon: Smartphone, text: 'M-Pesa integration' },
                    { icon: Lock, text: 'Encrypted transactions' },
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-muted-foreground">
                      <f.icon size={12} className="text-accent" />
                      <span>{f.text}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Pending Withdrawals */}
            <Card className="border-border/40">
              <CardHeader className="p-4 border-b border-border/30 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-accent" />
                  <CardTitle className="text-sm font-bold">Pending Withdrawals</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold">
                  {withdrawals.filter(w => w.status === 'pending').length}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {withdrawals.filter(w => w.status === 'pending').length === 0 ? (
                  <div className="p-8 text-center">
                    <Clock size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-xs text-muted-foreground">No pending withdrawals</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/20">
                    {withdrawals.filter(w => w.status === 'pending').map((wd) => (
                      <div key={wd.id} className="p-4 space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-base font-bold text-foreground">{formatCurrency(wd.amount)}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Smartphone size={10} className="text-muted-foreground" />
                              <p className="text-[11px] text-muted-foreground">{wd.phone}</p>
                            </div>
                          </div>
                          <Badge className="bg-accent/10 text-accent border-accent/20 text-[10px] font-semibold">
                            Under Review
                          </Badge>
                        </div>
                        <div className="w-full bg-border/30 h-1 rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: '60%' }} transition={{ duration: 1.5 }} className="bg-accent h-full rounded-full" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <MoneyRequestsSection walletBalance={wallet?.balance || 0} onRefresh={fetchWalletData} />

            {/* P2P Transfers */}
            <Card className="border-border/40">
              <CardHeader className="p-4 border-b border-border/30 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold">Recent Transfers</CardTitle>
                <Badge variant="outline" className="text-[10px] font-semibold">{transfers.length}</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[320px] overflow-y-auto">
                {transfers.length === 0 ? (
                  <p className="p-8 text-center text-xs text-muted-foreground">No transfers yet</p>
                ) : (
                  <div className="divide-y divide-border/20">
                    {transfers.map((tr) => (
                      <div key={tr.id} onClick={() => setSelectedTransfer(tr)} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-accent font-bold text-xs">
                            {(tr.sender_id === user?.id ? tr.receiver_name : tr.sender_name || 'U')?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {tr.sender_id === user?.id ? tr.receiver_name : tr.sender_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground capitalize">{tr.status}</p>
                          </div>
                        </div>
                        <p className={cn("text-sm font-bold", tr.sender_id === user?.id ? "text-destructive" : "text-success")}>
                          {tr.sender_id === user?.id ? '-' : '+'}{formatCurrency(tr.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Withdraw Dialog */}
        <Dialog open={withdrawDialog} onOpenChange={setWithdrawDialog}>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
            <div className="bg-gradient-to-br from-[hsl(var(--navy-800))] to-[hsl(var(--navy-900))] p-6">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <ArrowUpRight size={20} /> Withdraw Funds
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">Transfer to your M-Pesa account</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="p-4 rounded-xl bg-muted/30 border border-border/30 text-center">
                <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
                <p className="text-2xl font-bold text-accent">{formatCurrency(wallet?.balance || 0)}</p>
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Amount (KES)</Label>
                  <div className="relative">
                    <CreditCard size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Min 100" className="h-12 rounded-xl pl-10 text-lg font-semibold" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">M-Pesa Number</Label>
                  <div className="relative">
                    <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={withdrawPhone} onChange={(e) => setWithdrawPhone(e.target.value)} placeholder="07XXXXXXXX" className="h-12 rounded-xl pl-10 font-semibold" />
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/5 border border-accent/10">
                <Info size={14} className="text-accent mt-0.5 shrink-0" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Funds will be held pending admin approval, typically within 24 hours.
                </p>
              </div>
            </div>
            <div className="p-4 bg-muted/10 border-t border-border/20 flex gap-3">
              <Button variant="ghost" onClick={() => setWithdrawDialog(false)} className="flex-1 h-11 rounded-xl font-semibold text-sm">Cancel</Button>
              <Button variant="gold" onClick={handleWithdraw} disabled={actionLoading || !withdrawAmount} className="flex-1 h-11 rounded-xl font-semibold text-sm">
                {actionLoading ? <Loader2 className="animate-spin" size={16} /> : "Confirm Withdrawal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* FIXED: Deposit Dialog with status tracking */}
        <Dialog open={depositDialog} onOpenChange={(open) => { if (!open) resetDepositState(); else setDepositDialog(true); }}>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
            <div className="bg-gradient-to-br from-[hsl(var(--navy-800))] to-[hsl(var(--navy-900))] p-6">
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                <ArrowDownLeft size={20} /> Deposit via M-Pesa
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">Add funds to your wallet</p>
            </div>
            <div className="p-6 space-y-5">
              {depositStatus === 'success' ? (
                <div className="text-center py-4 space-y-3">
                  <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
                  <h3 className="font-bold text-foreground text-lg">Deposit Successful!</h3>
                  <p className="text-sm text-muted-foreground">{depositStatusMessage}</p>
                  <Button onClick={resetDepositState} className="mt-2">Done</Button>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Amount (KES)</Label>
                      <Input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Enter amount" className="h-12 rounded-xl text-lg font-semibold" disabled={depositStatus === 'pending'} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">M-Pesa Number</Label>
                      <Input value={depositPhone} onChange={(e) => setDepositPhone(e.target.value)} placeholder="07XXXXXXXX" className="h-12 rounded-xl font-semibold" disabled={depositStatus === 'pending'} />
                    </div>
                  </div>

                  {depositStatus !== 'idle' && (
                    <div className={cn(
                      "p-3 rounded-lg text-sm flex items-start gap-2",
                      depositStatus === 'pending' ? "bg-yellow-500/10 text-yellow-600" :
                      depositStatus === 'failed' ? "bg-destructive/10 text-destructive" : ""
                    )}>
                      {depositStatus === 'pending' && <Loader2 size={16} className="animate-spin mt-0.5" />}
                      {depositStatus === 'failed' && <XCircle size={16} className="mt-0.5" />}
                      <span>{depositStatusMessage}</span>
                    </div>
                  )}
                </>
              )}
            </div>
            {depositStatus !== 'success' && (
              <div className="p-4 bg-muted/10 border-t border-border/20 flex gap-3">
                <Button variant="ghost" onClick={resetDepositState} className="flex-1 h-11 rounded-xl font-semibold text-sm">Cancel</Button>
                <Button variant="gold" onClick={handleDeposit} disabled={actionLoading || !depositAmount || depositStatus === 'pending'} className="flex-1 h-11 rounded-xl font-semibold text-sm">
                  {actionLoading ? <Loader2 className="animate-spin" size={16} /> : "Send STK Push"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Transaction Receipt */}
        <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden">
            {selectedTx && (
              <>
                <div className="bg-gradient-to-br from-[hsl(var(--navy-800))] to-[hsl(var(--navy-900))] p-8 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Transaction Receipt</p>
                  <p className="text-4xl font-bold text-foreground">{formatCurrency(selectedTx.amount)}</p>
                  <Badge className={cn("mt-3", selectedTx.type === 'credit' ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                    {selectedTx.type.toUpperCase()}
                  </Badge>
                </div>
                <div className="p-6 space-y-4">
                  {[
                    { l: 'Transaction ID', v: selectedTx.id.slice(0, 16) },
                    { l: 'Date', v: new Date(selectedTx.created_at).toLocaleString() },
                    { l: 'Description', v: selectedTx.description || '-' },
                    { l: 'Reference', v: selectedTx.reference_id || '-' },
                  ].map((r, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{r.l}</span>
                      <span className="font-semibold text-foreground text-right max-w-[200px] truncate">{r.v}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <SendMoneyDialog open={sendMoneyOpen} onOpenChange={setSendMoneyOpen} walletBalance={wallet?.balance || 0} onSuccess={fetchWalletData} />
        <RequestMoneyDialog open={requestMoneyOpen} onOpenChange={setRequestMoneyOpen} />
        <TransferDetailsDialog transfer={selectedTransfer} open={!!selectedTransfer} onOpenChange={() => setSelectedTransfer(null)} currentUserId={user?.id || ''} onRefresh={fetchWalletData} />
      </div>
    </DashboardLayout>
  );
}
