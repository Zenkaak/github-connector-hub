import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Loader2, Check, X as XIcon, Plus, Clock, Banknote, CheckCircle2, XCircle } from 'lucide-react';
import { AdminCreateLoanDialog } from './AdminCreateLoanDialog';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminKpiCard } from './AdminKpiCard';
import { AdminToolbar, exportToCsv } from './AdminToolbar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { format } from 'date-fns';

type LoanStatus = 'pending' | 'approved' | 'rejected' | 'disbursed';

export function AdminLoansModule() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LoanStatus>('pending');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [adminMessage, setAdminMessage] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [acting, setActing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [stats, setStats] = useState({ pending: 0, approved: 0, disbursed: 0, disbursedValue: 0, rejected: 0 });

  useEffect(() => {
    (async () => {
      const [p, ap, d, r] = await Promise.all([
        supabase.from('loan_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('loan_applications').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('loan_applications').select('amount, generated_limit').eq('status', 'disbursed'),
        supabase.from('loan_applications').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);
      const disbursedValue = (d.data || []).reduce((s: number, l: any) => s + Number(l.generated_limit || l.amount || 0), 0);
      setStats({ pending: p.count || 0, approved: ap.count || 0, disbursed: d.data?.length || 0, disbursedValue, rejected: r.count || 0 });
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('loan_applications')
      .select('*')
      .eq('status', filter)
      .order('created_at', { ascending: false })
      .limit(200);
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
    const { data: w } = await supabase.from('wallets').select('balance').eq('user_id', selected.user_id).single();
    await supabase.from('wallets').update({ balance: Number(w?.balance || 0) + amount }).eq('user_id', selected.user_id);
    await supabase.from('notifications').insert({
      user_id: selected.user_id, type: 'loan', title: 'Loan Disbursed 💰',
      message: `KES ${amount.toLocaleString()} has been credited to your wallet.`,
    });
    toast.success('Loan disbursed'); setSelected(null); load(); setActing(false);
  };

  const filtered = loans.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.profile?.full_name?.toLowerCase().includes(q) || l.profile?.phone?.includes(search) || l.loan_type?.toLowerCase().includes(q);
  });

  const handleExport = () => {
    exportToCsv(`loans-${filter}-${format(new Date(), 'yyyy-MM-dd')}`, filtered, [
      { header: 'Applicant', get: (l) => l.profile?.full_name || '' },
      { header: 'Phone',     get: (l) => l.profile?.phone || '' },
      { header: 'Type',      get: (l) => l.loan_type || '' },
      { header: 'Applied',   get: (l) => Number(l.applied_amount || 0) },
      { header: 'Approved',  get: (l) => Number(l.generated_limit || 0) },
      { header: 'Status',    get: (l) => l.status },
      { header: 'Date',      get: (l) => format(new Date(l.created_at), 'yyyy-MM-dd HH:mm') },
    ]);
  };

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Loan Applications" description="Review and approve loan requests" icon={FileText}
        actions={<Button variant="gold" size="sm" onClick={() => setCreateOpen(true)}><Plus size={14} className="mr-1" />Create Loan</Button>} />
      <AdminCreateLoanDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={load} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <AdminKpiCard label="Pending" value={stats.pending.toLocaleString()} icon={Clock} accent="gold" />
        <AdminKpiCard label="Disbursed value" value={`KES ${Math.round(stats.disbursedValue).toLocaleString()}`} icon={Banknote} accent="emerald" />
        <AdminKpiCard label="Active loans" value={stats.disbursed.toLocaleString()} icon={CheckCircle2} accent="blue" />
        <AdminKpiCard label="Rejected" value={stats.rejected.toLocaleString()} icon={XCircle} accent="red" />
      </div>

      <AdminToolbar<LoanStatus>
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search applicant, phone, loan type…"
        filters={[
          { key: 'pending',   label: 'Pending',   count: stats.pending },
          { key: 'approved',  label: 'Approved',  count: stats.approved },
          { key: 'disbursed', label: 'Disbursed', count: stats.disbursed },
          { key: 'rejected',  label: 'Rejected',  count: stats.rejected },
        ]}
        activeFilter={filter}
        onFilterChange={setFilter}
        onExport={filtered.length ? handleExport : undefined}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState icon={FileText} title={search ? 'No matches' : `No ${filter} loans`} />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((l) => (
              <button key={l.id} onClick={() => open(l)} className="w-full p-4 hover:bg-muted/60 text-left flex items-center gap-3 transition-colors">
                <div className="h-10 w-10 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold text-sm shrink-0">
                  {(l.profile?.full_name || 'U').slice(0, 1).toUpperCase()}
                </div>
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
