import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Plus, CheckCircle2, Clock, AlertTriangle, Wallet, Phone, Calendar, User as UserIcon, Loader2, Eye, TrendingDown, TrendingUp, Send, Megaphone } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PaybillBox } from '@/components/PaybillBox';

const initials = (name?: string) => (name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?';

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
  const [detailCycle, setDetailCycle] = useState<any | null>(null);
  const [payoutTriggering, setPayoutTriggering] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const triggerB2CPayout = async (cycle: any) => {
    if (!confirm(`Send M-Pesa payout to ${cycle.recipient_name} now?`)) return;
    setPayoutTriggering(cycle.id);
    try {
      const { data, error } = await supabase.functions.invoke('mgr-payout-cron', {
        body: { cycle_id: cycle.id },
      });
      if (error) throw error;
      const r = (data as any)?.results?.[0];
      if (r && r.ok === false) throw new Error(r.reason || r.error || 'Payout failed');
      toast({ title: 'Payout sent', description: `${fmt(r?.payout || 0)} dispatched to recipient.` });
      setDetailCycle(null);
      fetchData();
    } catch (e: any) {
      toast({ title: 'Payout failed', description: e.message, variant: 'destructive' });
    } finally { setPayoutTriggering(null); }
  };

  const sendBroadcast = async () => {
    if (broadcastMsg.trim().length < 2) {
      toast({ title: 'Type a message first', variant: 'destructive' }); return;
    }
    setBroadcasting(true);
    try {
      const { data, error } = await supabase.functions.invoke('chama-broadcast', {
        body: { group_id: groupId, message: broadcastMsg.trim() },
      });
      if (error) throw error;
      const sent = (data as any)?.sent || 0;
      const failed = (data as any)?.failed || 0;
      toast({ title: 'Broadcast sent', description: `${sent} delivered${failed ? `, ${failed} failed` : ''}.` });
      setBroadcastOpen(false); setBroadcastMsg('');
    } catch (e: any) {
      toast({ title: 'Broadcast failed', description: e.message, variant: 'destructive' });
    } finally { setBroadcasting(false); }
  };

  // Create form
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [penalty, setPenalty] = useState('0');
  const [deadline, setDeadline] = useState('');
  const [payoutDate, setPayoutDate] = useState('');
  const [creating, setCreating] = useState(false);

  const [chamaLetter, setChamaLetter] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    const [c1, c2] = await Promise.all([
      supabase.from('chama_mgr_cycles' as any).select('*').eq('group_id', groupId).order('cycle_number', { ascending: false }),
      supabase.from('chama_mgr_contributions' as any).select('*').eq('group_id', groupId),
    ]);
    setCycles((c1.data as any[]) || []);
    setContribs((c2.data as any[]) || []);
    // Compute this user's letter for THIS chama (A=1st chama joined, B=2nd, ...)
    if (user) {
      const { data: mine } = await supabase
        .from('chama_members').select('group_id, created_at')
        .eq('user_id', user.id).eq('is_active', true)
        .order('created_at', { ascending: true });
      const idx = (mine || []).findIndex((m: any) => m.group_id === groupId);
      if (idx >= 0 && idx < 26) setChamaLetter(String.fromCharCode(65 + idx));
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [groupId, user?.id]);

  const handleCreate = async () => {
    if (!recipient || !amount || !deadline || !payoutDate || !user) {
      toast({ title: 'All fields required', variant: 'destructive' }); return;
    }
    setCreating(true);
    try {
      const nextNum = cycles.length > 0 ? Math.max(...cycles.map(c => c.cycle_number)) + 1 : 1;
      const recipMember = members.find(m => m.user_id === recipient);
      const { data: inserted, error } = await supabase.from('chama_mgr_cycles' as any).insert({
        group_id: groupId, cycle_number: nextNum, recipient_id: recipient,
        recipient_name: recipMember?.profile?.full_name || 'Unknown',
        contribution_amount: parseFloat(amount), penalty_amount: parseFloat(penalty || '0'),
        deadline: new Date(deadline).toISOString(), payout_date: new Date(payoutDate).toISOString(),
        created_by: user.id,
      }).select('id').single();
      if (error) throw error;
      const newId = (inserted as any)?.id;
      // Notify all members by SMS (Paybill + their unique account no.) — fire-and-forget
      if (newId) {
        supabase.functions.invoke('notify-mgr-cycle', { body: { cycle_id: newId } }).catch(() => {});
      }
      toast({ title: `Cycle #${nextNum} created`, description: 'Members are being notified by SMS.' });
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
      const isLate = new Date() > new Date(cycle.deadline);
      const penalty = isLate ? Number(cycle.penalty_amount || 0) : 0;
      const totalDue = Number(cycle.contribution_amount) + penalty;

      if (payMethod === 'wallet') {
        // Atomic wallet debit + contribution via security-definer RPC
        const { data, error: rpcErr } = await supabase.rpc('pay_mgr_from_wallet' as any, {
          _user_id: user.id,
          _cycle_id: cycle.id,
        });
        if (rpcErr) throw rpcErr;
        const result: any = data || {};
        // SMS confirmation (fire-and-forget)
        supabase.functions.invoke('send-sms', {
          body: {
            phone: profile?.phone,
            message: `Dear ${profile?.full_name?.split(' ')[0] || 'Member'}, you contributed ${fmt(result.amount_charged || totalDue)} from wallet to merry-go-round cycle #${cycle.cycle_number}${result.late ? ` (incl. ${fmt(result.penalty)} late penalty)` : ''}. Balance: ${fmt(result.new_balance || 0)}. Thank you for using Dasnet.`,
          },
        }).catch(() => {});
        toast({
          title: 'Payment successful',
          description: result.late
            ? `${fmt(result.amount_charged)} charged (incl. ${fmt(result.penalty)} late penalty).`
            : `${fmt(result.amount_charged)} debited from wallet.`,
        });
        setPayOpen(null); fetchData();
      } else if (payMethod === 'stk') {
        const { error } = await supabase.functions.invoke('initiate-stk-push', {
          body: {
            phone: stkPhone, amount: totalDue,
            purpose: 'merry_go_round', userId: user.id, groupId,
            cycle_number: cycle.cycle_number,
            metadata: { type: 'merry_go_round', cycle_id: cycle.id, cycle_number: cycle.cycle_number, penalty },
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

  // Aggregate stats for hero
  const activeCycle = cycles.find(c => c.status === 'open');
  const paidOutCount = cycles.filter(c => c.status === 'paid_out').length;
  const totalDisbursed = cycles
    .filter(c => c.status === 'paid_out')
    .reduce((s, c) => s + Number(c.payout_amount || 0), 0);
  const myTurnCycle = cycles.find(c => c.recipient_id === user?.id && c.status === 'open');

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-primary/10 via-accent/5 to-transparent">
        <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '14px 14px' }} />
        <div className="relative p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-accent/15 ring-1 ring-accent/30 flex items-center justify-center shrink-0">
                <RefreshCw size={20} className="text-accent" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-[15px] leading-tight truncate">Merry-Go-Round</h3>
                <p className="text-[11px] text-muted-foreground leading-snug">Rotating savings · automatic M-Pesa payout on schedule</p>
              </div>
            </div>
            {isChair && (
              <div className="flex flex-col gap-1.5 shrink-0">
                <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 h-9 shadow-sm">
                  <Plus size={14} /> New Cycle
                </Button>
                <Button size="sm" variant="outline" onClick={() => setBroadcastOpen(true)} className="gap-1.5 h-9">
                  <Megaphone size={14} /> Broadcast
                </Button>
              </div>
            )}
          </div>

          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-lg bg-card/70 backdrop-blur-sm border border-border/60 p-2.5">
              <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium">Active</p>
              <p className="text-sm font-bold mt-0.5">{activeCycle ? `#${activeCycle.cycle_number}` : '—'}</p>
            </div>
            <div className="rounded-lg bg-card/70 backdrop-blur-sm border border-border/60 p-2.5">
              <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium">Completed</p>
              <p className="text-sm font-bold mt-0.5">{paidOutCount}</p>
            </div>
            <div className="rounded-lg bg-card/70 backdrop-blur-sm border border-border/60 p-2.5">
              <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium">Disbursed</p>
              <p className="text-sm font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{fmt(totalDisbursed)}</p>
            </div>
          </div>

          {myTurnCycle && (
            <div className="mt-3 rounded-lg bg-accent/10 border border-accent/30 px-3 py-2 flex items-center gap-2">
              <span className="text-base leading-none">🎉</span>
              <p className="text-[11.5px]">
                <span className="font-semibold text-accent">It's your turn</span>
                <span className="text-muted-foreground"> · cycle #{myTurnCycle.cycle_number} payout on {new Date(myTurnCycle.payout_date).toLocaleDateString()}</span>
              </p>
            </div>
          )}
        </div>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : cycles.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <div className="w-14 h-14 rounded-2xl bg-muted/50 mx-auto mb-3 flex items-center justify-center">
            <RefreshCw size={26} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold">No cycles yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">{isChair ? 'Create the first merry-go-round cycle to start rotating payouts to members.' : 'The chairperson will start the first cycle.'}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {cycles.map((cycle) => {
            const { paid, total, haveIPaid, count } = cycleStats(cycle);
            const isOverdue = new Date(cycle.deadline) < new Date() && cycle.status === 'open';
            const expectedTotal = cycle.contribution_amount * members.length;
            const recipMember = members.find(m => m.user_id === cycle.recipient_id);
            const isRecipient = user?.id === cycle.recipient_id;
            const progress = Math.min(100, expectedTotal > 0 ? (total / expectedTotal) * 100 : 0);
            const statusCfg = cycle.status === 'paid_out'
              ? { label: 'Paid Out', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' }
              : cycle.status === 'payout_pending'
              ? { label: 'Payout Pending', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30' }
              : cycle.status === 'closed_no_funds'
              ? { label: 'Closed', cls: 'bg-muted text-muted-foreground border-border' }
              : cycle.status === 'payout_failed'
              ? { label: 'Payout Failed', cls: 'bg-destructive/15 text-destructive border-destructive/30' }
              : isOverdue
              ? { label: 'Overdue', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30' }
              : { label: 'Open', cls: 'bg-primary/10 text-primary border-primary/30' };

            return (
              <motion.div key={cycle.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-4 bg-gradient-to-br from-card to-muted/20 border-border/60 hover:border-accent/40 transition-colors">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <Avatar className="w-12 h-12 ring-2 ring-primary/20">
                          <AvatarImage src={recipMember?.profile?.avatar_url || undefined} alt={recipMember?.profile?.full_name || cycle.recipient_name} />
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/15 text-primary font-bold text-sm"><UserIcon className="w-1/2 h-1/2 opacity-70" /></AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground border border-card shadow-sm">
                          #{cycle.cycle_number}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Recipient</p>
                        <p className="font-semibold text-sm truncate leading-tight">{recipMember?.profile?.full_name || cycle.recipient_name}</p>
                        <p className="text-[10.5px] text-muted-foreground mt-0.5">
                          {fmt(cycle.contribution_amount)}/member · penalty {fmt(cycle.penalty_amount)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${statusCfg.cls}`}>
                      {statusCfg.label}
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-md bg-muted/30 px-2.5 py-1.5">
                      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><Calendar size={9} /> Deadline</p>
                      <p className="text-[11.5px] font-medium mt-0.5">{new Date(cycle.deadline).toLocaleDateString()}</p>
                    </div>
                    <div className="rounded-md bg-muted/30 px-2.5 py-1.5">
                      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><Clock size={9} /> Payout</p>
                      <p className="text-[11.5px] font-medium mt-0.5">{new Date(cycle.payout_date).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-2.5 mb-3">
                    <div className="flex justify-between items-baseline text-[11px] mb-1.5">
                      <span className="text-muted-foreground">Collected</span>
                      <span><strong className="text-emerald-600 dark:text-emerald-400">{fmt(total)}</strong> <span className="text-muted-foreground">/ {fmt(expectedTotal)}</span></span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5">{count}/{members.length} members paid · {Math.round(progress)}%</p>
                  </div>

                  {/* Recipient banner */}
                  {isRecipient && (
                    <div className="bg-accent/10 border border-accent/30 rounded-lg p-2.5 mb-3">
                      <p className="text-[11px] font-semibold text-accent mb-1">🎉 You receive this cycle</p>
                      {isOverdue && total < expectedTotal ? (
                        <>
                          <p className="text-[11px]">Received so far: <strong className="text-emerald-600 dark:text-emerald-400">{fmt(total)}</strong> · outstanding <strong className="text-destructive">{fmt(expectedTotal - total)}</strong></p>
                          <p className="text-[10px] text-muted-foreground mt-1">Late payments + penalties will be sent to your M-Pesa as they arrive.</p>
                        </>
                      ) : cycle.status === 'paid_out' ? (
                        <p className="text-[11px]">Paid out: <strong>{fmt(cycle.payout_amount || total)}</strong> on {new Date(cycle.payout_processed_at || cycle.payout_date).toLocaleDateString()}</p>
                      ) : (
                        <>
                          <p className="text-[11px]">Expected payout: <strong>{fmt(expectedTotal)}</strong> on {new Date(cycle.payout_date).toLocaleDateString()}</p>
                          <p className="text-[10px] text-muted-foreground">Sent automatically to your registered M-Pesa.</p>
                        </>
                      )}
                    </div>
                  )}

                  {/* Members preview (first 5) */}
                  <div className="rounded-lg border border-border/40 divide-y divide-border/30 mb-3 overflow-hidden">
                    {members.slice(0, 5).map(m => {
                      const hasPaid = paid.has(m.user_id);
                      const isThisRecipient = m.user_id === cycle.recipient_id;
                      return (
                        <div key={m.user_id} className="flex items-center justify-between text-[11.5px] px-2.5 py-1.5">
                          <span className="flex items-center gap-2 min-w-0">
                            <Avatar className="w-6 h-6 shrink-0">
                              <AvatarImage src={m.profile?.avatar_url || undefined} alt={m.profile?.full_name} />
                              <AvatarFallback className="text-[9px] bg-muted"><UserIcon className="w-1/2 h-1/2 opacity-70" /></AvatarFallback>
                            </Avatar>
                            <span className="truncate">{m.profile?.full_name || 'Unknown'}</span>
                            {isThisRecipient && <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">Recipient</Badge>}
                          </span>
                          {hasPaid ? (
                            <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 shrink-0 font-medium"><CheckCircle2 size={11} /> Paid</span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 shrink-0 font-medium"><AlertTriangle size={11} /> Pending</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDetailCycle(cycle)}
                      className="flex-1 gap-1.5 h-10"
                    >
                      <Eye size={14} /> View Details
                    </Button>
                    {!haveIPaid && cycle.status === 'open' && (
                      <Button onClick={() => { setPayOpen({ cycle }); setPayMethod('wallet'); }} className="flex-1 gap-1.5 h-10 shadow-sm" size="sm">
                        <Wallet size={14} /> Pay {fmt(cycle.contribution_amount)}
                      </Button>
                    )}
                  </div>
                  {haveIPaid && cycle.status === 'open' && (
                    <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 py-2 text-center mt-2">
                      <p className="text-[11.5px] text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1 font-medium">
                        <CheckCircle2 size={12} /> You have paid this cycle
                      </p>
                    </div>
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
          {payOpen && (() => {
            const isLate = new Date() > new Date(payOpen.cycle.deadline);
            const pen = isLate ? Number(payOpen.cycle.penalty_amount || 0) : 0;
            const total = Number(payOpen.cycle.contribution_amount) + pen;
            return (
            <div className="space-y-3">
              <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Contribution</span><strong>{fmt(payOpen.cycle.contribution_amount)}</strong></div>
                {isLate && pen > 0 && (
                  <div className="flex justify-between text-destructive"><span>Late penalty</span><strong>+ {fmt(pen)}</strong></div>
                )}
                <div className="flex justify-between border-t pt-1 mt-1"><span className="font-semibold">Total to pay</span><strong className="text-primary">{fmt(total)}</strong></div>
                {isLate && (
                  <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                    <AlertTriangle size={11} /> Payment is past the deadline — late penalty applies.
                  </p>
                )}
              </div>
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
                    accountRef={userCode && chamaLetter ? `${userCode}${chamaLetter}${payOpen.cycle.cycle_number}` : '—'}
                    helperText={`Pay ${fmt(payOpen.cycle.contribution_amount)} for cycle #${payOpen.cycle.cycle_number}`}
                    compact
                  />
                  <p className="text-[11px] text-muted-foreground mt-2">
                    After paying, contribution will be auto-recorded from M-Pesa callback.
                  </p>
                </TabsContent>
              </Tabs>
            </div>
            );
          })()}
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

      {/* Details dialog */}
      <Dialog open={!!detailCycle} onOpenChange={(o) => !o && setDetailCycle(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          {detailCycle && (() => {
            const cy = detailCycle;
            const cyContribs = contribs.filter(c => c.cycle_id === cy.id);
            const paidMap = new Map<string, { amount: number; paid_at: string; method: string }>();
            cyContribs.forEach(c => {
              const prev = paidMap.get(c.user_id);
              paidMap.set(c.user_id, {
                amount: (prev?.amount || 0) + Number(c.amount || 0),
                paid_at: c.paid_at,
                method: c.payment_method,
              });
            });
            const total = cyContribs.reduce((s, c) => s + Number(c.amount || 0), 0);
            const expectedTotal = Number(cy.contribution_amount) * members.length;
            const arrears = Math.max(0, expectedTotal - total);
            const paidMembers = members.filter(m => paidMap.has(m.user_id));
            const unpaidMembers = members.filter(m => !paidMap.has(m.user_id));
            const recipMember = members.find(m => m.user_id === cy.recipient_id);
            const isLate = new Date() > new Date(cy.deadline);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">#{cy.cycle_number}</span>
                    <span className="text-base">Cycle Details</span>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                  {/* Recipient */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-br from-accent/10 to-transparent border border-accent/20">
                    <Avatar className="w-12 h-12 ring-2 ring-accent/30">
                      <AvatarImage src={recipMember?.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-accent/15 text-accent font-bold"><UserIcon className="w-1/2 h-1/2 opacity-70" /></AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Recipient</p>
                      <p className="font-semibold text-sm truncate">{recipMember?.profile?.full_name || cy.recipient_name}</p>
                      {recipMember?.profile?.phone && <p className="text-[11px] text-muted-foreground truncate">{recipMember.profile.phone}</p>}
                    </div>
                  </div>

                  {/* KPIs */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border/60 p-2.5 bg-card">
                      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><TrendingUp size={9} /> Collected</p>
                      <p className="text-sm font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">{fmt(total)}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2.5 bg-card">
                      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium">Target</p>
                      <p className="text-sm font-bold mt-0.5">{fmt(expectedTotal)}</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-2.5 bg-card">
                      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1"><TrendingDown size={9} /> Arrears</p>
                      <p className={`text-sm font-bold mt-0.5 ${arrears > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>{fmt(arrears)}</p>
                    </div>
                  </div>

                  {/* Schedule */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
                      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium">Deadline</p>
                      <p className="font-medium mt-0.5">{new Date(cy.deadline).toLocaleString()}</p>
                    </div>
                    <div className="rounded-md bg-muted/40 px-2.5 py-1.5">
                      <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-medium">Payout</p>
                      <p className="font-medium mt-0.5">{new Date(cy.payout_date).toLocaleString()}</p>
                    </div>
                  </div>

                  {cy.status === 'paid_out' && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11.5px]">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400">Paid out · {fmt(cy.payout_amount || total)}</p>
                      <p className="text-muted-foreground text-[10.5px] mt-0.5">Processed {new Date(cy.payout_processed_at || cy.payout_date).toLocaleString()}</p>
                    </div>
                  )}

                  {/* Paid members */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Paid ({paidMembers.length})</p>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">{fmt(total)}</span>
                    </div>
                    {paidMembers.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic px-2 py-3 text-center bg-muted/30 rounded-md">No contributions yet.</p>
                    ) : (
                      <div className="rounded-lg border border-border/40 divide-y divide-border/30">
                        {paidMembers.map(m => {
                          const info = paidMap.get(m.user_id)!;
                          return (
                            <div key={m.user_id} className="flex items-center gap-2 px-2.5 py-2">
                              <Avatar className="w-7 h-7 shrink-0">
                                <AvatarImage src={m.profile?.avatar_url || undefined} />
                                <AvatarFallback className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><UserIcon className="w-1/2 h-1/2 opacity-70" /></AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-medium truncate leading-tight">{m.profile?.full_name || 'Unknown'}</p>
                                <p className="text-[10px] text-muted-foreground">{new Date(info.paid_at).toLocaleDateString()} · {info.method}</p>
                              </div>
                              <span className="text-[11.5px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">{fmt(info.amount)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Unpaid members */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-semibold">Pending ({unpaidMembers.length})</p>
                      {arrears > 0 && <span className="text-[10px] text-destructive font-medium">{fmt(arrears)} owed</span>}
                    </div>
                    {unpaidMembers.length === 0 ? (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 italic px-2 py-3 text-center bg-emerald-500/5 rounded-md flex items-center justify-center gap-1">
                        <CheckCircle2 size={12} /> Everyone has paid.
                      </p>
                    ) : (
                      <div className="rounded-lg border border-border/40 divide-y divide-border/30">
                        {unpaidMembers.map(m => {
                          const owed = Number(cy.contribution_amount) + (isLate ? Number(cy.penalty_amount || 0) : 0);
                          return (
                            <div key={m.user_id} className="flex items-center gap-2 px-2.5 py-2">
                              <Avatar className="w-7 h-7 shrink-0">
                                <AvatarImage src={m.profile?.avatar_url || undefined} />
                                <AvatarFallback className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400"><UserIcon className="w-1/2 h-1/2 opacity-70" /></AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="text-[12px] font-medium truncate leading-tight">{m.profile?.full_name || 'Unknown'}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{m.profile?.phone || '—'}{isLate ? ' · late penalty applies' : ''}</p>
                              </div>
                              <span className="text-[11.5px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">{fmt(owed)}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <DialogFooter className="gap-2 flex-col-reverse sm:flex-row">
                  <Button variant="outline" onClick={() => setDetailCycle(null)}>Close</Button>
                  {isChair && cy.status !== 'paid_out' && cy.status !== 'closed_no_funds' && total >= 10 && (
                    <Button
                      onClick={() => triggerB2CPayout(cy)}
                      disabled={payoutTriggering === cy.id}
                      className="gap-1.5"
                    >
                      {payoutTriggering === cy.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                      {cy.status === 'payout_failed' ? 'Retry Payout' : 'Trigger Payout'} ({fmt(total)})
                    </Button>
                  )}
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Broadcast dialog */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone size={18} className="text-accent" /> Broadcast to Members
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[11.5px] text-muted-foreground">
              Sends an SMS to every active member. Each message is personalised:
              <span className="block mt-1 italic text-foreground/80">"Hello [Name], [{group?.name?.toUpperCase() || 'CHAMA'}]: your message…"</span>
            </p>
            <div>
              <Label>Message</Label>
              <Textarea
                value={broadcastMsg}
                onChange={(e) => setBroadcastMsg(e.target.value.slice(0, 280))}
                placeholder="Reminder: meeting this Sunday 3pm at the office."
                rows={4}
                className="mt-1 resize-none"
              />
              <p className="text-[10px] text-muted-foreground text-right mt-1">{broadcastMsg.length}/280</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
            <Button onClick={sendBroadcast} disabled={broadcasting || broadcastMsg.trim().length < 2} className="gap-1.5">
              {broadcasting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Send Broadcast
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
