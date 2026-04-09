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
  XCircle,
  Receipt,
  Copy,
  Calendar,
  Hash,
  FileText,
  Banknote
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
  const [filterType, setFilterType] = useState<'all' | 'in' | 'out'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPhone, setDepositPhone] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
      const isIn = tx.type === 'credit';
      const isOut = tx.type === 'debit' || tx.type === 'withdrawal';
      const matchesType = filterType === 'all' || (filterType === 'in' && isIn) || (filterType === 'out' && isOut);
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
    if (depositChannelRef.current) supabase.removeChannel(depositChannelRef.current);
    depositChannelRef.current = supabase
      .channel(`deposit-status-${reference}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stk_transactions', filter: `reference=eq.${reference}` },
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
      ).subscribe();
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

  const getTransactionLabel = (tx: WalletTransaction) => {
    const desc = tx.description?.toLowerCase() || '';
    if (tx.type === 'credit') {
      if (desc.includes('transfer from')) return 'Received Funds';
      if (desc.includes('loan')) return 'Loan Disbursement';
      if (desc.includes('refund')) return 'Transfer Refund';
      if (desc.includes('deposit')) return 'Wallet Deposit';
      return 'Money In';
    }
    if (tx.type === 'withdrawal') return 'Withdrawal';
    if (desc.includes('transfer to')) return 'Sent Money';
    if (desc.includes('reversed')) return 'Transfer Reversed';
    return 'Money Out';
  };

  const getTransactionIcon = (tx: WalletTransaction) => {
    const desc = tx.description?.toLowerCase() || '';
    if (tx.type === 'credit') {
      if (desc.includes('transfer from')) return HandCoins;
      if (desc.includes('loan')) return Banknote;
      if (desc.includes('deposit')) return ArrowDownLeft;
      return ArrowDownLeft;
    }
    if (tx.type === 'withdrawal') return ArrowUpRight;
    if (desc.includes('transfer to')) return Send;
    return ArrowUpRight;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

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
              <div className="flex justify-between items-start mb-6">
                <div>
                  <p className="text-[10px] font-semibold text-foreground/40 uppercase tracking-[0.2em] mb-1.5">Available Balance</p>
                  <div className="flex items-center gap-3">
                    <h2 className="text-3xl md:text-5xl font-bold text-foreground tracking-tight">
                      {showBalance ? formatCurrency(wallet?.balance || 0) : 'KES ••••••'}
                    </h2>
                    <button onClick={() => setShowBalance(!showBalance)} className="text-foreground/40 hover:text-foreground transition-colors p-1">
                      {showBalance ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
                  <Wallet size={22} className="text-accent" />
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Send', icon: Send, action: () => setSendMoneyOpen(true), variant: 'gold' as const },
                  { label: 'Request', icon: HandCoins, action: () => setRequestMoneyOpen(true) },
                  { label: 'Withdraw', icon: ArrowUpRight, action: () => setWithdrawDialog(true) },
                  { label: 'Deposit', icon: ArrowDownLeft, action: () => setDepositDialog(true) },
                ].map((btn, i) => (
                  <button
                    key={i}
                    onClick={btn.action}
                    className={cn(
                      "flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-all",
                      i === 0
                        ? "bg-accent/15 hover:bg-accent/25 border border-accent/30"
                        : "bg-foreground/5 hover:bg-foreground/10 border border-foreground/10"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center",
                      i === 0 ? "bg-accent/20" : "bg-foreground/10"
                    )}>
                      <btn.icon size={16} className={i === 0 ? "text-accent" : "text-foreground/70"} />
                    </div>
                    <span className={cn("text-[10px] font-semibold", i === 0 ? "text-accent" : "text-foreground/60")}>{btn.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>

            <div className="border-t border-foreground/5 px-6 md:px-10 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground/30">
                <ShieldCheck size={11} />
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em]">Secured by DASNET</span>
              </div>
              <span className="text-[9px] font-mono text-foreground/20">{wallet?.id.slice(0, 12).toUpperCase()}</span>
            </div>
          </Card>
        </motion.div>

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total In', val: stats.income, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'Total Out', val: stats.expense, icon: ArrowUpRight, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
            { label: 'Pending', val: stats.escrow, icon: Clock, color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
          ].map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
              <Card className={cn("border bg-card/80 backdrop-blur-sm", m.border)}>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", m.bg)}>
                      <m.icon className={m.color} size={14} />
                    </div>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{m.label}</p>
                  </div>
                  <p className="text-base md:text-lg font-bold text-foreground tracking-tight">{formatCurrency(m.val)}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Transactions */}
          <div className="lg:col-span-8">
            <Card className="border-border/40 overflow-hidden">
              <CardHeader className="p-4 md:p-5 border-b border-border/30 bg-card/50">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                        <History size={16} className="text-accent" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold">Transactions</CardTitle>
                        <CardDescription className="text-[10px] mt-0">{transactions.length} total</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={fetchWalletData} className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground">
                        <RefreshCw size={13} />
                      </Button>
                      <Button variant="outline" size="sm" onClick={exportStatement} className="h-7 rounded-lg text-[10px] gap-1 font-semibold px-2.5">
                        <Download size={11} /> CSV
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                      <Input
                        placeholder="Search..."
                        className="pl-9 h-8 bg-muted/40 border-border/30 rounded-lg text-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Tabs value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                      <TabsList className="h-8 bg-muted/50 rounded-lg p-0.5">
                        <TabsTrigger value="all" className="text-[10px] rounded-md px-3 h-7 data-[state=active]:bg-card font-semibold">All</TabsTrigger>
                        <TabsTrigger value="in" className="text-[10px] rounded-md px-3 h-7 data-[state=active]:bg-emerald-500/15 data-[state=active]:text-emerald-400 font-semibold">
                          <ArrowDownLeft size={10} className="mr-1" /> In
                        </TabsTrigger>
                        <TabsTrigger value="out" className="text-[10px] rounded-md px-3 h-7 data-[state=active]:bg-rose-500/15 data-[state=active]:text-rose-400 font-semibold">
                          <ArrowUpRight size={10} className="mr-1" /> Out
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {filteredTransactions.length === 0 ? (
                  <div className="py-16 flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                      <Receipt size={22} className="text-muted-foreground/40" />
                    </div>
                    <p className="text-sm font-semibold text-muted-foreground">No transactions found</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">Try adjusting your filters</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/15">
                    {filteredTransactions.map((tx, idx) => {
                      const TxIcon = getTransactionIcon(tx);
                      const label = getTransactionLabel(tx);
                      return (
                        <motion.div
                          key={tx.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.02 }}
                          onClick={() => setSelectedTx(tx)}
                          className="px-4 py-3.5 flex items-center justify-between hover:bg-muted/20 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105",
                              tx.type === 'credit' ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                            )}>
                              <TxIcon size={17} />
                            </div>
                            <div>
                              <p className="text-[13px] font-semibold text-foreground">{label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {tx.description && tx.description !== label ? tx.description : ''}
                                {tx.description && tx.description !== label ? ' · ' : ''}
                                {new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={cn("text-[13px] font-bold tabular-nums", tx.type === 'credit' ? "text-emerald-400" : "text-foreground")}>
                              {tx.type === 'credit' ? '+' : '-'} {formatCurrency(tx.amount)}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-4 space-y-4">
            {/* Quick Info */}
            <Card className="border-border/40 overflow-hidden">
              <div className="bg-gradient-to-br from-accent/5 to-transparent p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center border border-accent/20">
                    <Globe size={18} className="text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">DASNET Wallet</p>
                    <p className="text-[10px] text-muted-foreground">M-Pesa powered</p>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 pt-0 mt-3">
                <div className="space-y-2">
                  {[
                    { icon: ShieldCheck, text: 'Bank-grade security' },
                    { icon: Smartphone, text: 'Instant M-Pesa deposits' },
                    { icon: Lock, text: 'Encrypted transactions' },
                    { icon: Activity, text: 'Real-time tracking' },
                  ].map((f, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <div className="w-5 h-5 rounded-md bg-accent/8 flex items-center justify-center">
                        <f.icon size={10} className="text-accent" />
                      </div>
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
                <Badge variant="outline" className="text-[10px] font-semibold h-5 min-w-[20px] justify-center">
                  {withdrawals.filter(w => w.status === 'pending').length}
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                {withdrawals.filter(w => w.status === 'pending').length === 0 ? (
                  <div className="p-6 text-center">
                    <CheckCircle2 size={20} className="mx-auto text-emerald-500/40 mb-1.5" />
                    <p className="text-[10px] text-muted-foreground">All clear</p>
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
                              <p className="text-[10px] text-muted-foreground">{wd.phone}</p>
                            </div>
                          </div>
                          <Badge className="bg-accent/10 text-accent border-accent/20 text-[9px] font-semibold">
                            Processing
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
                <div className="flex items-center gap-2">
                  <Send size={13} className="text-accent" />
                  <CardTitle className="text-sm font-bold">Recent Transfers</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] font-semibold h-5 min-w-[20px] justify-center">{transfers.length}</Badge>
              </CardHeader>
              <CardContent className="p-0 max-h-[280px] overflow-y-auto">
                {transfers.length === 0 ? (
                  <p className="p-6 text-center text-[10px] text-muted-foreground">No transfers yet</p>
                ) : (
                  <div className="divide-y divide-border/15">
                    {transfers.map((tr) => (
                      <div key={tr.id} onClick={() => setSelectedTransfer(tr)} className="p-3.5 flex items-center justify-between hover:bg-muted/20 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold",
                            tr.sender_id === user?.id ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"
                          )}>
                            {(tr.sender_id === user?.id ? tr.receiver_name : tr.sender_name || 'U')?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              {tr.sender_id === user?.id ? tr.receiver_name : tr.sender_name}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                              {tr.sender_id === user?.id ? 'Sent' : 'Received'} · {new Date(tr.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </p>
                          </div>
                        </div>
                        <p className={cn("text-xs font-bold", tr.sender_id === user?.id ? "text-rose-400" : "text-emerald-400")}>
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

        {/* Deposit Dialog */}
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
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} className="text-emerald-500" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg">Deposit Successful!</h3>
                  <p className="text-sm text-muted-foreground">{depositStatusMessage}</p>
                  <Button onClick={resetDepositState} variant="gold" className="mt-2 rounded-xl">Done</Button>
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
                      "p-3 rounded-xl text-sm flex items-start gap-2",
                      depositStatus === 'pending' ? "bg-accent/5 border border-accent/20 text-accent" :
                      depositStatus === 'failed' ? "bg-destructive/10 border border-destructive/20 text-destructive" : ""
                    )}>
                      {depositStatus === 'pending' && <Loader2 size={16} className="animate-spin mt-0.5" />}
                      {depositStatus === 'failed' && <XCircle size={16} className="mt-0.5" />}
                      <span className="text-xs">{depositStatusMessage}</span>
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

        {/* Professional Transaction Receipt */}
        <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
          <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-border/30">
            {selectedTx && (
              <>
                {/* Receipt Header */}
                <div className="bg-gradient-to-br from-[hsl(var(--navy-800))] via-[hsl(var(--navy-700))] to-[hsl(var(--navy-900))] p-6 pb-8 text-center relative">
                  <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent" />
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center">
                      <Wallet size={12} className="text-accent" />
                    </div>
                    <span className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">DASNET VENTURES</span>
                  </div>
                  <p className="text-[10px] text-foreground/40 uppercase tracking-[0.15em] mb-2">Transaction Receipt</p>
                  <p className={cn(
                    "text-3xl font-bold tracking-tight",
                    selectedTx.type === 'credit' ? "text-emerald-400" : "text-foreground"
                  )}>
                    {selectedTx.type === 'credit' ? '+' : '-'} {formatCurrency(selectedTx.amount)}
                  </p>
                  <div className="mt-3">
                    <Badge className={cn(
                      "text-[10px] font-bold px-3 py-0.5",
                      selectedTx.type === 'credit'
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                    )}>
                      {getTransactionLabel(selectedTx)}
                    </Badge>
                  </div>
                </div>

                {/* Dotted separator */}
                <div className="relative -mt-3 px-4">
                  <div className="flex items-center">
                    <div className="w-6 h-6 rounded-full bg-background -ml-7" />
                    <div className="flex-1 border-b-2 border-dashed border-border/30" />
                    <div className="w-6 h-6 rounded-full bg-background -mr-7" />
                  </div>
                </div>

                {/* Receipt Details */}
                <div className="p-6 space-y-4">
                  <div className="space-y-3">
                    {[
                      { icon: Hash, label: 'Transaction ID', value: selectedTx.id.slice(0, 16).toUpperCase(), copyable: true, fullValue: selectedTx.id },
                      { icon: Calendar, label: 'Date & Time', value: new Date(selectedTx.created_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }) },
                      { icon: FileText, label: 'Description', value: selectedTx.description || 'No description' },
                      { icon: Receipt, label: 'Reference', value: selectedTx.reference_id || 'N/A' },
                      { icon: Activity, label: 'Type', value: selectedTx.type.charAt(0).toUpperCase() + selectedTx.type.slice(1) },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-border/10 last:border-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                            <item.icon size={12} className="text-muted-foreground" />
                          </div>
                          <span className="text-[11px] text-muted-foreground font-medium">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-foreground text-right max-w-[160px] truncate">{item.value}</span>
                          {item.copyable && (
                            <button onClick={() => copyToClipboard(item.fullValue!)} className="text-muted-foreground hover:text-accent transition-colors p-0.5">
                              <Copy size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-center pt-2">
                    <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Powered by DASNET VENTURES</p>
                  </div>

                  <Button variant="outline" className="w-full rounded-xl h-10 text-xs font-semibold" onClick={() => setSelectedTx(null)}>
                    Close Receipt
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <SendMoneyDialog open={sendMoneyOpen} onOpenChange={setSendMoneyOpen} walletBalance={wallet?.balance || 0} onSuccess={fetchWalletData} />
        <RequestMoneyDialog open={requestMoneyOpen} onOpenChange={setRequestMoneyOpen} onSuccess={fetchWalletData} />
        {selectedTransfer && (
          <TransferDetailsDialog transfer={selectedTransfer} onClose={() => setSelectedTransfer(null)} onRefresh={fetchWalletData} />
        )}
      </div>
    </DashboardLayout>
  );
}
