import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Loader2, Check, X as XIcon } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function AdminLoansModule() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'disbursed'>('pending');
  const [selected, setSelected] = useState<any>(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [acting, setActing] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('loan_applications')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false })
      .limit(100);
    const userIds = [...new Set((data || []).map((l) => l.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', userIds);
    const pmap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    setLoans((data || []).map((l) => ({ ...l, profile: pmap.get(l.user_id) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const open = (loan: any) => {
    setSelected(loan); setAdminMessage(loan.admin_message || ''); setApprovedAmount(String(loan.applied_amount));
  };

  const decide = async (status: 'approved' | 'rejected') => {
    if (!selected) return;
    setActing(true);
    const updates: any = { status, admin_message: adminMessage };
    if (status === 'approved') updates.generated_limit = Number(approvedAmount) || selected.applied_amount;
    const { error } = await supabase.from('loan_applications').update(updates).eq('id', selected.id);
    if (error) { toast.error(error.message); setActing(false); return; }
    await supabase.from('notifications').insert({
      user_id: selected.user_id, type: 'loan',
      title: status === 'approved' ? 'Loan Approved 🎉' : 'Loan Rejected',
      message: status === 'approved' ? `Your loan of KES ${approvedAmount} has been approved.` : (adminMessage || 'Your application was not approved.'),
    });
    toast.success(`Loan ${status}`); setSelected(null); load(); setActing(false);
  };

  const disburse = async () => {
    if (!selected) return;
    setActing(true);
    const amount = Number(approvedAmount) || selected.generated_limit;
    const { error } = await supabase.from('loan_disbursements').insert({
      loan_id: selected.id, user_id: selected.user_id,
      disbursed_amount: amount, outstanding_balance: amount * 1.05,
      interest_rate: 5, monthly_repayment: (amount * 1.05) / 3, status: 'active',
    });
    if (error) { toast.error(error.message); setActing(false); return; }
    await supabase.from('loan_applications').update({ status: 'disbursed' }).eq('id', selected.id);
    // Credit wallet
    const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', selected.user_id).single();
    await supabase.from('wallets').update({ balance: Number(w?.balance || 0) + amount }).eq('user_id', selected.user_id);
    await supabase.from('notifications').insert({
      user_id: selected.user_id, type: 'loan', title: 'Loan Disbursed 💰',
      message: `KES ${amount.toLocaleString()} has been credited to your wallet.`,
    });
    toast.success('Loan disbursed'); setSelected(null); load(); setActing(false);
  };

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Loan Applications" description="Review and approve loan requests" icon={FileText} />
      <div className="flex gap-2 flex-wrap">
        {(['pending', 'approved', 'disbursed', 'rejected'] as const).map((s) => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
      ) : loans.length === 0 ? (
        <AdminEmptyState icon={FileText} title={`No ${filter} loans`} />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {loans.map((l) => (
              <button key={l.id} onClick={() => open(l)} className="w-full p-4 hover:bg-muted/40 text-left flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{l.profile?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground">{l.profile?.phone} • {l.loan_type}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-foreground tabular-nums">KES {Number(l.applied_amount).toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(l.created_at), 'MMM d')}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          {selected && (
            <>
              <DialogHeader><DialogTitle>{selected.profile?.full_name} — Loan</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Applied</p><p className="font-bold">KES {Number(selected.applied_amount).toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Type</p><p className="font-medium">{selected.loan_type}</p></div>
                  <div><p className="text-xs text-muted-foreground">Income</p><p className="font-medium">KES {Number(selected.monthly_income).toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Expenses</p><p className="font-medium">KES {Number(selected.monthly_expenses).toLocaleString()}</p></div>
                  <div><p className="text-xs text-muted-foreground">Employment</p><p className="font-medium">{selected.employment_status}</p></div>
                  <div><p className="text-xs text-muted-foreground">Next of kin</p><p className="font-medium truncate">{selected.next_of_kin_name}</p></div>
                </div>
                {(filter === 'pending' || filter === 'approved') && (
                  <Input type="number" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} placeholder="Approved amount" />
                )}
                <Textarea value={adminMessage} onChange={(e) => setAdminMessage(e.target.value)} placeholder="Message to applicant…" rows={2} />
              </div>
              <DialogFooter className="gap-2">
                {filter === 'pending' && (
                  <>
                    <Button variant="destructive" size="sm" onClick={() => decide('rejected')} disabled={acting}><XIcon size={14} /> Reject</Button>
                    <Button variant="success" size="sm" onClick={() => decide('approved')} disabled={acting}><Check size={14} /> Approve</Button>
                  </>
                )}
                {filter === 'approved' && (
                  <Button variant="success" size="sm" onClick={disburse} disabled={acting}>Disburse to wallet</Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
