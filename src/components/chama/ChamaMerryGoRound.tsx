import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Plus, CheckCircle2, Clock, AlertTriangle, Wallet, Phone, Calendar, User as UserIcon, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PaybillBox } from '@/components/PaybillBox';

interface Props {
  groupId: string;
  group: any;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string; phone: string; avatar_url?: string } }>;
  myRole: string;
}

const fmt = (n: number) => `KES ${Math.round(Number(n || 0)).toLocaleString()}`;

export function ChamaMerryGoRound({ groupId, group, members, myRole }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const isChair = myRole === 'chairperson';

  const [cycles, setCycles] = useState<any[]>([]);
  const [contribs, setContribs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<{ cycle: any } | null>(null);
  const [payMethod, setPayMethod] = useState<'wallet' | 'paybill' | 'stk'>('wallet');
  const [stkPhone, setStkPhone] = useState(profile?.phone || '');
  const [paying, setPaying] = useState(false);

  // Create form
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [penalty, setPenalty] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [payoutDate, setPayoutDate] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [c1, c2] = await Promise.all([
      supabase.from('chama_mgr_cycles' as any).select('*').eq('group_id', groupId).order('cycle_number', { ascending: false }),
      supabase.from('chama_mgr_contributions' as any).select('*').eq('group_id', groupId),
    ]);
    setCycles((c1.data as any[]) || []);
    setContribs((c2.data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [groupId]);

  const handleCreate = async () => {
    if (!recipient || !amount || !deadline || !payoutDate || !user) {
      toast({ title: 'All fields required', variant: 'destructive' }); return;
    }
    setCreating(true);
    try {
      const nextNum = cycles.length > 0 ? Math.max(...cycles.map(c => c.cycle_number)) + 1 : 1;
      const recipMember = members.find(m => m.user_id === recipient);
      const { error } = await supabase.from('chama_mgr_cycles' as any).insert({
        group_id: groupId, cycle_number: nextNum, recipient_id: recipient,
        recipient_name: recipMember?.profile?.full_name || 'Unknown',
        contribution_amount: parseFloat(amount), penalty_amount: parseFloat(penalty || '0'),
        deadline: new Date(deadline).toISOString(), payout_date: new Date(payoutDate).toISOString(),
        created_by: user.id,
      });
      if (error) throw error;
      toast({ title: `Cycle #${nextNum} created` });
      setCreateOpen(false);
      setRecipient(''); setAmount(''); setPenalty('0'); setDeadline(''); setPayoutDate('');
      fetchData();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setCreating(false); }
  };

  const handlePay = async () => {
    if (!payOpen || !user) return;
    const { cycle } = payOpen;
    setPaying(true);
    try {
      if (payMethod === 'wallet') {
        // Atomic wallet debit + record contribution via RPC pattern (use direct ops)
        const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle();
        const bal = Number(w?.balance) || 0;
        if (bal < cycle.contribution_amount) {
          throw new Error(`Insufficient wallet balance. You have ${fmt(bal)}.`);
        }
        const newBal = bal - cycle.contribution_amount;
        const { error: wErr } = await supabase.from('wallets').update({ balance: newBal }).eq('user_id', user.id);
        if (wErr) throw wErr;
        await supabase.from('wallet_transactions').insert({
          user_id: user.id, type: 'debit', amount: cycle.contribution_amount,
          description: `Merry-go-round contribution · cycle #${cycle.cycle_number}`,
        });
        const { error: cErr } = await supabase.from('chama_mgr_contributions' as any).insert({
          cycle_id: cycle.id, group_id: groupId, user_id: user.id,
          amount: cycle.contribution_amount, payment_method: 'wallet',
        });
        if (cErr) throw cErr;
        // Send SMS via edge function
        await supabase.functions.invoke('send-sms', {
          body: {
            phone: profile?.phone,
            message: `Dear ${profile?.full_name?.split(' ')[0] || 'Member'}, you have contributed ${fmt(cycle.contribution_amount)} from your wallet to merry-go-round cycle #${cycle.cycle_number} in ${group?.name}. New wallet balance: ${fmt(newBal)}. Thank you for banking with Dasnet.`,
          },
        });
        toast({ title: 'Payment successful', description: `${fmt(cycle.contribution_amount)} debited from wallet.` });
        setPayOpen(null); fetchData();
      } else if (payMethod === 'stk') {
        const { error } = await supabase.functions.invoke('initiate-stk-push', {
          body: {
            phone: stkPhone, amount: cycle.contribution_amount,
            purpose: 'merry_go_round', userId: user.id, groupId,
            cycle_number: cycle.cycle_number,
            metadata: { type: 'merry_go_round', cycle_id: cycle.id, cycle_number: cycle.cycle_number },
          },
        });
        if (error) throw error;
        toast({ title: 'STK Push sent', description: 'Check your phone to complete.' });
        setPayOpen(null);
      }
      // paybill = manual; no action here
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setPaying(false); }
  };

  const cycleStats = (cycle: any) => {
    const cyContribs = contribs.filter(c => c.cycle_id === cycle.id);
    const paid = new Set(cyContribs.map(c => c.user_id));
    const total = cyContribs.reduce((s, c) => s + Number(c.amount), 0);
    const haveIPaid = !!user && paid.has(user.id);
    // Everyone (including recipient) must pay
    const unpaid = members.filter(m => !paid.has(m.user_id));
    return { paid, total, haveIPaid, unpaid, count: cyContribs.length };
  };

  const userCode = (profile as any)?.mpesa_account_code;

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-primary/5 via-accent/5 to-transparent border-accent/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center">
              <RefreshCw size={20} className="text-accent" />
            </div>
            <div>
              <h3 className="font-bold">Merry-Go-Round</h3>
              <p className="text-xs text-muted-foreground">Rotating savings — each member receives a payout</p>
            </div>
          </div>
          {isChair && (
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus size={14} /> New Cycle
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : cycles.length === 0 ? (
        <Card className="p-8 text-center">
          <RefreshCw size={32} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">No cycles yet</p>
          <p className="text-xs text-muted-foreground mt-1">{isChair ? 'Create the first merry-go-round cycle to begin.' : 'The chairperson will start the first cycle.'}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle) => {
            const { paid, total, haveIPaid, unpaid, count } = cycleStats(cycle);
            const isOverdue = new Date(cycle.deadline) < new Date() && cycle.status === 'open';
            const expectedTotal = cycle.contribution_amount * (members.length - 1);
            const recipMember = members.find(m => m.user_id === cycle.recipient_id);
            return (
              <motion.div key={cycle.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                        #{cycle.cycle_number}
                      </div>
                      <div>
                        <p className="font-bold text-sm">Recipient: {recipMember?.profile?.full_name || cycle.recipient_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Contribution: <span className="font-semibold text-foreground">{fmt(cycle.contribution_amount)}</span> · Penalty: {fmt(cycle.penalty_amount)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={cycle.status === 'paid_out' ? 'default' : isOverdue ? 'destructive' : 'secondary'} className="text-[10px]">
                      {cycle.status === 'paid_out' ? 'Paid Out' : isOverdue ? 'Overdue' : 'Open'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground mb-3">
                    <div className="flex items-center gap-1"><Calendar size={11} /> Deadline: {new Date(cycle.deadline).toLocaleDateString()}</div>
                    <div className="flex items-center gap-1"><Clock size={11} /> Payout: {new Date(cycle.payout_date).toLocaleDateString()}</div>
                  </div>

                  <div className="bg-muted/30 rounded-lg p-2.5 mb-3">
                    <div className="flex justify-between text-[11px] mb-1">
                      <span>Collected: <strong className="text-emerald-500">{fmt(total)}</strong></span>
                      <span>Target: {fmt(expectedTotal)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (total / expectedTotal) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{count}/{members.length - 1} members paid</p>
                  </div>

                  {/* Member status */}
                  <div className="space-y-1 mb-3 max-h-40 overflow-y-auto">
                    {members.filter(m => m.user_id !== cycle.recipient_id).map(m => {
                      const hasPaid = paid.has(m.user_id);
                      return (
                        <div key={m.user_id} className="flex items-center justify-between text-[11px] py-1 border-b border-border/30 last:border-0">
                          <span className="flex items-center gap-1.5">
                            <UserIcon size={10} className="text-muted-foreground" />
                            {m.profile?.full_name || 'Unknown'}
                          </span>
                          {hasPaid ? (
                            <span className="text-emerald-500 flex items-center gap-1"><CheckCircle2 size={11} /> Paid</span>
                          ) : (
                            <span className="text-destructive/80 flex items-center gap-1"><AlertTriangle size={11} /> Pending</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {!haveIPaid && cycle.status === 'open' && user?.id !== cycle.recipient_id && (
                    <Button onClick={() => { setPayOpen({ cycle }); setPayMethod('wallet'); }} className="w-full gap-1.5" size="sm">
                      <Wallet size={14} /> Pay {fmt(cycle.contribution_amount)}
                    </Button>
                  )}
                  {haveIPaid && (
                    <p className="text-center text-[11px] text-emerald-500 flex items-center justify-center gap-1">
                      <CheckCircle2 size={11} /> You have paid this cycle
                    </p>
                  )}
                  {user?.id === cycle.recipient_id && (
                    <p className="text-center text-[11px] text-accent">🎉 You are this cycle's recipient — payout scheduled for {new Date(cycle.payout_date).toLocaleDateString()}</p>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create cycle dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Merry-Go-Round Cycle</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Recipient</Label>
              <Select value={recipient} onValueChange={setRecipient}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select member" /></SelectTrigger>
                <SelectContent>
                  {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.profile?.full_name || 'Unknown'}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Amount per member (KES)</Label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500" className="mt-1" />
              </div>
              <div>
                <Label>Late penalty (KES)</Label>
                <Input type="number" value={penalty} onChange={e => setPenalty(e.target.value)} placeholder="50" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Contribution deadline</Label>
              <Input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Payout date</Label>
              <Input type="datetime-local" value={payoutDate} onChange={e => setPayoutDate(e.target.value)} className="mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>{creating ? 'Creating…' : 'Create Cycle'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pay Cycle #{payOpen?.cycle.cycle_number}</DialogTitle></DialogHeader>
          {payOpen && (
            <div className="space-y-3">
              <p className="text-sm">
                Amount: <strong>{fmt(payOpen.cycle.contribution_amount)}</strong>
              </p>
              <Tabs value={payMethod} onValueChange={(v) => setPayMethod(v as any)}>
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="wallet"><Wallet size={12} className="mr-1" /> Wallet</TabsTrigger>
                  <TabsTrigger value="stk"><Phone size={12} className="mr-1" /> STK</TabsTrigger>
                  <TabsTrigger value="paybill">Paybill</TabsTrigger>
                </TabsList>
                <TabsContent value="wallet" className="pt-3">
                  <p className="text-xs text-muted-foreground">Pay instantly from your wallet. The amount will be debited and recorded.</p>
                </TabsContent>
                <TabsContent value="stk" className="pt-3 space-y-2">
                  <Label>Phone</Label>
                  <Input value={stkPhone} onChange={e => setStkPhone(e.target.value)} placeholder="0712345678" />
                </TabsContent>
                <TabsContent value="paybill" className="pt-3">
                  <PaybillBox
                    accountRef={userCode ? `${userCode}M${payOpen.cycle.cycle_number}` : '—'}
                    helperText={`Pay ${fmt(payOpen.cycle.contribution_amount)} for cycle #${payOpen.cycle.cycle_number}`}
                    compact
                  />
                  <p className="text-[11px] text-muted-foreground mt-2">
                    After paying, contribution will be auto-recorded from M-Pesa callback.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(null)}>Close</Button>
            {payMethod !== 'paybill' && (
              <Button onClick={handlePay} disabled={paying}>
                {paying ? 'Processing…' : payMethod === 'wallet' ? 'Pay Now' : 'Send STK Push'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
