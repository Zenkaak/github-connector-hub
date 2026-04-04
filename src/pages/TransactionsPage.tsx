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

const getTxType = (ref: string) => {
  if (ref.startsWith('CHAMA_')) return { label: 'Chama Savings', color: 'text-primary', bg: 'bg-primary/10' };
  if (ref.startsWith('REPAY_')) return { label: 'Loan Repayment', color: 'text-accent', bg: 'bg-accent/10' };
  if (ref.startsWith('HRB_')) return { label: 'Harambee', color: 'text-pink-500', bg: 'bg-pink-500/10' };
  if (ref.startsWith('PSAV_')) return { label: 'Personal Savings', color: 'text-emerald-600', bg: 'bg-emerald-500/10' };
  return { label: 'Activation', color: 'text-success', bg: 'bg-success/10' };
};

const getTxTypeKey = (ref: string): TypeFilter => {
  if (ref.startsWith('CHAMA_')) return 'chama';
  if (ref.startsWith('REPAY_')) return 'repayment';
  if (ref.startsWith('HRB_')) return 'harambee';
  if (ref.startsWith('PSAV_')) return 'savings';
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
      
      const FIVE_MINUTES = 5 * 60 * 1000;
      const now = Date.now();
      const txns = (data as Transaction[]) || [];
      const expired = txns.filter(t => t.status === 'pending' && (now - new Date(t.created_at).getTime()) > FIVE_MINUTES);
      
      if (expired.length > 0) {
        await Promise.all(expired.map(t =>
          supabase.from('stk_transactions').update({
            status: 'failed' as any,
            result_code: 'EXPIRED',
            result_desc: 'Transaction expired - no response within 5 minutes',
          }).eq('id', t.id).eq('status', 'pending')
        ));
        const { data: refreshed } = await supabase
          .from('stk_transactions')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });
        setTransactions((refreshed as Transaction[]) || []);
      } else {
        setTransactions(txns);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const filtered = transactions.filter((t) => {
    const matchesFilter = filter === 'all' || t.status === filter;
    const matchesType = typeFilter === 'all' || getTxTypeKey(t.reference) === typeFilter;
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
    { label: 'Activation', value: 'activation', count: transactions.filter(t => getTxTypeKey(t.reference) === 'activation').length },
    { label: 'Chama', value: 'chama', count: transactions.filter(t => getTxTypeKey(t.reference) === 'chama').length },
    { label: 'Savings', value: 'savings', count: transactions.filter(t => getTxTypeKey(t.reference) === 'savings').length },
    { label: 'Repayment', value: 'repayment', count: transactions.filter(t => getTxTypeKey(t.reference) === 'repayment').length },
    { label: 'Harambee', value: 'harambee', count: transactions.filter(t => getTxTypeKey(t.reference) === 'harambee').length },
  ];

  return (
    <DashboardLayout>
      <div className="p-5 lg:p-8 space-y-6 max-w-[1200px]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold text-foreground">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-1">View all your payment & transfer history</p>
        </motion.div>

        {/* View Toggle */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <Button
            variant={activeView === 'mpesa' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('mpesa')}
            className="gap-1.5"
          >
            <Receipt size={14} /> M-Pesa ({transactions.length})
          </Button>
          <Button
            variant={activeView === 'wallet' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('wallet')}
            className="gap-1.5"
          >
            <Wallet size={14} /> Wallet ({walletTxns.length})
          </Button>
          <Button
            variant={activeView === 'transfers' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('transfers')}
            className="gap-1.5"
          >
            <Send size={14} /> Transfers ({transfers.length})
          </Button>
          <Button
            variant={activeView === 'requests' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('requests')}
            className="gap-1.5"
          >
            <HandCoins size={14} /> Requests ({requests.length})
          </Button>
        </div>

        {activeView === 'mpesa' ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Total Transactions', value: stats.total, icon: Wallet, color: 'text-primary', bg: 'bg-primary/10' },
                { label: 'Successful', value: stats.successful, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
                { label: 'Failed', value: stats.failed, icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
                { label: 'Total Paid', value: formatCurrency(stats.totalAmount), icon: ArrowUpRight, color: 'text-accent', bg: 'bg-accent/10' },
              ].map((stat, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}>
                  <Card className="border-border/50 hover:border-accent/20 transition-all">
                    <CardContent className="p-4">
                      <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                        <stat.icon className={stat.color} size={18} />
                      </div>
                      <p className="text-xl font-bold font-display">{stat.value}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Filters & Search */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                   <div className="flex flex-col gap-2">
                     <div className="flex items-center gap-2 overflow-x-auto pb-1">
                       {filters.map((f) => (
                         <button
                           key={f.value}
                           onClick={() => setFilter(f.value)}
                           className={cn(
                             'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                             filter === f.value
                               ? 'bg-primary text-primary-foreground'
                               : 'bg-muted text-muted-foreground hover:bg-muted/80'
                           )}
                         >
                           {f.label}
                           <span className={cn('px-1.5 py-0.5 rounded-md text-[10px]', filter === f.value ? 'bg-primary-foreground/20' : 'bg-background')}>
                             {f.count}
                           </span>
                         </button>
                       ))}
                     </div>
                     <div className="flex items-center gap-2 overflow-x-auto pb-1">
                       {typeFilters.map((f) => (
                         <button
                           key={f.value}
                           onClick={() => setTypeFilter(f.value)}
                           className={cn(
                             'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
                             typeFilter === f.value
                               ? 'bg-accent text-accent-foreground'
                               : 'bg-muted text-muted-foreground hover:bg-muted/80'
                           )}
                         >
                           {f.label}
                           <span className={cn('px-1.5 py-0.5 rounded-md text-[10px]', typeFilter === f.value ? 'bg-accent-foreground/20' : 'bg-background')}>
                             {f.count}
                           </span>
                         </button>
                       ))}
                     </div>
                   </div>
                    <div className="relative w-full sm:w-64">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by reference or phone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 h-9 text-sm"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
                      ))}
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                        <Wallet size={22} className="text-muted-foreground" />
                      </div>
                      <p className="font-semibold text-sm mb-1">No transactions found</p>
                      <p className="text-xs text-muted-foreground">
                        {filter !== 'all' ? 'Try changing the filter' : 'Your transaction history will appear here'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filtered.map((tx, i) => {
                        const config = statusConfig[tx.status];
                        const StatusIcon = config.icon;
                        return (
                          <motion.div
                            key={tx.id}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.02 * i }}
                            onClick={() => setSelectedTx(tx)}
                            className={cn(
                              'flex items-center justify-between p-4 rounded-xl border transition-colors cursor-pointer',
                              'bg-muted/30 hover:bg-muted/50',
                              config.border
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', config.bg)}>
                                <StatusIcon className={config.color} size={18} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-sm truncate">{tx.reference}</p>
                                  {(() => { const t = getTxType(tx.reference); return (
                                    <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0', t.bg, t.color)}>{t.label}</span>
                                  ); })()}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{tx.phone}</span>
                                  <span className="text-muted-foreground/30">·</span>
                                  <span className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="font-bold text-sm">{formatCurrency(tx.amount)}</p>
                                <span className={cn('text-[11px] font-medium', config.color)}>{config.label}</span>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </>
        ) : activeView === 'wallet' ? (
          /* ===== WALLET TRANSACTIONS VIEW ===== */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="text-base font-semibold flex items-center gap-2">
                  <Wallet size={16} className="text-primary" /> Wallet Activity
                </div>
                <p className="text-xs text-muted-foreground">Deposits, withdrawals, and wallet movements</p>
                <div className="flex gap-1.5 mt-2 overflow-x-auto">
                  {(['all', 'deposit', 'credit', 'debit', 'withdrawal'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setWalletFilter(f)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all capitalize',
                        walletFilter === f
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {f === 'all' ? 'All' : f} ({f === 'all' ? walletTxns.length : walletTxns.filter(t => t.type === f).length})
                    </button>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filtered = walletFilter === 'all' ? walletTxns : walletTxns.filter(t => t.type === walletFilter);
                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                          <Wallet size={22} className="text-muted-foreground" />
                        </div>
                        <p className="font-semibold text-sm mb-1">No wallet transactions</p>
                        <p className="text-xs text-muted-foreground">Your wallet activity will appear here</p>
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-2">
                      {filtered.map((tx: any) => {
                        const isIncoming = tx.type === 'deposit' || tx.type === 'credit';
                        return (
                          <div
                            key={tx.id}
                            className={cn(
                              'flex items-center justify-between p-3 rounded-xl border transition-colors',
                              'bg-muted/30 hover:bg-muted/50',
                              isIncoming ? 'border-success/20' : 'border-destructive/20'
                            )}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                                isIncoming ? 'bg-success/10' : 'bg-destructive/10'
                              )}>
                                {isIncoming ? <ArrowDownLeft size={16} className="text-success" /> : <ArrowUpRight size={16} className="text-destructive" />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate capitalize">{tx.type}</p>
                                <p className="text-xs text-muted-foreground truncate">{tx.description || 'Wallet transaction'}</p>
                                <p className="text-[10px] text-muted-foreground">{formatDate(tx.created_at)}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn('font-bold text-sm', isIncoming ? 'text-success' : 'text-destructive')}>
                                {isIncoming ? '+' : '-'}{formatCurrency(tx.amount)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </motion.div>
        ) : activeView === 'transfers' ? (
          /* ===== WALLET TRANSFERS VIEW ===== */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="text-base font-semibold flex items-center gap-2">
                  <Send size={16} className="text-primary" /> Wallet Transfers
                </div>
                <p className="text-xs text-muted-foreground">Money sent & received between DataVend wallets</p>
              </CardHeader>
              <CardContent>
                {transfers.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                      <Send size={22} className="text-muted-foreground" />
                    </div>
                    <p className="font-semibold text-sm mb-1">No transfers yet</p>
                    <p className="text-xs text-muted-foreground">Your wallet transfer history will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {transfers.map((tr: any, i: number) => {
                      const isSender = tr.sender_id === user?.id;
                      return (
                        <div
                          key={tr.id}
                          onClick={() => setSelectedTransfer(tr)}
                          className={cn(
                            'p-4 rounded-xl border transition-colors cursor-pointer',
                            tr.status === 'cancelled' ? 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10' : 'bg-muted/30 border-border/40 hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                                tr.status === 'cancelled' ? 'bg-destructive/10' : isSender ? 'bg-destructive/10' : 'bg-success/10'
                              )}>
                                {tr.status === 'cancelled' ? <XCircle size={16} className="text-destructive" /> :
                                  isSender ? <ArrowUpRight size={16} className="text-destructive" /> :
                                  <ArrowDownLeft size={16} className="text-success" />}
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm">
                                  {isSender ? `To ${tr.receiver_name || 'Unknown'}` : `From ${tr.sender_name || 'Unknown'}`}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {tr.reason || 'No reason'} · {formatDate(tr.created_at)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className={cn('font-bold text-sm', tr.status === 'cancelled' ? 'text-muted-foreground line-through' : isSender ? 'text-destructive' : 'text-success')}>
                                {isSender ? '-' : '+'}{formatCurrency(tr.amount)}
                              </p>
                              {tr.status === 'cancelled' && (
                                <span className="text-[10px] font-bold text-destructive">CANCELLED</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* ===== MONEY REQUESTS VIEW ===== */
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="text-base font-semibold flex items-center gap-2">
                  <HandCoins size={16} className="text-accent" /> Money Requests
                </div>
                <p className="text-xs text-muted-foreground">Requests you sent or received</p>
              </CardHeader>
              <CardContent>
                {requests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                      <HandCoins size={22} className="text-muted-foreground" />
                    </div>
                    <p className="font-semibold text-sm mb-1">No requests yet</p>
                    <p className="text-xs text-muted-foreground">Money requests will appear here</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {requests.map((req, i) => {
                      const isRequester = req.requester_id === user?.id;
                      const otherName = requestNames[isRequester ? req.requested_from_id : req.requester_id] || 'Unknown';
                      const statusColor = req.status === 'paid' ? 'text-success' : req.status === 'declined' ? 'text-destructive' : 'text-accent';
                      const statusBg = req.status === 'paid' ? 'bg-success/10' : req.status === 'declined' ? 'bg-destructive/10' : 'bg-accent/10';
                      const StatusIcon = req.status === 'paid' ? CheckCircle2 : req.status === 'declined' ? XCircle : Clock;

                      return (
                        <motion.div
                          key={req.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.02 * i }}
                          onClick={() => setSelectedRequest(req)}
                          className={cn(
                            'p-4 rounded-xl border transition-colors cursor-pointer',
                            req.status === 'paid' ? 'bg-success/5 border-success/20 hover:bg-success/10' :
                            req.status === 'declined' ? 'bg-destructive/5 border-destructive/20 hover:bg-destructive/10' :
                            'bg-muted/30 border-border/40 hover:bg-muted/50'
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', statusBg)}>
                                <StatusIcon className={statusColor} size={16} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-sm">
                                  {isRequester
                                    ? `You requested from ${otherName}`
                                    : `${otherName} requested from you`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(req.created_at)}
                                </p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold text-sm">{formatCurrency(req.amount)}</p>
                              <span className={cn('text-[10px] font-bold uppercase', statusColor)}>
                                {req.status}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Transaction Detail Dialog */}
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
                    { icon: Info, label: 'Type', value: getTxType(selectedTx.reference).label },
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

      {/* Transfer Detail Dialog */}
      <TransferDetailsDialog
        transfer={selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        onRefresh={fetchTransactions}
      />

      {/* Request Detail Dialog */}
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
