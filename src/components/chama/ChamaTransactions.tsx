import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Receipt, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Phone, 
  Hash, 
  Calendar, 
  Info, 
  Eye, 
  RefreshCw,
  ArrowDownRight,
  Filter,
  Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Props {
  groupId: string;
  members: Array<{ 
    user_id: string; 
    role: string; 
    profile?: { 
      full_name: string; 
      phone: string;
      avatar_url?: string;
    } 
  }>;
}

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
  user_id: string;
  purpose: string | null;
  group_id: string | null;
}

const statusConfig = {
  success: { 
    label: 'Successful', 
    icon: CheckCircle2, 
    color: 'text-emerald-500', 
    bg: 'bg-emerald-500/10', 
    border: 'border-emerald-500/20' 
  },
  failed: { 
    label: 'Failed', 
    icon: XCircle, 
    color: 'text-destructive', 
    bg: 'bg-destructive/10', 
    border: 'border-destructive/20' 
  },
  pending: { 
    label: 'Pending', 
    icon: Clock, 
    color: 'text-amber-500', 
    bg: 'bg-amber-500/10', 
    border: 'border-amber-500/20' 
  },
};

export function ChamaTransactions({ groupId, members }: Props) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [confirmedReceipts, setConfirmedReceipts] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [subTab, setSubTab] = useState<'mine' | 'all'>('mine');

  const getMemberName = (userId: string) => 
    members.find(m => m.user_id === userId)?.profile?.full_name || 'Unknown Member';

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      // 1. Fetch STK Transactions
      // 2. Fetch Actual Confirmed Savings to cross-reference "Pending" vs "Actual"
      const [txRes, savingsRes] = await Promise.all([
        supabase
          .from('stk_transactions')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', { ascending: false }),
        supabase
          .from('chama_savings')
          .select('mpesa_receipt')
          .eq('group_id', groupId)
      ]);

      if (txRes.data) {
        setTransactions(txRes.data as Transaction[]);
      }
      
      if (savingsRes.data) {
        const validReceipts = new Set(
          savingsRes.data
            .map(s => s.mpesa_receipt)
            .filter((r): r is string => !!r)
        );
        setConfirmedReceipts(validReceipts);
      }
    } catch (error) {
      console.error("Critical error in transaction fetch:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Real-time listeners for instant status updates on callback
    const channel = supabase
      .channel(`tx-updates-${groupId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'stk_transactions', 
        filter: `group_id=eq.${groupId}` 
      }, () => fetchData(true))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'chama_savings', 
        filter: `group_id=eq.${groupId}` 
      }, () => fetchData(true))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);

  const formatDate = (d: string) => 
    new Date(d).toLocaleDateString('en-KE', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });

  // --- LOGIC: OVERRIDE PENDING STATUS IF RECORD EXISTS IN SAVINGS TABLE ---
  const processedTransactions = useMemo(() => {
    return transactions.map(t => {
      const isConfirmedInSavings = t.mpesa_receipt && confirmedReceipts.has(t.mpesa_receipt);
      return {
        ...t,
        status: isConfirmedInSavings ? 'success' as const : t.status
      };
    });
  }, [transactions, confirmedReceipts]);

  const filtered = processedTransactions.filter(t => {
    const matchesTab = subTab === 'mine' ? t.user_id === user?.id : true;
    const matchesSearch = !search || 
      t.reference.toLowerCase().includes(search.toLowerCase()) || 
      t.phone.includes(search) || 
      (t.mpesa_receipt && t.mpesa_receipt.toLowerCase().includes(search.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const myTxnsCount = processedTransactions.filter(t => t.user_id === user?.id).length;
  const successfulTotal = filtered
    .filter(t => t.status === 'success')
    .reduce((s, t) => s + t.amount, 0);

  const successCount = filtered.filter(t => t.status === 'success').length;
  const pendingCount = filtered.filter(t => t.status === 'pending').length;
  const failedCount = filtered.filter(t => t.status === 'failed').length;

  return (
    <div className="space-y-6">
      {/* 1. KEY ANALYTICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-primary relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-10px] opacity-5">
            <Receipt size={80} />
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Total Confirmed</p>
          <p className="text-2xl font-black text-primary">{formatCurrency(successfulTotal)}</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Successful</p>
          <p className="text-2xl font-black text-emerald-500">{successCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Processed correctly</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-amber-500">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pending</p>
          <p className="text-2xl font-black text-amber-500">{pendingCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Awaiting callback</p>
        </Card>

        <Card className="p-4 border-l-4 border-l-destructive">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Failed</p>
          <p className="text-2xl font-black text-destructive">{failedCount}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Declined/Cancelled</p>
        </Card>
      </div>

      {/* 2. CONTROLS AND TABS */}
      <Tabs value={subTab} onValueChange={v => setSubTab(v as any)} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <TabsList className="bg-muted/50 p-1 border h-11">
            <TabsTrigger value="mine" className="px-6 text-xs font-bold">
              My History <span className="ml-2 opacity-50">({myTxnsCount})</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="px-6 text-xs font-bold">
              Group Ledger <span className="ml-2 opacity-50">({transactions.length})</span>
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search Receipt / Phone..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
                className="pl-10 h-11 text-sm bg-card shadow-sm"
              />
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon" 
                    className="h-11 w-11 shrink-0" 
                    onClick={() => fetchData()}
                    disabled={refreshing}
                  >
                    <RefreshCw size={18} className={cn(refreshing && "animate-spin")} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Sync Data</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        {/* 3. TRANSACTION LIST */}
        <div className="space-y-3 min-h-[400px]">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-20 w-full bg-muted/40 animate-pulse rounded-2xl border" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-muted/10 rounded-3xl border-2 border-dashed">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Receipt size={32} className="text-muted-foreground" />
              </div>
              <p className="font-bold text-muted-foreground">No transaction records found</p>
              <p className="text-xs text-muted-foreground mt-1 text-center max-w-[200px]">
                We couldn't find any payments matching your current filters.
              </p>
            </div>
          ) : (
            filtered.map((tx, i) => {
              const config = statusConfig[tx.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              
              return (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedTx(tx)}
                  className={cn(
                    "group relative flex items-center justify-between p-4 rounded-2xl border bg-card cursor-pointer transition-all hover:shadow-md",
                    "hover:border-primary/30",
                    tx.status === 'pending' && "border-amber-200/50 bg-amber-50/5"
                  )}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={cn(
                      "h-12 w-12 rounded-xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105",
                      config.bg, config.border
                    )}>
                      <StatusIcon className={config.color} size={20} />
                    </div>
                    
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-black text-sm tracking-tight">
                          {formatCurrency(tx.amount)}
                        </p>
                        {subTab === 'all' && (
                          <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-md uppercase">
                            {getMemberName(tx.user_id)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <span className="text-[11px] font-medium flex items-center gap-1">
                          <Phone size={10} /> {tx.phone}
                        </span>
                        <span className="hidden sm:block text-[11px]">•</span>
                        <span className="text-[11px] font-medium flex items-center gap-1">
                          <Calendar size={10} /> {formatDate(tx.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className={cn(
                      "hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-tighter",
                      config.bg, config.color, config.border
                    )}>
                      {config.label}
                    </div>
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Eye size={16} />
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </Tabs>

      {/* 4. TRANSACTION DETAIL DIALOG */}
      <Dialog open={!!selectedTx} onOpenChange={open => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
          {selectedTx && (() => {
            const config = statusConfig[selectedTx.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <div className="flex flex-col">
                {/* Header Section */}
                <div className={cn("p-10 text-center relative", config.bg)}>
                  <div className="absolute top-4 right-4 text-[10px] font-black opacity-20 uppercase tracking-[0.2em]">
                    Internal Receipt
                  </div>
                  <div className={cn(
                    "w-20 h-20 rounded-[2rem] mx-auto mb-6 flex items-center justify-center bg-background shadow-xl border-4",
                    config.border
                  )}>
                    <StatusIcon className={config.color} size={36} />
                  </div>
                  <h3 className="text-4xl font-black tracking-tighter mb-1">
                    {formatCurrency(selectedTx.amount)}
                  </h3>
                  <div className={cn(
                    "inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest",
                    config.bg, config.color, "border bg-background/50"
                  )}>
                    {config.label}
                  </div>
                </div>

                {/* Body Details */}
                <div className="p-8 space-y-5 bg-card">
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { 
                        icon: Hash, 
                        label: 'Network Receipt', 
                        value: selectedTx.mpesa_receipt || 'STK_PENDING_CALLBACK',
                        copyable: true 
                      },
                      { 
                        icon: Phone, 
                        label: 'Funding Source', 
                        value: selectedTx.phone 
                      },
                      { 
                        icon: ArrowDownRight, 
                        label: 'External Ref', 
                        value: selectedTx.reference 
                      },
                      { 
                        icon: Calendar, 
                        label: 'Execution Time', 
                        value: formatDate(selectedTx.created_at) 
                      },
                      { 
                        icon: Info, 
                        label: 'Status Message', 
                        value: selectedTx.result_desc || 'Waiting for M-Pesa network verification...' 
                      }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-4 group/item">
                        <div className="h-10 w-10 rounded-xl bg-muted/50 border flex items-center justify-center shrink-0">
                          <item.icon size={18} className="text-primary" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.1em] mb-1">
                            {item.label}
                          </p>
                          <p className="text-sm font-black text-foreground break-all leading-tight">
                            {item.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 flex gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1 h-12 rounded-2xl font-bold" 
                      onClick={() => setSelectedTx(null)}
                    >
                      Close
                    </Button>
                    <Button 
                      className="flex-1 h-12 rounded-2xl font-bold gap-2"
                      onClick={() => window.print()}
                    >
                      <Download size={16} /> Receipt
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
 
