import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  Search,
  X,
  Phone,
  Hash,
  Calendar,
  Receipt,
  Info,
  Send,
  User,
  HandCoins,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TransferDetailsDialog } from '@/components/TransferDetailsDialog';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  amount: number;
  phone: string;
  reference: string;
  status: 'pending' | 'success' | 'failed';
  mpesa_receipt: string | null;
  result_desc: string | null;
  checkout_request_id: string | null;
  purpose: string | null;
  created_at: string;
}

interface MoneyRequest {
  id: string;
  requester_id: string;
  requested_from_id: string;
  amount: number;
  status: string;
  created_at: string;
}

type FilterStatus = 'all' | 'success' | 'failed' | 'pending';
type TypeFilter = 'all' | 'activation' | 'chama' | 'repayment' | 'harambee' | 'savings';

const statusConfig = {
  success: { label: 'Successful', icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  failed: { label: 'Failed', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' },
  pending: { label: 'Pending', icon: Clock, color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
};

const getTxType = (ref: string, purpose?: string) => {
  if (ref.startsWith('CHAMA_') || purpose === 'chama_savings') return { label: 'Chama Savings', color: 'text-primary', bg: 'bg-primary/10' };
  if (ref.startsWith('REPAY_') || purpose === 'loan_repayment') return { label: 'Loan Repayment', color: 'text-accent', bg: 'bg-accent/10' };
  if (ref.startsWith('HRB_') || purpose === 'harambee') return { label: 'Harambee', color: 'text-pink-500', bg: 'bg-pink-500/10' };
  if (ref.startsWith('PSAV_') || purpose === 'personal_savings') return { label: 'Personal Savings', color: 'text-emerald-600', bg: 'bg-emerald-500/10' };
  if (ref.startsWith('DEP_') || purpose === 'wallet_deposit') return { label: 'Wallet Deposit', color: 'text-blue-500', bg: 'bg-blue-500/10' };
  if (ref.startsWith('CJFEE_') || purpose === 'chama_joining_fee') return { label: 'Joining Fee', color: 'text-purple-500', bg: 'bg-purple-500/10' };
  if (ref.startsWith('ACT_') || purpose === 'activation') return { label: 'Activation', color: 'text-success', bg: 'bg-success/10' };
  return { label: 'Payment', color: 'text-success', bg: 'bg-success/10' };
};

const getTxTypeKey = (ref: string, purpose?: string): TypeFilter => {
  if (ref.startsWith('CHAMA_') || purpose === 'chama_savings') return 'chama';
  if (ref.startsWith('REPAY_') || purpose === 'loan_repayment') return 'repayment';
  if (ref.startsWith('HRB_') || purpose === 'harambee') return 'harambee';
  if (ref.startsWith('PSAV_') || purpose === 'personal_savings') return 'savings';
  return 'activation';
};

export default function TransactionsPage() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transfers, setTransfers] = useState<any[]>([]);
  const [requests, setRequests] = useState<MoneyRequest[]>([]);
  const [walletTxns, setWalletTxns] = useState<any[]>([]);
  const [requestNames, setRequestNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<any>(null);
  const [selectedRequest, setSelectedRequest] = useState<MoneyRequest | null>(null);
  const [activeView, setActiveView] = useState<'mpesa' | 'wallet' | 'transfers' | 'requests'>('mpesa');
  const [walletFilter, setWalletFilter] = useState<'all' | 'deposit' | 'credit' | 'debit' | 'withdrawal'>('all');

  useEffect(() => {
    if (user) fetchTransactions();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('stk-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stk_transactions', filter: `user_id=eq.${user.id}` }, () => {
        fetchTransactions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wallet_transactions', filter: `user_id=eq.${user.id}` }, () => {
        fetchTransactions();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchTransactions = async () => {
    try {
      const [stkRes, trRes, reqRes, walletRes] = await Promise.all([
        supabase
          .from('stk_transactions')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('wallet_transfers')
          .select('*')
          .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('money_requests')
          .select('*')
          .or(`requester_id.eq.${user?.id},requested_from_id.eq.${user?.id}`)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('wallet_transactions')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (walletRes.data) setWalletTxns(walletRes.data);
      if (trRes.data) setTransfers(trRes.data);

      if (reqRes.data && reqRes.data.length > 0) {
        setRequests(reqRes.data);
        const userIds = [...new Set(reqRes.data.map(r => r.requester_id === user?.id ? r.requested_from_id : r.requester_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds);
        if (profiles) {
          const nameMap: Record<string, string> = {};
          profiles.forEach(p => { nameMap[p.user_id] = p.full_name; });
          setRequestNames(nameMap);
        }
      }

      const data = stkRes.data;
      const error = stkRes.error;
      if (error) throw error;

      const txns = (data as Transaction[]) || [];
      setTransactions(txns);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = transactions.filter((t) => {
    const matchesFilter = filter === 'all' || t.status === filter;
    const matchesType = typeFilter === 'all' || getTxTypeKey(t.reference, t.purpose || undefined) === typeFilter;
    const matchesSearch =
      search === '' ||
      t.reference.toLowerCase().includes(search.toLowerCase()) ||
      t.phone.includes(search) ||
      (t.mpesa_receipt && t.mpesa_receipt.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesType && matchesSearch;
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-KE', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });

  const stats = {
    total: transactions.length,
    successful: transactions.filter((t) => t.status === 'success').length,
    failed: transactions.filter((t) => t.status === 'failed').length,
    totalAmount: transactions.filter((t) => t.status === 'success').reduce((sum, t) => sum + t.amount, 0),
  };

  const filters: { label: string; value: FilterStatus; count: number }[] = [
    { label: 'All', value: 'all', count: stats.total },
    { label: 'Successful', value: 'success', count: stats.successful },
    { label: 'Failed', value: 'failed', count: stats.failed },
    { label: 'Pending', value: 'pending', count: transactions.filter((t) => t.status === 'pending').length },
  ];

  const typeFilters: { label: string; value: TypeFilter; count: number }[] = [
    { label: 'All Types', value: 'all', count: transactions.length },
    { label: 'Activation', value: 'activation', count: transactions.filter(t => getTxTypeKey(t.reference, t.purpose || undefined) === 'activation').length },
    { label: 'Chama', value: 'chama', count: transactions.filter(t => getTxTypeKey(t.reference, t.purpose || undefined) === 'chama').length },
    { label: 'Savings', value: 'savings', count: transactions.filter(t => getTxTypeKey(t.reference, t.purpose || undefined) === 'savings').length },
    { label: 'Repayment', value: 'repayment', count: transactions.filter(t => getTxTypeKey(t.reference, t.purpose || undefined) === 'repayment').length },
    { label: 'Harambee', value: 'harambee', count: transactions.filter(t => getTxTypeKey(t.reference, t.purpose || undefined) === 'harambee').length },
  ];

  const quickActions = [
    { label: 'M-Pesa', value: 'mpesa' as const, icon: Receipt, count: transactions.length, desc: 'STK payments' },
    { label: 'Wallet', value: 'wallet' as const, icon: Wallet, count: walletTxns.length, desc: 'Wallet activity' },
    { label: 'Transfers', value: 'transfers' as const, icon: Send, count: transfers.length, desc: 'Sent & received' },
    { label: 'Requests', value: 'requests' as const, icon: HandCoins, count: requests.length, desc: 'Money requests' },
  ];

  const groupByDate = <T extends { created_at: string }>(items: T[]) => {
    const groups: Record<string, T[]> = {};
    items.forEach(item => {
      const date = new Date(item.created_at).toLocaleDateString('en-KE', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return groups;
  };

  return (
    <DashboardLayout>
      <div className="p-5 lg:p-8 space-y-6 max-w-[1200px]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">View all your payment & transfer history</p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((action, i) => (
            <motion.div
              key={action.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
            >
              <button
                onClick={() => setActiveView(action.value)}
                className={cn(
                  'w-full text-left p-4 rounded-2xl border-2 transition-all duration-200',
                  activeView === action.value
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border/50 bg-card hover:border-primary/30 hover:shadow-sm'
                )}
              >
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center mb-3',
                  activeView === action.value ? 'bg-primary/10' : 'bg-muted'
                )}>
                  <action.icon
                    size={18}
                    className={activeView === action.value ? 'text-primary' : 'text-muted-foreground'}
                  />
                </div>
                <p className="font-semibold text-sm">{action.label}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                  <span className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-full',
                    activeView === action.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                  )}>
                    {action.count}
                  </span>
                </div>
              </button>
            </motion.div>
          ))}
        </div>

        {activeView === 'mpesa' && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-4 gap-3"
            >
              {[
                { label: 'Total', value: stats.total, color: 'text-foreground' },
                { label: 'Successful', value: stats.successful, color: 'text-success' },
                { label: 'Failed', value: stats.failed, color: 'text-destructive' },
                { label: 'Paid', value: formatCurrency(stats.totalAmount), color: 'text-primary' },
              ].map((stat, i) => (
                <div key={i} className="text-center p-3 rounded-xl bg-muted/30 border border-border/30">
                  <p className={cn('text-lg font-bold font-display', stat.color)}>{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
                </div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="space-y-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by reference, phone or receipt..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-10 text-sm bg-card border-border/50"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X size={14} className="text-muted-foreground" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0 mr-1">Status</span>
                  {filters.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFilter(f.value)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                        filter === f.value
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {f.label}
                      <span className={cn(
                        'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                        filter === f.value ? 'bg-primary-foreground/20' : 'bg-background/80'
                      )}>
                        {f.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0 mr-1">Type</span>
                  {typeFilters.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setTypeFilter(f.value)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                        typeFilter === f.value
                          ? 'bg-accent text-accent-foreground shadow-sm'
                          : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                      )}
                    >
                      {f.label}
                      {f.count > 0 && (
                        <span className={cn(
                          'px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                          typeFilter === f.value ? 'bg-accent-foreground/20' : 'bg-background/80'
                        )}>
                          {f.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                    <Wallet size={22} className="text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-sm mb-1">No transactions found</p>
                  <p className="text-xs text-muted-foreground">
                    {filter !== 'all' || typeFilter !== 'all' ? 'Try changing filters' : 'Your transaction history will appear here'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(groupByDate(filtered)).map(([date, txns]) => (
                    <div key={date}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{date}</p>
                      <Card className="border-border/40 overflow-hidden">
                        <div className="divide-y divide-border/30">
                          {txns.map((tx) => {
                            const config = statusConfig[tx.status];
                            const StatusIcon = config.icon;
                            const txType = getTxType(tx.reference, tx.purpose || undefined);
                            return (
                              <div
                                key={tx.id}
                                onClick={() => setSelectedTx(tx)}
                                className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', config.bg)}>
                                    <StatusIcon className={config.color} size={18} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', txType.bg, txType.color)}>
                                        {txType.label}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-xs text-muted-foreground">{tx.phone}</span>
                                      <span className="text-muted-foreground/30">·</span>
                                      <span className="text-xs text-muted-foreground">{formatTime(tx.created_at)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="font-bold text-sm tabular-nums">{formatCurrency(tx.amount)}</p>
                                  <span className={cn('text-[10px] font-semibold', config.color)}>{config.label}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </>
        )}

        {activeView === 'wallet' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 overflow-x-auto pb-3">
              {(['all', 'deposit', 'credit', 'debit', 'withdrawal'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setWalletFilter(f)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all capitalize',
                    walletFilter === f
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                  )}
                >
                  {f === 'all' ? 'All' : f} ({f === 'all' ? walletTxns.length : walletTxns.filter(t => t.type === f).length})
                </button>
              ))}
            </div>

            {(() => {
              const filteredWallet = walletFilter === 'all' ? walletTxns : walletTxns.filter(t => t.type === walletFilter);
              if (filteredWallet.length === 0) {
                return (
                  <div className="text-center py-16">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                      <Wallet size={22} className="text-muted-foreground" />
                    </div>
                    <p className="font-semibold text-sm mb-1">No wallet transactions</p>
                    <p className="text-xs text-muted-foreground">Your wallet activity will appear here</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {Object.entries(groupByDate(filteredWallet)).map(([date, txns]) => (
                    <div key={date}>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{date}</p>
                      <Card className="border-border/40 overflow-hidden">
                        <div className="divide-y divide-border/30">
                          {txns.map((tx: any) => {
                            const isIncoming = tx.type === 'deposit' || tx.type === 'credit';
                            return (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                    isIncoming ? 'bg-success/10' : 'bg-destructive/10'
                                  )}>
                                    {isIncoming
                                      ? <ArrowDownLeft size={16} className="text-success" />
                                      : <ArrowUpRight size={16} className="text-destructive" />
                                    }
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-medium text-sm capitalize">{tx.type}</p>
                                    <p className="text-xs text-muted-foreground truncate">{tx.description || 'Wallet transaction'}</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={cn('font-bold text-sm tabular-nums', isIncoming ? 'text-success' : 'text-destructive')}>
                                    {isIncoming ? '+' : '-'}{formatCurrency(tx.amount)}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">{formatTime(tx.created_at)}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    </div>
                  ))}
                </div>
              );
            })()}
          </motion.div>
        )}

        {activeView === 'transfers' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {transfers.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                  <Send size={22} className="text-muted-foreground" />
                </div>
                <p className="font-semibold text-sm mb-1">No transfers yet</p>
                <p className="text-xs text-muted-foreground">Your wallet transfer history will appear here</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupByDate(transfers)).map(([date, txns]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{date}</p>
                    <Card className="border-border/40 overflow-hidden">
                      <div className="divide-y divide-border/30">
                        {txns.map((tr: any) => {
                          const isSender = tr.sender_id === user?.id;
                          return (
                            <div
                              key={tr.id}
                              onClick={() => setSelectedTransfer(tr)}
                              className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                                  tr.status === 'cancelled' ? 'bg-destructive/10' : isSender ? 'bg-destructive/10' : 'bg-success/10'
                                )}>
                                  {tr.status === 'cancelled'
                                    ? <XCircle size={16} className="text-destructive" />
                                    : isSender
                                      ? <ArrowUpRight size={16} className="text-destructive" />
                                      : <ArrowDownLeft size={16} className="text-success" />
                                  }
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm">
                                    {isSender ? `To ${tr.receiver_name || 'Unknown'}` : `From ${tr.sender_name || 'Unknown'}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {tr.reason || 'No reason'} · {formatTime(tr.created_at)}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={cn(
                                  'font-bold text-sm tabular-nums',
                                  tr.status === 'cancelled' ? 'text-muted-foreground line-through' : isSender ? 'text-destructive' : 'text-success'
                                )}>
                                  {isSender ? '-' : '+'}{formatCurrency(tr.amount)}
                                </p>
                                {tr.status === 'cancelled' && (
                                  <span className="text-[10px] font-bold text-destructive uppercase">Cancelled</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {activeView === 'requests' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            {requests.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                  <HandCoins size={22} className="text-muted-foreground" />
                </div>
                <p className="font-semibold text-sm mb-1">No requests yet</p>
                <p className="text-xs text-muted-foreground">Money requests will appear here</p>
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupByDate(requests)).map(([date, reqs]) => (
                  <div key={date}>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">{date}</p>
                    <Card className="border-border/40 overflow-hidden">
                      <div className="divide-y divide-border/30">
                        {reqs.map((req) => {
                          const isRequester = req.requester_id === user?.id;
                          const otherName = requestNames[isRequester ? req.requested_from_id : req.requester_id] || 'Unknown';
                          const statusColor = req.status === 'paid' ? 'text-success' : req.status === 'declined' ? 'text-destructive' : 'text-accent';
                          const statusBg = req.status === 'paid' ? 'bg-success/10' : req.status === 'declined' ? 'bg-destructive/10' : 'bg-accent/10';
                          const StatusIcon = req.status === 'paid' ? CheckCircle2 : req.status === 'declined' ? XCircle : Clock;

                          return (
                            <div
                              key={req.id}
                              onClick={() => setSelectedRequest(req)}
                              className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/30 transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', statusBg)}>
                                  <StatusIcon className={statusColor} size={16} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm">
                                    {isRequester ? `Requested from ${otherName}` : `${otherName} requested`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{formatTime(req.created_at)}</p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-bold text-sm tabular-nums">{formatCurrency(req.amount)}</p>
                                <span className={cn('text-[10px] font-bold uppercase', statusColor)}>{req.status}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Transaction Details</DialogTitle>
          </DialogHeader>
          {selectedTx && (() => {
            const config = statusConfig[selectedTx.status];
            const StatusIcon = config.icon;
            return (
              <div className="space-y-5">
                <div className="text-center py-4">
                  <div className={cn('w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center', config.bg)}>
                    <StatusIcon className={config.color} size={24} />
                  </div>
                  <p className="text-3xl font-bold font-display">{formatCurrency(selectedTx.amount)}</p>
                  <span className={cn('inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold', config.bg, config.color)}>
                    {config.label}
                  </span>
                </div>

                <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                  {[
                    { icon: Hash, label: 'Reference', value: selectedTx.reference },
                    { icon: Info, label: 'Type', value: getTxType(selectedTx.reference, (selectedTx as any).purpose || undefined).label },
                    { icon: Phone, label: 'Phone', value: selectedTx.phone },
                    { icon: Calendar, label: 'Date', value: formatDate(selectedTx.created_at) },
                    { icon: Receipt, label: 'M-Pesa Receipt', value: selectedTx.mpesa_receipt || '—' },
                    { icon: Info, label: 'Description', value: selectedTx.result_desc || '—' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                        <item.icon size={14} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                        <p className="text-sm font-medium break-all">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="outline" className="w-full" onClick={() => setSelectedTx(null)}>
                  Close
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <TransferDetailsDialog
        transfer={selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        onRefresh={fetchTransactions}
      />

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <HandCoins size={16} /> Request Details
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (() => {
            const isRequester = selectedRequest.requester_id === user?.id;
            const otherName = requestNames[isRequester ? selectedRequest.requested_from_id : selectedRequest.requester_id] || 'Unknown';
            const statusColor = selectedRequest.status === 'paid' ? 'text-success' : selectedRequest.status === 'declined' ? 'text-destructive' : 'text-accent';
            const statusBg = selectedRequest.status === 'paid' ? 'bg-success/10' : selectedRequest.status === 'declined' ? 'bg-destructive/10' : 'bg-accent/10';
            const StatusIcon = selectedRequest.status === 'paid' ? CheckCircle2 : selectedRequest.status === 'declined' ? XCircle : Clock;

            return (
              <div className="space-y-5">
                <div className="text-center py-4">
                  <div className={cn('w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center', statusBg)}>
                    <StatusIcon className={statusColor} size={24} />
                  </div>
                  <p className="text-3xl font-bold font-display">{formatCurrency(selectedRequest.amount)}</p>
                  <span className={cn('inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold uppercase', statusBg, statusColor)}>
                    {selectedRequest.status}
                  </span>
                </div>

                <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
                  <div className="text-center flex-1">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-1">
                      <User size={16} className="text-accent" />
                    </div>
                    <p className="text-xs font-medium truncate">{isRequester ? 'You' : otherName}</p>
                    <p className="text-[10px] text-muted-foreground">Requester</p>
                  </div>
                  <HandCoins size={18} className="text-muted-foreground shrink-0" />
                  <div className="text-center flex-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-1">
                      <User size={16} className="text-primary" />
                    </div>
                    <p className="text-xs font-medium truncate">{isRequester ? otherName : 'You'}</p>
                    <p className="text-[10px] text-muted-foreground">Target</p>
                  </div>
                </div>

                <div className="space-y-3 bg-muted/30 rounded-xl p-4">
                  {[
                    { icon: Calendar, label: 'Date', value: formatDate(selectedRequest.created_at) },
                    { icon: Hash, label: 'Request ID', value: selectedRequest.id.slice(0, 16) + '...' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                        <item.icon size={14} className="text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                        <p className="text-sm font-medium break-all">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button variant="outline" className="w-full" onClick={() => setSelectedRequest(null)}>
                  Close
                </Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
