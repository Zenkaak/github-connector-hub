import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Search, Wallet, Banknote, HeartHandshake, PiggyBank, Users, Building2,
  Phone, Receipt, Clock, Hash, Undo2, Send, Settings2, User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

type TargetType = 'wallet' | 'loan' | 'harambee' | 'savings' | 'chama' | 'group';

interface Props {
  payment: any | null;
  onClose: () => void;
  onResolved: () => void;
}

const TABS: { value: TargetType; label: string; icon: any }[] = [
  { value: 'wallet',   label: 'Wallet',   icon: Wallet },
  { value: 'loan',     label: 'Loan',     icon: Banknote },
  { value: 'harambee', label: 'Harambee', icon: HeartHandshake },
  { value: 'savings',  label: 'Savings',  icon: PiggyBank },
  { value: 'chama',    label: 'Chama',    icon: Users },
  { value: 'group',    label: 'Group',    icon: Building2 },
];

export function AdminReconcileDialog({ payment, onClose, onResolved }: Props) {
  const [tab, setTab] = useState<TargetType>('wallet');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Refund / Send / Status state
  const [actionMode, setActionMode] = useState<'assign' | 'refund' | 'send' | 'status'>('assign');
  const [sendPhone, setSendPhone] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendRemarks, setSendRemarks] = useState('Admin payout');
  const [statusValue, setStatusValue] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Enriched data resolved from c2b transactions (real phone + receipt)
  const [senderName, setSenderName] = useState<string | null>(null);
  const [realPhone, setRealPhone] = useState<string | null>(null);
  const [mpesaReceipt, setMpesaReceipt] = useState<string | null>(null);

  // Resolve a usable phone: pick the first valid Kenyan-looking number from candidates
  const resolvePhone = (...candidates: (string | null | undefined)[]) => {
    for (const c of candidates) {
      if (!c) continue;
      const digits = String(c).replace(/\D/g, '');
      if (/^(254|0)?[17]\d{8}$/.test(digits)) return digits;
    }
    return null;
  };

  useEffect(() => {
    if (!payment) return;
    // Bill ref often IS the phone (e.g. 0792144743)
    const billRefPhone = resolvePhone(payment.bill_ref_number);
    const initialPhone = billRefPhone || resolvePhone(payment.msisdn, payment.phone) || '';
    setSearch(initialPhone);
    setSelected(null);
    setNotes('');
    setActionMode('assign');
    setSendPhone(initialPhone);
    setSendAmount(String(payment.amount || ''));
    setStatusValue(payment.status || 'pending');
    setSenderName(null);
    setRealPhone(billRefPhone);
    setMpesaReceipt(payment.mpesa_receipt || payment.trans_id || null);

    // Lookup matching c2b transaction for sender name + mpesa receipt
    (async () => {
      let row: any = null;
      if (payment.c2b_transaction_id) {
        const { data } = await supabase.from('mpesa_c2b_transactions')
          .select('first_name, middle_name, last_name, msisdn, trans_id, raw_payload')
          .eq('id', payment.c2b_transaction_id).maybeSingle();
        row = data;
      }
      if (!row && payment.bill_ref_number) {
        const { data } = await supabase.from('mpesa_c2b_transactions')
          .select('first_name, middle_name, last_name, msisdn, trans_id, raw_payload')
          .eq('bill_ref_number', payment.bill_ref_number)
          .order('created_at', { ascending: false }).limit(1).maybeSingle();
        row = data;
      }
      if (row) {
        const name = [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim();
        if (name) setSenderName(name);
        if (row.trans_id) setMpesaReceipt(row.trans_id);
      }

      // Try to find a Dasnet user via mpesa_account_code matching the bill ref
      if (payment.bill_ref_number && !billRefPhone) {
        const { data: prof } = await supabase.from('profiles')
          .select('full_name, phone, mpesa_account_code')
          .eq('mpesa_account_code', payment.bill_ref_number).maybeSingle();
        if (prof) {
          if (!senderName && prof.full_name) setSenderName(prof.full_name);
          const p = resolvePhone(prof.phone);
          if (p) {
            setRealPhone(p);
            setSearch((s) => s || p);
            setSendPhone((sp) => (resolvePhone(sp) ? sp : p));
          }
        }
      }
    })();
  }, [payment]);

  useEffect(() => {
    if (!payment || actionMode !== 'assign') return;
    const t = setTimeout(() => runSearch(), 250);
    return () => clearTimeout(t);
  }, [search, tab, payment, actionMode]);

  const runSearch = async () => {
    setLoading(true); setResults([]);
    try {
      const q = search.trim();
      if (tab === 'wallet') {
        let req = supabase.from('profiles').select('user_id, full_name, phone, mpesa_account_code').limit(20);
        if (q) req = req.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,mpesa_account_code.ilike.%${q}%`);
        const { data } = await req; setResults(data || []);
      } else if (tab === 'loan') {
        const { data } = await supabase.from('loan_disbursements')
          .select('id, loan_id, user_id, outstanding_balance, monthly_repayment')
          .eq('status', 'active').limit(20);
        const ids = (data || []).map(d => d.user_id);
        const { data: profiles } = ids.length
          ? await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', ids)
          : { data: [] as any[] };
        const merged = (data || []).map(d => ({
          ...d, profile: profiles?.find(p => p.user_id === d.user_id),
        })).filter(r => !q || r.profile?.full_name?.toLowerCase().includes(q.toLowerCase()) || r.profile?.phone?.includes(q));
        setResults(merged);
      } else if (tab === 'harambee') {
        let req = supabase.from('chama_harambees').select('id, title, raised_amount, target_amount, short_code, status').eq('status', 'active').limit(20);
        if (q) req = req.or(`title.ilike.%${q}%,short_code.ilike.%${q}%`);
        const { data } = await req; setResults(data || []);
      } else if (tab === 'savings') {
        let req = supabase.from('personal_savings').select('id, user_id, name, saved_amount, target_amount').eq('status', 'active').limit(20);
        if (q) req = req.ilike('name', `%${q}%`);
        const { data } = await req;
        const ids = (data || []).map(d => d.user_id);
        const { data: profiles } = ids.length
          ? await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', ids)
          : { data: [] as any[] };
        setResults((data || []).map(d => ({ ...d, profile: profiles?.find(p => p.user_id === d.user_id) })));
      } else {
        let req = supabase.from('chama_groups').select('id, name, contribution_amount, order_number').limit(20);
        if (q) req = req.or(`name.ilike.%${q}%,order_number.ilike.%${q}%`);
        const { data } = await req; setResults(data || []);
      }
    } catch (e: any) {
      toast.error(e.message || 'Search failed');
    } finally { setLoading(false); }
  };

  const submit = async () => {
    if (!selected || !payment) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const amount = Number(payment.amount);
      const ref = payment.bill_ref_number || payment.c2b_transaction_id;

      if (tab === 'wallet') {
        const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', selected.user_id).maybeSingle();
        if (w) await supabase.from('wallets').update({ balance: Number(w.balance) + amount }).eq('user_id', selected.user_id);
        else await supabase.from('wallets').insert({ user_id: selected.user_id, balance: amount });
        await supabase.from('wallet_transactions').insert({
          user_id: selected.user_id, type: 'credit', amount,
          description: `Manual reconciliation from M-Pesa ${payment.msisdn || ''}`.trim(), reference_id: ref,
        });
        await supabase.from('notifications').insert({
          user_id: selected.user_id, title: 'Wallet Top-Up',
          message: `KES ${amount.toLocaleString()} has been credited to your wallet (manual reconciliation).`, type: 'wallet',
        });
      } else if (tab === 'loan') {
        const newBal = Math.max(0, Number(selected.outstanding_balance) - amount);
        await supabase.from('loan_disbursements').update({ outstanding_balance: newBal, status: newBal === 0 ? 'completed' : 'active' }).eq('id', selected.id);
        await supabase.from('notifications').insert({
          user_id: selected.user_id, title: 'Loan Repayment Received',
          message: `KES ${amount.toLocaleString()} applied to your loan. New balance: KES ${newBal.toLocaleString()}.`, type: 'loan',
        });
      } else if (tab === 'harambee') {
        await supabase.from('chama_harambee_contributions').insert({
          harambee_id: selected.id, amount,
          contributor_name: payment.msisdn ? `M-Pesa ${payment.msisdn}` : 'M-Pesa contributor', stk_reference: ref,
        });
      } else if (tab === 'savings') {
        await supabase.from('personal_savings').update({ saved_amount: Number(selected.saved_amount) + amount }).eq('id', selected.id);
        await supabase.from('personal_savings_deposits').insert({
          savings_id: selected.id, user_id: selected.user_id, amount, stk_reference: ref,
        });
        await supabase.from('notifications').insert({
          user_id: selected.user_id, title: 'Savings Deposit',
          message: `KES ${amount.toLocaleString()} added to "${selected.name}".`, type: 'savings',
        });
      } else if (tab === 'chama') {
        let attributedUserId: string | null = null;
        if (payment.msisdn) {
          const { data: prof } = await supabase.from('profiles').select('user_id').eq('phone', payment.msisdn).maybeSingle();
          attributedUserId = prof?.user_id || null;
        }
        if (!attributedUserId) attributedUserId = user!.id;
        await supabase.from('chama_savings').insert({
          group_id: selected.id, user_id: attributedUserId, amount,
          month: new Date().toISOString().slice(0, 7), stk_reference: ref,
        });
      } else {
        await supabase.from('chama_savings').insert({
          group_id: selected.id, user_id: user!.id, amount,
          month: new Date().toISOString().slice(0, 7), stk_reference: ref,
        });
      }

      await supabase.from('mpesa_unmapped_payments').update({
        resolved: true, resolved_at: new Date().toISOString(), resolved_by: user!.id,
        resolution_notes: `Assigned to ${tab}: ${selected.name || selected.full_name || selected.title || selected.id}. ${notes}`.trim(),
        status: 'completed',
      }).eq('id', payment.id);

      await supabase.from('audit_logs').insert({
        admin_id: user!.id, action: `mpesa_reconcile_${tab}`,
        details: { payment_id: payment.id, amount, target_id: selected.id || selected.user_id, ref, notes },
      });

      toast.success('Payment reconciled successfully');
      onResolved(); onClose();
    } catch (e: any) {
      toast.error(e.message || 'Reconciliation failed');
    } finally { setSubmitting(false); }
  };

  const callAction = async (body: any, okMsg: string) => {
    setActionBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-mpesa-action', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(okMsg);
      onResolved();
      if (body.action !== 'status') onClose();
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally { setActionBusy(false); }
  };

  const refundSender = () => {
    if (!payment?.msisdn) { toast.error('No sender phone'); return; }
    if (!confirm(`Refund KES ${Number(payment.amount).toLocaleString()} back to ${payment.msisdn} via M-Pesa?`)) return;
    callAction({ action: 'refund', payment_id: payment.id }, 'Refund initiated');
  };

  const sendToPhone = () => {
    const amt = Number(sendAmount);
    if (!sendPhone || !amt || amt < 10) { toast.error('Enter a valid phone and amount (min 10)'); return; }
    if (!confirm(`Send KES ${amt.toLocaleString()} to ${sendPhone}?`)) return;
    callAction({ action: 'send', amount: amt, phone: sendPhone, remarks: sendRemarks }, 'Payout queued');
  };

  const updateStatus = () => {
    if (!statusValue) return;
    callAction({ action: 'status', payment_id: payment.id, status: statusValue, notes }, 'Status updated');
  };

  const renderResultRow = (r: any) => {
    const isSel = selected && (selected.id === r.id || (tab === 'wallet' && selected.user_id === r.user_id));
    let primary = '', secondary = '';
    if (tab === 'wallet') { primary = r.full_name || 'Unnamed'; secondary = `${r.phone || '—'} • Code ${r.mpesa_account_code || '—'}`; }
    else if (tab === 'loan') { primary = r.profile?.full_name || 'Unknown'; secondary = `Outstanding KES ${Number(r.outstanding_balance).toLocaleString()} • ${r.profile?.phone || '—'}`; }
    else if (tab === 'harambee') { primary = r.title; secondary = `Code ${r.short_code || '—'} • Raised KES ${Number(r.raised_amount).toLocaleString()}/${Number(r.target_amount).toLocaleString()}`; }
    else if (tab === 'savings') { primary = r.name; secondary = `${r.profile?.full_name || 'Unknown'} • Saved KES ${Number(r.saved_amount).toLocaleString()}`; }
    else { primary = r.name; secondary = `Order ${r.order_number || '—'} • Contribution KES ${Number(r.contribution_amount).toLocaleString()}`; }
    return (
      <button key={r.id || r.user_id} onClick={() => setSelected(r)}
        className={`w-full text-left p-3 rounded-lg border transition-colors ${isSel ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50'}`}>
        <p className="font-semibold text-sm break-words">{primary}</p>
        <p className="text-xs text-muted-foreground break-words">{secondary}</p>
      </button>
    );
  };

  if (!payment) return null;
  const ts = payment.created_at ? format(new Date(payment.created_at), 'MMM d, yyyy HH:mm') : '—';

  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl w-[calc(100vw-1.5rem)] max-h-[92vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-4 sm:px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-base">Reconcile M-Pesa Payment</DialogTitle>
        </DialogHeader>

        {/* Transaction header */}
        <div className="px-4 sm:px-5 pt-4">
          <div className="rounded-xl bg-muted/40 border border-border p-3 space-y-2.5">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <p className="text-xl font-bold tabular-nums">KES {Number(payment.amount).toLocaleString()}</p>
              <Badge variant={payment.status === 'completed' ? 'secondary' : 'outline'} className="text-[10px]">
                {payment.status || 'pending'}
              </Badge>
            </div>
            <DetailRow icon={UserIcon} label="Name" value={senderName || '—'} />
            <DetailRow icon={Phone} label="Phone" value={realPhone || payment.msisdn || '—'} mono />
            <DetailRow icon={Receipt} label="Receipt" value={mpesaReceipt || '—'} mono accent />
            <DetailRow icon={Hash} label="Bill Ref" value={payment.bill_ref_number || '—'} mono />
            <DetailRow icon={Clock} label="Time" value={ts} />
            {payment.reason && <DetailRow icon={Settings2} label="Reason" value={payment.reason} />}
          </div>
        </div>

        {/* Action mode picker */}
        <div className="px-4 sm:px-5 pt-4">
          <Tabs value={actionMode} onValueChange={(v) => setActionMode(v as any)}>
            <TabsList className="grid grid-cols-4 w-full bg-muted/40 p-1 h-auto">
              <TabsTrigger value="assign" className="text-[11px] py-2">Assign</TabsTrigger>
              <TabsTrigger value="refund" className="text-[11px] py-2">Refund</TabsTrigger>
              <TabsTrigger value="send"   className="text-[11px] py-2">Send</TabsTrigger>
              <TabsTrigger value="status" className="text-[11px] py-2">Status</TabsTrigger>
            </TabsList>

            {/* ASSIGN */}
            <TabsContent value="assign" className="mt-4 space-y-3">
              <Tabs value={tab} onValueChange={(v) => setTab(v as TargetType)}>
                <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto w-full gap-1 bg-muted/40 p-1">
                  {TABS.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="flex flex-col gap-1 py-2 text-[10px] data-[state=active]:bg-card">
                      <t.icon size={14} /> {t.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {TABS.map((t) => (
                  <TabsContent key={t.value} value={t.value} className="space-y-3 mt-4">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Dasnet by name, phone, code…" className="pl-9" />
                    </div>
                    {loading ? (
                      <div className="flex justify-center py-8"><Loader2 className="animate-spin text-accent" size={18} /></div>
                    ) : results.length === 0 ? (
                      <p className="text-center text-xs text-muted-foreground py-8">No matches found.</p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">{results.map(renderResultRow)}</div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>

              <div className="space-y-1.5">
                <Label className="text-xs">Resolution notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Why this assignment…" />
              </div>
            </TabsContent>

            {/* REFUND */}
            <TabsContent value="refund" className="mt-4 space-y-3">
              <div className="rounded-xl border border-border p-3 space-y-1 text-sm">
                <p className="text-muted-foreground text-xs">Refund the full payment back to the sender via M-Pesa B2C.</p>
                <p><span className="text-muted-foreground">To:</span> <span className="font-mono">{payment.msisdn || '—'}</span></p>
                <p><span className="text-muted-foreground">Amount:</span> <span className="font-bold">KES {Number(payment.amount).toLocaleString()}</span></p>
              </div>
              <Button onClick={refundSender} disabled={actionBusy || !payment.msisdn} className="w-full gap-2" variant="destructive">
                {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <Undo2 size={14} />} Refund sender
              </Button>
            </TabsContent>

            {/* SEND */}
            <TabsContent value="send" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Phone number</Label>
                <Input value={sendPhone} onChange={(e) => setSendPhone(e.target.value)} placeholder="0712345678" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Amount (KES)</Label>
                <Input type="number" value={sendAmount} onChange={(e) => setSendAmount(e.target.value)} placeholder="100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Remarks</Label>
                <Input value={sendRemarks} onChange={(e) => setSendRemarks(e.target.value)} />
              </div>
              <Button onClick={sendToPhone} disabled={actionBusy} className="w-full gap-2">
                {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send via M-Pesa
              </Button>
            </TabsContent>

            {/* STATUS */}
            <TabsContent value="status" className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Set status</Label>
                <Select value={statusValue} onValueChange={setStatusValue}>
                  <SelectTrigger><SelectValue placeholder="Pick a status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
              <Button onClick={updateStatus} disabled={actionBusy || !statusValue} className="w-full gap-2">
                {actionBusy ? <Loader2 size={14} className="animate-spin" /> : <Settings2 size={14} />} Update status
              </Button>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="px-4 sm:px-5 py-4 border-t mt-4 gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {actionMode === 'assign' && (
            <Button onClick={submit} disabled={!selected || submitting}>
              {submitting ? <Loader2 className="animate-spin" size={14} /> : 'Reconcile & Credit'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ icon: Icon, label, value, mono, accent }: { icon: any; label: string; value: string; mono?: boolean; accent?: boolean }) {
  return (
    <div className="flex items-start gap-2 text-xs min-w-0">
      <Icon size={12} className="text-muted-foreground mt-0.5 shrink-0" />
      <span className="text-muted-foreground shrink-0 w-16">{label}</span>
      <span className={`flex-1 text-foreground break-all ${mono ? 'font-mono' : ''} ${accent ? 'text-amber-500' : ''}`}>
        {value}
      </span>
    </div>
  );
}
