import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Search, Wallet, Banknote, HeartHandshake, PiggyBank, Users, Building2 } from 'lucide-react';
import { toast } from 'sonner';

type TargetType = 'wallet' | 'loan' | 'harambee' | 'savings' | 'chama' | 'group';

interface Props {
  payment: any | null;
  onClose: () => void;
  onResolved: () => void;
}

const TABS: { value: TargetType; label: string; icon: any; hint: string }[] = [
  { value: 'wallet',   label: 'User Wallet', icon: Wallet,        hint: 'Top up a user wallet' },
  { value: 'loan',     label: 'Loan',        icon: Banknote,      hint: 'Apply as loan repayment' },
  { value: 'harambee', label: 'Harambee',    icon: HeartHandshake,hint: 'Credit a harambee' },
  { value: 'savings',  label: 'Savings',     icon: PiggyBank,     hint: 'Credit a personal savings goal' },
  { value: 'chama',    label: 'Chama',       icon: Users,         hint: 'Credit chama savings' },
  { value: 'group',    label: 'Group',       icon: Building2,     hint: 'Credit a group wallet' },
];

export function AdminReconcileDialog({ payment, onClose, onResolved }: Props) {
  const [tab, setTab] = useState<TargetType>('wallet');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!payment) return;
    setSearch(payment.msisdn || '');
    setSelected(null);
    setNotes('');
  }, [payment, tab]);

  useEffect(() => {
    if (!payment) return;
    const t = setTimeout(() => runSearch(), 250);
    return () => clearTimeout(t);
  }, [search, tab, payment]);

  const runSearch = async () => {
    setLoading(true);
    setResults([]);
    try {
      const q = search.trim();
      if (tab === 'wallet') {
        let req = supabase.from('profiles').select('user_id, full_name, phone, mpesa_account_code').limit(20);
        if (q) req = req.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,mpesa_account_code.ilike.%${q}%`);
        const { data } = await req;
        setResults(data || []);
      } else if (tab === 'loan') {
        const { data } = await supabase
          .from('loan_disbursements')
          .select('id, loan_id, user_id, outstanding_balance, monthly_repayment')
          .eq('status', 'active').limit(20);
        // enrich with profile names
        const ids = (data || []).map((d) => d.user_id);
        const { data: profiles } = ids.length
          ? await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', ids)
          : { data: [] as any[] };
        const merged = (data || []).map((d) => ({
          ...d, profile: profiles?.find((p) => p.user_id === d.user_id),
        })).filter((r) => !q || r.profile?.full_name?.toLowerCase().includes(q.toLowerCase()) || r.profile?.phone?.includes(q));
        setResults(merged);
      } else if (tab === 'harambee') {
        let req = supabase.from('chama_harambees').select('id, title, raised_amount, target_amount, short_code, status').eq('status', 'active').limit(20);
        if (q) req = req.or(`title.ilike.%${q}%,short_code.ilike.%${q}%`);
        const { data } = await req;
        setResults(data || []);
      } else if (tab === 'savings') {
        let req = supabase.from('personal_savings').select('id, user_id, name, saved_amount, target_amount').eq('status', 'active').limit(20);
        if (q) req = req.ilike('name', `%${q}%`);
        const { data } = await req;
        const ids = (data || []).map((d) => d.user_id);
        const { data: profiles } = ids.length
          ? await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', ids)
          : { data: [] as any[] };
        setResults((data || []).map((d) => ({ ...d, profile: profiles?.find((p) => p.user_id === d.user_id) })));
      } else if (tab === 'chama' || tab === 'group') {
        let req = supabase.from('chama_groups').select('id, name, contribution_amount, order_number').limit(20);
        if (q) req = req.or(`name.ilike.%${q}%,order_number.ilike.%${q}%`);
        const { data } = await req;
        setResults(data || []);
      }
    } catch (e: any) {
      toast.error(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const submit = async () => {
    if (!selected || !payment) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const amount = Number(payment.amount);
      const ref = payment.bill_ref_number || payment.c2b_transaction_id;

      if (tab === 'wallet') {
        // Top up wallet
        const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', selected.user_id).maybeSingle();
        if (w) {
          await supabase.from('wallets').update({ balance: Number(w.balance) + amount }).eq('user_id', selected.user_id);
        } else {
          await supabase.from('wallets').insert({ user_id: selected.user_id, balance: amount });
        }
        await supabase.from('wallet_transactions').insert({
          user_id: selected.user_id, type: 'credit', amount,
          description: `Manual reconciliation from M-Pesa ${payment.msisdn || ''}`.trim(),
          reference_id: ref,
        });
        await supabase.from('notifications').insert({
          user_id: selected.user_id, title: 'Wallet Top-Up',
          message: `KES ${amount.toLocaleString()} has been credited to your wallet (manual reconciliation).`,
          type: 'wallet',
        });
      } else if (tab === 'loan') {
        const newBal = Math.max(0, Number(selected.outstanding_balance) - amount);
        await supabase.from('loan_disbursements').update({
          outstanding_balance: newBal,
          status: newBal === 0 ? 'completed' : 'active',
        }).eq('id', selected.id);
        await supabase.from('notifications').insert({
          user_id: selected.user_id, title: 'Loan Repayment Received',
          message: `KES ${amount.toLocaleString()} applied to your loan. New balance: KES ${newBal.toLocaleString()}.`,
          type: 'loan',
        });
      } else if (tab === 'harambee') {
        await supabase.from('chama_harambee_contributions').insert({
          harambee_id: selected.id, amount,
          contributor_name: payment.msisdn ? `M-Pesa ${payment.msisdn}` : 'M-Pesa contributor',
          stk_reference: ref,
        });
      } else if (tab === 'savings') {
        await supabase.from('personal_savings').update({
          saved_amount: Number(selected.saved_amount) + amount,
        }).eq('id', selected.id);
        await supabase.from('personal_savings_deposits').insert({
          savings_id: selected.id, user_id: selected.user_id, amount, stk_reference: ref,
        });
        await supabase.from('notifications').insert({
          user_id: selected.user_id, title: 'Savings Deposit',
          message: `KES ${amount.toLocaleString()} added to "${selected.name}".`,
          type: 'savings',
        });
      } else if (tab === 'chama') {
        // Find a member to attribute (by msisdn if possible), else attribute to admin reconciliation
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
      } else if (tab === 'group') {
        const { data: w } = await supabase.from('wallets').select('balance').eq('group_id', selected.id).maybeSingle();
        if (w) {
          await supabase.from('wallets').update({ balance: Number(w.balance) + amount }).eq('group_id', selected.id);
        } else {
          await supabase.from('wallets').insert({ group_id: selected.id, balance: amount });
        }
      }

      // Mark unmapped payment resolved
      await supabase.from('mpesa_unmapped_payments').update({
        resolved: true, resolved_at: new Date().toISOString(), resolved_by: user!.id,
        resolution_notes: `Assigned to ${tab}: ${selected.name || selected.full_name || selected.title || selected.id}. ${notes}`.trim(),
      }).eq('id', payment.id);

      // Audit log
      await supabase.from('audit_logs').insert({
        admin_id: user!.id,
        action: `mpesa_reconcile_${tab}`,
        details: { payment_id: payment.id, amount, target_id: selected.id || selected.user_id, ref, notes },
      });

      toast.success('Payment reconciled successfully');
      onResolved();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Reconciliation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const renderResultRow = (r: any) => {
    const isSelected = selected && (selected.id === r.id || (tab === 'wallet' && selected.user_id === r.user_id));
    let primary = '', secondary = '';
    if (tab === 'wallet') { primary = r.full_name || 'Unnamed'; secondary = `${r.phone || '—'} • Code ${r.mpesa_account_code || '—'}`; }
    else if (tab === 'loan') { primary = r.profile?.full_name || 'Unknown'; secondary = `Outstanding KES ${Number(r.outstanding_balance).toLocaleString()} • ${r.profile?.phone || '—'}`; }
    else if (tab === 'harambee') { primary = r.title; secondary = `Code ${r.short_code || '—'} • Raised KES ${Number(r.raised_amount).toLocaleString()}/${Number(r.target_amount).toLocaleString()}`; }
    else if (tab === 'savings') { primary = r.name; secondary = `${r.profile?.full_name || 'Unknown'} • Saved KES ${Number(r.saved_amount).toLocaleString()}`; }
    else { primary = r.name; secondary = `Order ${r.order_number || '—'} • Contribution KES ${Number(r.contribution_amount).toLocaleString()}`; }

    return (
      <button key={r.id || r.user_id}
        onClick={() => setSelected(r)}
        className={`w-full text-left p-3 rounded-lg border transition-colors ${isSelected ? 'border-accent bg-accent/10' : 'border-border hover:bg-muted/50'}`}>
        <p className="font-semibold text-sm truncate">{primary}</p>
        <p className="text-xs text-muted-foreground truncate">{secondary}</p>
      </button>
    );
  };

  if (!payment) return null;

  return (
    <Dialog open={!!payment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reconcile M-Pesa Payment</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-bold">KES {Number(payment.amount).toLocaleString()}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">From</span><span>{payment.msisdn || '—'}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Bill Ref</span><span className="font-mono text-xs">{payment.bill_ref_number}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Reason</span><span className="text-xs text-amber-600">{payment.reason}</span></div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as TargetType)}>
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="flex flex-col gap-1 py-2 text-[10px]">
                <t.icon size={14} /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {TABS.map((t) => (
            <TabsContent key={t.value} value={t.value} className="space-y-3 mt-3">
              <p className="text-xs text-muted-foreground">{t.hint}</p>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, phone, code, or title…" className="pl-9" />
              </div>

              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="animate-spin text-accent" /></div>
              ) : results.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground py-8">No matches found.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">{results.map(renderResultRow)}</div>
              )}
            </TabsContent>
          ))}
        </Tabs>

        <div className="space-y-2">
          <Label className="text-xs">Resolution notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Why this assignment…" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!selected || submitting}>
            {submitting ? <Loader2 className="animate-spin" size={14} /> : 'Reconcile & Credit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
