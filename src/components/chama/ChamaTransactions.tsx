import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Search, CheckCircle2, XCircle, Clock, Phone, Hash, Calendar, Info, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Props {
  groupId: string;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string; phone: string } }>;
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
}

const statusConfig = {
  success: { label: 'Successful', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  failed: { label: 'Failed', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' },
  pending: { label: 'Pending', icon: Clock, color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20' },
};

export function ChamaTransactions({ groupId, members }: Props) {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [subTab, setSubTab] = useState<'mine' | 'all'>('mine');

  const getMemberName = (userId: string) => members.find(m => m.user_id === userId)?.profile?.full_name || 'Unknown';

  useEffect(() => {
    fetchTransactions();
  }, [groupId]);

  const fetchTransactions = async () => {
    // Query by group_id column instead of reference pattern
    const { data } = await supabase
      .from('stk_transactions')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (data) setTransactions(data as Transaction[]);
    setLoading(false);
  };

  const formatCurrency = (amount: number) => `KES ${amount.toLocaleString()}`;
  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const filtered = transactions.filter(t => {
    const matchesTab = subTab === 'mine' ? t.user_id === user?.id : true;
    const matchesSearch = !search || t.reference.toLowerCase().includes(search.toLowerCase()) || t.phone.includes(search) || (t.mpesa_receipt && t.mpesa_receipt.toLowerCase().includes(search.toLowerCase()));
    return matchesTab && matchesSearch;
  });

  const myTxns = transactions.filter(t => t.user_id === user?.id);
  const successfulTotal = filtered.filter(t => t.status === 'success').reduce((s, t) => s + t.amount, 0);
  const successCount = filtered.filter(t => t.status === 'success').length;
  const failedCount = filtered.filter(t => t.status === 'failed').length;
  const pendingCount = filtered.filter(t => t.status === 'pending').length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Total Confirmed</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(successfulTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Successful</p>
          <p className="text-xl font-bold text-emerald-500">{successCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Failed</p>
          <p className="text-xl font-bold text-destructive">{failedCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-xl font-bold text-accent">{pendingCount}</p>
        </Card>
      </div>

      {/* Sub-tabs */}
      <Tabs value={subTab} onValueChange={v => setSubTab(v as any)}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList className="h-auto p-1">
            <TabsTrigger value="mine" className="text-xs py-1.5 px-3">My Transactions ({myTxns.length})</TabsTrigger>
            <TabsTrigger value="all" className="text-xs py-1.5 px-3">All Group Transactions ({transactions.length})</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
        </div>

        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center">
              <Receipt size={24} className="mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">No transactions found</p>
              <p className="text-xs text-muted-foreground mt-1">{subTab === 'mine' ? 'Your chama payment history will appear here' : 'No group transactions yet'}</p>
            </Card>
          ) : (
            filtered.map((tx, i) => {
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
                    'flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-colors',
                    'bg-muted/30 hover:bg-muted/50',
                    config.border
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', config.bg)}>
                      <StatusIcon className={config.color} size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {subTab === 'all' && <span className="text-muted-foreground">{getMemberName(tx.user_id)} · </span>}
                        {formatCurrency(tx.amount)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{tx.phone}</span>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn('text-[11px] font-medium px-2 py-1 rounded-full', config.bg, config.color)}>{config.label}</span>
                    <Eye size={14} className="text-muted-foreground" />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </Tabs>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!selectedTx} onOpenChange={o => { if (!o) setSelectedTx(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Transaction Details</DialogTitle></DialogHeader>
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
                    { icon: Phone, label: 'Phone', value: selectedTx.phone },
                    { icon: Calendar, label: 'Date', value: formatDate(selectedTx.created_at) },
                    { icon: Receipt, label: 'M-Pesa Receipt', value: selectedTx.mpesa_receipt || '—' },
                    { icon: Info, label: 'Description', value: selectedTx.result_desc || '—' },
                    ...(selectedTx.user_id !== user?.id ? [{ icon: Hash, label: 'Member', value: getMemberName(selectedTx.user_id) }] : []),
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
                <Button variant="outline" className="w-full" onClick={() => setSelectedTx(null)}>Close</Button>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
