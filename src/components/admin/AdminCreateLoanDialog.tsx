import { useEffect, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}

export function AdminCreateLoanDialog({ open, onOpenChange, onCreated }: Props) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [target, setTarget] = useState<any | null>(null);
  const [amount, setAmount] = useState('');
  const [interest, setInterest] = useState('5');
  const [months, setMonths] = useState('3');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!search || search.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone, email')
        .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(8);
      setResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const submit = async () => {
    if (!target?.user_id) { toast.error('Pick a user'); return; }
    const amt = Number(amount);
    const rate = Number(interest);
    const m = Number(months);
    if (!amt || !rate || !m) { toast.error('Fill amount, interest %, months'); return; }
    setBusy(true);
    try {
      const total = amt * (1 + rate / 100);
      const { data: app, error: appErr } = await supabase.from('loan_applications').insert({
        user_id: target.user_id,
        applied_amount: amt,
        generated_limit: amt,
        status: 'disbursed',
        admin_message: reason || 'Loan created by admin',
        loan_type: 'admin_issued',
        next_of_kin_name: 'N/A',
        next_of_kin_phone: 'N/A',
      } as any).select('id').single();
      if (appErr) throw appErr;

      const { error: dErr } = await supabase.from('loan_disbursements').insert({
        loan_id: app.id, user_id: target.user_id,
        disbursed_amount: amt, outstanding_balance: total,
        interest_rate: rate, monthly_repayment: total / m, status: 'active',
      } as any);
      if (dErr) throw dErr;

      const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', target.user_id).maybeSingle();
      await supabase.from('wallets').update({ balance: Number(w?.balance || 0) + amt }).eq('user_id', target.user_id);

      await supabase.from('notifications').insert({
        user_id: target.user_id, type: 'loan', title: 'Loan Disbursed 💰',
        message: `KES ${amt.toLocaleString()} has been credited to your wallet.`,
      });

      toast.success('Loan created and wallet credited');
      onOpenChange(false);
      setTarget(null); setAmount(''); setReason(''); setSearch('');
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText size={18} className="text-accent" /> Create Loan for User</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {target ? (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{target.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{target.phone || target.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTarget(null)}>Change</Button>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Search User</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, or email" />
              {results.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto border border-border/40 rounded-lg">
                  {results.map((r) => (
                    <button key={r.user_id} onClick={() => setTarget(r)}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b border-border/20 last:border-0">
                      <p className="font-medium">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground">{r.phone || r.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            <div><Label className="text-xs">Amount</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div><Label className="text-xs">Interest %</Label><Input type="number" value={interest} onChange={(e) => setInterest(e.target.value)} /></div>
            <div><Label className="text-xs">Months</Label><Input type="number" value={months} onChange={(e) => setMonths(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Note (optional)</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Emergency loan" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy || !target}>{busy ? <Loader2 className="animate-spin" size={16} /> : 'Create & Disburse'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
