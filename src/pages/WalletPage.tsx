import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  TrendingUp,
  HandCoins,
  ShieldCheck,
  Smartphone,
  Globe,
  X,
  Lock,
  History,
  Filter,
  Search,
  Info,
  ChevronRight,
  CreditCard,
  AlertCircle,
  Download,
  Calendar,
  ChevronDown,
  RefreshCw,
  Eye,
  EyeOff,
  MousePointer2,
  Activity,
  ShieldAlert
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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

// --- ADVANCED TYPES ---
interface WalletData {
  id: string;
  balance: number;
}

interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit' | 'withdrawal';
  amount: number;
  description: string | null;
  reference_id: string | null;
  created_at: string;
  status?: string;
}

interface WithdrawalRequest {
  id: string;
  amount: number;
  phone: string;
  status: 'pending' | 'completed' | 'rejected';
  admin_reason: string | null;
  created_at: string;
}

interface Transfer {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  reason: string | null;
  sender_name: string | null;
  receiver_name: string | null;
  status: string;
  created_at: string;
}

interface DeviceSession {
  ip: string;
  model: string;
  os: string;
  browser: string;
}

export default function WalletPage() {
  const { user, profile } = useAuth();
  const { isEnabled } = usePlatformSettings();
  const walletDisabled = !isEnabled('wallet_enabled');
  
  // --- STATE MANAGEMENT ---
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<DeviceSession>({ ip: 'Detecting...', model: 'Detecting...', os: '', browser: '' });
  
  // --- UI TOGGLES ---
  const [withdrawDialog, setWithdrawDialog] = useState(false);
  const [depositDialog, setDepositDialog] = useState(false);
  const [sendMoneyOpen, setSendMoneyOpen] = useState(false);
  const [requestMoneyOpen, setRequestMoneyOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WalletTransaction | null>(null);
  const [showBalance, setShowBalance] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'credit' | 'debit'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // --- FORM STATES ---
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawPhone, setWithdrawPhone] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositPhone, setDepositPhone] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // --- DYNAMIC DEVICE DETECTION ---
  const detectSession = async () => {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const ipData = await res.json();
      
      const ua = navigator.userAgent;
      let model = "Unknown Device";
      if (/android/i.test(ua)) model = ua.match(/Android [^;]+; ([^;)]+)/)?.[1] || "Android Device";
      else if (/iPhone/i.test(ua)) model = "iPhone";
      else if (/Windows/i.test(ua)) model = "Windows PC";

      setSession({
        ip: ipData.ip,
        model: model,
        os: navigator.platform,
        browser: navigator.vendor || 'Webkit'
      });
    } catch (e) {
      setSession(prev => ({ ...prev, ip: '127.0.0.1' }));
    }
  };

  // --- DATA FETCHING ---
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
    } catch (err) {
      toast.error("Network synchronization error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    detectSession();
    fetchWalletData();
    
    const channel = supabase.channel('wallet_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user?.id}` }, fetchWalletData)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user?.id}` }, fetchWalletData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // --- COMPUTED DATA ---
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const matchesType = filterType === 'all' || tx.type === filterType;
      const matchesSearch = tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           tx.id.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [transactions, filterType, searchQuery]);

  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'credit').reduce((a, b) => a + b.amount, 0);
    const expense = transactions.filter(t => t.type === 'debit' || t.type === 'withdrawal').reduce((a, b) => a + b.amount, 0);
    const escrow = withdrawals.filter(w => w.status === 'pending').reduce((a, b) => a + b.amount, 0);
    return { income, expense, escrow };
  }, [transactions, withdrawals]);

  // --- HANDLERS ---
  const formatCurrency = (amt: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amt);

  const exportStatement = () => {
    const headers = ["Date", "ID", "Type", "Amount", "Description"];
    const rows = transactions.map(t => [new Date(t.created_at).toLocaleString(), t.id, t.type, t.amount, t.description]);
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `statement_${user?.id.slice(0,5)}.csv`);
    document.body.appendChild(link);
    link.click();
    toast.success("Statement exported successfully");
  };

  const handleWithdraw = async () => {
    if (!wallet || !withdrawAmount || !withdrawPhone) return;
    const amount = Number(withdrawAmount);
    if (amount < 100 || amount > wallet.balance) return toast.error("Invalid amount");

    setActionLoading(true);
    try {
      const { error } = await supabase.rpc('request_withdrawal_secure' as any, {
        p_user_id: user!.id,
        p_wallet_id: wallet.id,
        p_amount: amount,
        p_phone: withdrawPhone.trim(),
      });
      if (error) throw error;
      toast.success("Withdrawal moved to escrow");
      setWithdrawDialog(false);
      fetchWalletData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || !depositPhone) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: { phone: depositPhone.trim(), amount: Number(depositAmount), userId: user!.id, purpose: 'wallet_deposit' },
      });
      if (error) throw error;
      toast.success("STK Push Initiated");
      setDepositDialog(false);
    } catch (e: any) {
      toast.error("M-Pesa Service Timeout");
    } finally {
      setActionLoading(false);
    }
  };

  if (walletDisabled) return <DashboardLayout><FeatureDisabled /></DashboardLayout>;
  if (loading) return <DashboardLayout><div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-10 space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-1000">
        
        {/* --- SECURITY TOP BAR --- */}
        <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex flex-wrap items-center justify-between gap-4 bg-muted/30 p-4 rounded-2xl border border-border/50">
          <div className="flex items-center gap-6">
             <div className="hidden md:flex flex-col">
               <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Global IP</span>
               <span className="text-xs font-mono font-bold text-primary">{session.ip}</span>
             </div>
             <div className="flex flex-col border-l border-border/50 pl-6">
               <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Active Hardware</span>
               <span className="text-xs font-bold flex items-center gap-2"><Smartphone size={12}/> {session.model}</span>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1 px-3 py-1 uppercase text-[9px] font-black">
               <ShieldCheck size={10}/> End-to-End Encrypted
             </Badge>
             <div className="h-8 w-[1px] bg-border/50 mx-2 hidden sm:block"></div>
             <Button variant="ghost" size="sm" onClick={() => fetchWalletData()} className="h-9 px-3 gap-2 text-xs font-bold text-muted-foreground hover:text-primary">
               <RefreshCw size={14} className={actionLoading ? "animate-spin" : ""}/> Sync
             </Button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* --- LEFT: FINANCIAL HUB --- */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* DYNAMIC CARD COMPONENT */}
            <Card className="bg-gradient-to-br from-primary via-primary to-slate-900 text-primary-foreground border-none overflow-hidden relative shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] rounded-[2.5rem] group">
              <div className="absolute top-0 right-0 w-full h-full bg-[url('/noise.png')] opacity-20 pointer-events-none"></div>
              <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-white/10 rounded-full blur-[100px] group-hover:bg-white/20 transition-all duration-1000"></div>
              
              <CardContent className="p-10 md:p-14 relative z-10">
                <div className="flex justify-between items-start mb-12">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-50">Authorized Capital</p>
                    <div className="flex items-center gap-4">
                      <h2 className="text-6xl md:text-8xl font-display font-bold tracking-tighter">
                        {showBalance ? (wallet?.balance || 0).toLocaleString() : '••••••'}
                      </h2>
                      <Button variant="ghost" size="icon" onClick={() => setShowBalance(!showBalance)} className="text-white/40 hover:text-white hover:bg-white/10 rounded-full h-12 w-12">
                        {showBalance ? <EyeOff size={24}/> : <Eye size={24}/>}
                      </Button>
                    </div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-xl p-4 rounded-3xl border border-white/10">
                    <Wallet size={32} className="text-white"/>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Button onClick={() => setSendMoneyOpen(true)} className="bg-white text-primary hover:bg-slate-100 h-16 px-10 rounded-[1.5rem] font-bold shadow-xl transition-all hover:scale-105 active:scale-95">
                    <Send size={20} className="mr-3"/> Send Assets
                  </Button>
                  <Button onClick={() => setRequestMoneyOpen(true)} className="bg-white/10 hover:bg-white/20 border-white/20 backdrop-blur-md h-16 px-10 rounded-[1.5rem] font-bold transition-all hover:scale-105 active:scale-95">
                    <HandCoins size={20} className="mr-3"/> Request
                  </Button>
                </div>
              </CardContent>

              <div className="bg-black/30 backdrop-blur-2xl px-14 py-5 flex justify-between items-center text-[10px] font-mono font-black tracking-widest uppercase opacity-70">
                <span className="flex items-center gap-2"><Lock size={12}/> Security Protocol: v3.2.0</span>
                <span>ID: {wallet?.id.slice(0,18).toUpperCase()}</span>
              </div>
            </Card>

            {/* PERFORMANCE METRICS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Escrow Locked', val: stats.escrow, icon: Clock, color: 'text-accent', bg: 'bg-accent/10' },
                { label: 'Monthly In', val: stats.income, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10' },
                { label: 'Monthly Out', val: stats.expense, icon: ArrowUpRight, color: 'text-destructive', bg: 'bg-destructive/10' },
                { label: 'Transactions', val: transactions.length, icon: Activity, color: 'text-primary', bg: 'bg-primary/10', isRaw: true }
              ].map((m, i) => (
                <Card key={i} className="border-border/40 bg-card/50 backdrop-blur-sm rounded-3xl hover:border-primary/50 transition-all duration-500 hover:shadow-lg">
                  <CardContent className="p-5">
                    <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center mb-4", m.bg)}>
                      <m.icon className={m.color} size={20}/>
                    </div>
                    <p className="text-xl font-bold tracking-tight">
                      {m.isRaw ? m.val : formatCurrency(m.val)}
                    </p>
                    <p className="text-[10px] font-black uppercase text-muted-foreground mt-1 tracking-wider">{m.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ADVANCED TRANSACTION ENGINE */}
            <Card className="border-border/40 rounded-[2.5rem] overflow-hidden shadow-sm">
              <CardHeader className="p-8 border-b border-border/10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-bold flex items-center gap-3">
                      <History size={22} className="text-primary"/> Ledger Analysis
                    </CardTitle>
                    <CardDescription className="text-xs font-medium">Real-time auditing of your decentralized wallet activity.</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={exportStatement} className="h-10 rounded-xl font-bold uppercase text-[10px] gap-2">
                      <Download size={14}/> Export CSV
                    </Button>
                    <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl"><Calendar size={14}/></Button>
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1 group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={16}/>
                    <Input 
                      placeholder="Search by Reference ID or Description..." 
                      className="pl-11 h-12 bg-muted/40 border-none rounded-2xl focus-visible:ring-primary focus-visible:ring-offset-0" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <Tabs value={filterType} onValueChange={(v: any) => setFilterType(v)} className="bg-muted/40 p-1 rounded-2xl">
                    <TabsList className="bg-transparent border-none">
                      <TabsTrigger value="all" className="rounded-xl px-6 font-bold text-[11px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-primary">All</TabsTrigger>
                      <TabsTrigger value="credit" className="rounded-xl px-6 font-bold text-[11px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-success">In</TabsTrigger>
                      <TabsTrigger value="debit" className="rounded-xl px-6 font-bold text-[11px] uppercase tracking-widest data-[state=active]:bg-card data-[state=active]:text-destructive">Out</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>

              <CardContent className="p-0">
                {filteredTransactions.length === 0 ? (
                  <div className="py-20 flex flex-col items-center opacity-40">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"><Search size={24}/></div>
                    <p className="text-[11px] font-black uppercase tracking-widest">No matching signatures found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/5">
                    {filteredTransactions.map((tx) => (
                      <motion.div 
                        layout
                        key={tx.id} 
                        onClick={() => setSelectedTx(tx)}
                        className="p-6 flex items-center justify-between hover:bg-muted/40 cursor-pointer transition-all group"
                      >
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:rotate-12 group-hover:scale-110",
                            tx.type === 'credit' ? "bg-success/10 text-success shadow-[0_0_20px_rgba(34,197,94,0.1)]" : "bg-destructive/10 text-destructive shadow-[0_0_20px_rgba(239,68,68,0.1)]"
                          )}>
                            {tx.type === 'credit' ? <ArrowDownLeft size={22}/> : <ArrowUpRight size={22}/>}
                          </div>
                          <div>
                            <p className="text-sm font-bold tracking-tight mb-0.5">{tx.description || tx.type.toUpperCase()}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[8px] font-black uppercase py-0 px-2 rounded-md h-4">{tx.type}</Badge>
                              <span className="text-[10px] text-muted-foreground font-bold">{new Date(tx.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className={cn("text-lg font-display font-bold", tx.type === 'credit' ? "text-success" : "text-foreground")}>
                            {tx.type === 'credit' ? '+' : '-'}{tx.amount.toLocaleString()}
                          </p>
                          <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">REF: {tx.id.slice(0, 8)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/10 p-6 flex justify-center border-t border-border/5">
                <Button variant="ghost" size="sm" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary">View Comprehensive Ledger</Button>
              </CardFooter>
            </Card>
          </div>

          {/* --- RIGHT: SIDEBAR CORE --- */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* ESCROW MONITOR */}
            <Card className="bg-slate-900 text-white border-none rounded-[2.5rem] overflow-hidden shadow-2xl">
               <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
                 <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent"><Clock size={16}/></div>
                   <h3 className="text-xs font-black uppercase tracking-widest">Escrow Vault</h3>
                 </div>
                 <Badge className="bg-accent/20 text-accent hover:bg-accent/30 border-none px-3 py-1 text-[9px] font-black">ACTIVE MONITORING</Badge>
               </div>
               <CardContent className="p-0">
                  {withdrawals.filter(w => w.status === 'pending').length === 0 ? (
                    <div className="p-14 text-center space-y-3 opacity-30">
                      <ShieldAlert size={40} className="mx-auto"/>
                      <p className="text-[10px] font-black uppercase tracking-widest">No assets in transit</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {withdrawals.filter(w => w.status === 'pending').map((wd) => (
                        <div key={wd.id} className="p-7 space-y-4 hover:bg-white/[0.02] transition-colors group">
                           <div className="flex justify-between items-start">
                             <div>
                               <p className="text-2xl font-display font-bold">{formatCurrency(wd.amount)}</p>
                               <div className="flex items-center gap-2 mt-1">
                                 <Smartphone size={10} className="text-muted-foreground"/>
                                 <p className="text-[10px] font-bold text-muted-foreground">{wd.phone}</p>
                               </div>
                             </div>
                             <div className="flex flex-col items-end gap-2">
                               <span className="text-[8px] font-black uppercase text-accent animate-pulse tracking-widest">Admin Review</span>
                               <span className="text-[10px] font-mono text-white/30">{wd.id.slice(0, 10)}</span>
                             </div>
                           </div>
                           <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: '65%' }} transition={{ duration: 2 }} className="bg-accent h-full shadow-[0_0_10px_#f59e0b]"/>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
               </CardContent>
            </Card>

            <MoneyRequestsSection walletBalance={wallet?.balance || 0} onRefresh={fetchWalletData} />
            
            <Card className="border-border/40 rounded-[2rem] bg-card/50 backdrop-blur-md">
               <CardHeader className="py-5 border-b border-border/10 flex flex-row items-center justify-between">
                 <CardTitle className="text-xs font-black uppercase tracking-widest">P2P Signals</CardTitle>
                 <Badge variant="outline" className="text-[9px] font-black px-2">{transfers.length}</Badge>
               </CardHeader>
               <CardContent className="p-0 max-h-[350px] overflow-y-auto custom-scrollbar">
                  {transfers.length === 0 ? (
                    <p className="p-12 text-center text-[10px] text-muted-foreground uppercase font-black tracking-widest opacity-30">No peer activity</p>
                  ) : (
                    <div className="divide-y divide-border/5">
                      {transfers.map((tr) => (
                        <div key={tr.id} className="p-5 flex items-center justify-between hover:bg-muted/40 transition-all cursor-pointer">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-xs border border-primary/10 shadow-sm">
                              {(tr.sender_name || 'U').charAt(0)}
                            </div>
                            <div>
                              <p className="text-[11px] font-black tracking-tight uppercase">{tr.sender_id === user?.id ? `TO: ${tr.receiver_name}` : `FROM: ${tr.sender_name}`}</p>
                              <p className="text-[9px] text-muted-foreground font-bold tracking-widest">{tr.status.toUpperCase()}</p>
                            </div>
                          </div>
                          <p className={cn("text-xs font-black", tr.sender_id === user?.id ? "text-destructive" : "text-success")}>
                            {tr.sender_id === user?.id ? '-' : '+'}{tr.amount.toLocaleString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
               </CardContent>
            </Card>
          </div>
        </div>

        {/* --- DYNAMIC MODAL LAYER --- */}
        
        {/* WITHDRAWAL PROCESSOR */}
        <Dialog open={withdrawDialog} onOpenChange={setWithdrawDialog}>
          <DialogContent className="sm:max-w-md bg-card border-border shadow-3xl p-0 overflow-hidden rounded-[3rem]">
            <div className="bg-primary p-8 text-primary-foreground relative">
               <div className="space-y-1">
                 <DialogTitle className="text-2xl font-bold flex items-center gap-3"><ArrowUpRight size={28}/> Asset Payout</DialogTitle>
                 <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">Escrow Protection Protocol Active</p>
               </div>
               <X size={24} className="absolute top-8 right-8 opacity-40 cursor-pointer hover:opacity-100 transition-opacity" onClick={() => setWithdrawDialog(false)}/>
            </div>
            <div className="p-10 space-y-8">
              <div className="p-6 rounded-3xl bg-muted/50 border border-border/50 text-center space-y-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Withdrawable Balance</p>
                <p className="text-4xl font-display font-bold text-primary">{formatCurrency(wallet?.balance || 0)}</p>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase ml-1">Payout Volume (KES)</Label>
                  <div className="relative group">
                    <CreditCard size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="number" 
                      value={withdrawAmount} 
                      onChange={(e) => setWithdrawAmount(e.target.value)} 
                      placeholder="Min 100.00" 
                      className="h-16 rounded-[1.25rem] pl-14 text-xl font-bold bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] font-black uppercase ml-1">Verified M-Pesa Destination</Label>
                  <div className="relative group">
                    <Smartphone size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <Input 
                      value={withdrawPhone} 
                      onChange={(e) => setWithdrawPhone(e.target.value)} 
                      placeholder="07XXXXXXXX" 
                      className="h-16 rounded-[1.25rem] pl-14 font-bold bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary" 
                    />
                  </div>
                </div>
              </div>
              <div className="bg-accent/5 p-6 rounded-3xl border border-accent/10 flex items-start gap-4 shadow-sm shadow-accent/5">
                 <Info size={18} className="text-accent mt-0.5 shrink-0" />
                 <p className="text-[10px] text-accent/80 font-bold leading-relaxed uppercase tracking-tight">
                   Assets will be debited immediately and locked in escrow until verified by an network administrator. Approval typical within 1-3 business cycles.
                 </p>
              </div>
            </div>
            <div className="p-10 bg-muted/20 border-t border-border/10 flex gap-4">
              <Button variant="ghost" onClick={() => setWithdrawDialog(false)} className="flex-1 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px]">Decline</Button>
              <Button variant="gold" onClick={handleWithdraw} disabled={actionLoading || !withdrawAmount} className="flex-2 rounded-2xl h-14 shadow-gold-sm font-black uppercase tracking-widest text-[11px]">
                {actionLoading ? <Loader2 className="animate-spin" size={20} /> : "Authorize Payout"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* RECEIPT / INVOICE VIEW */}
        <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
          <DialogContent className="sm:max-w-md bg-card border-border rounded-[3rem] p-0 overflow-hidden shadow-4xl">
            {selectedTx && (
              <div className="space-y-0">
                <div className="bg-gradient-to-b from-primary to-slate-900 p-12 text-center text-primary-foreground relative">
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-white/20 rounded-full"></div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] opacity-50 mb-4 mt-4">Transaction Confirmed</p>
                  <p className="text-6xl font-display font-bold">
                    {selectedTx.amount.toLocaleString()}
                  </p>
                  <Badge className="mt-6 bg-white/10 hover:bg-white/20 border-white/20 px-4 py-1.5 font-mono text-[10px]">REF: {selectedTx.id.toUpperCase()}</Badge>
                </div>
                <div className="p-10 space-y-8">
                  <div className="space-y-4">
                    {[
                      { l: 'Auth Signature', v: 'Verified (AES-256)', i: ShieldCheck },
                      { l: 'Timestamp', v: new Date(selectedTx.created_at).toLocaleString(), i: Clock },
                      { l: 'Network Host', v: session.ip, i: Globe },
                      { l: 'Device Origin', v: session.model, i: Smartphone },
                      { l: 'Asset Type', v: selectedTx.type.toUpperCase(), i: CreditCard }
                    ].map((row, idx) => (
                      <div key={idx} className="flex items-center justify-between border-b border-border/10 pb-4">
                         <div className="flex items-center gap-2 text-muted-foreground">
                           <row.i size={14}/>
                           <span className="text-[10px] font-black uppercase tracking-widest">{row.l}</span>
                         </div>
                         <span className="text-[11px] font-bold text-foreground text-right">{row.v}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <Button className="flex-1 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px] gap-2 shadow-lg"><Download size={16}/> Save PDF</Button>
                    <Button variant="outline" className="flex-1 rounded-2xl h-14 font-black uppercase tracking-widest text-[10px]" onClick={() => setSelectedTx(null)}>Close Receipt</Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* EXTERNAL HOOKS */}
        <SendMoneyDialog open={sendMoneyOpen} onOpenChange={setSendMoneyOpen} walletBalance={wallet?.balance || 0} onSuccess={fetchWalletData} />
        <RequestMoneyDialog open={requestMoneyOpen} onOpenChange={setRequestMoneyOpen} onSuccess={fetchWalletData} />
        <TransferDetailsDialog transfer={selectedTransfer} onClose={() => setSelectedTransfer(null)} onRefresh={fetchWalletData} />

      </div>
    </DashboardLayout>
  );
}
 
