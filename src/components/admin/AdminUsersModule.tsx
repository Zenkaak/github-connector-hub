import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, Search, Ban, CheckCircle2, MessageSquare, Loader2, Wallet, Shield,
  FileText, PiggyBank, Activity, Save, Mail, Phone, MapPin, IdCard, Calendar,
} from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface UserRow {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  county: string | null;
  sub_county: string | null;
  ward: string | null;
  address: string | null;
  id_number: string | null;
  date_of_birth: string | null;
  is_active: boolean;
  is_verified: boolean;
  disable_reason: string | null;
  created_at: string;
  mpesa_account_code: string | null;
  balance: number;
  isAdminRole: boolean;
}

interface UserStats {
  totalDeposits: number;
  totalWithdrawals: number;
  totalSent: number;
  totalReceived: number;
  activeLoans: number;
  totalSaved: number;
  chamaCount: number;
  harambeeCount: number;
}

interface UnifiedTx {
  id: string;
  source: 'wallet' | 'mpesa_in' | 'mpesa_out' | 'loan' | 'savings' | 'chama';
  type: string;
  amount: number;
  description: string;
  reference: string | null;
  counterparty: string | null;
  date: string;
  status: string;
}

const EMPTY_STATS: UserStats = {
  totalDeposits: 0, totalWithdrawals: 0, totalSent: 0, totalReceived: 0,
  activeLoans: 0, totalSaved: 0, chamaCount: 0, harambeeCount: 0,
};

export function AdminUsersModule() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled' | 'verified' | 'unverified' | 'admins'>('all');
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [editing, setEditing] = useState<Partial<UserRow>>({});
  const [stats, setStats] = useState<UserStats>(EMPTY_STATS);
  const [chamas, setChamas] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjustReason, setAdjustReason] = useState('');
  const [transactions, setTransactions] = useState<UnifiedTx[]>([]);
  const [txFilter, setTxFilter] = useState<'all' | 'wallet' | 'mpesa_in' | 'mpesa_out' | 'loan' | 'savings' | 'chama'>('all');
  const [loadingTx, setLoadingTx] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    const userIds = (profiles || []).map((u) => u.user_id);
    const [{ data: wallets }, { data: roles }] = await Promise.all([
      supabase.from('wallets').select('user_id, balance').in('user_id', userIds),
      supabase.from('user_roles').select('user_id, role').in('user_id', userIds).eq('role', 'admin'),
    ]);
    const walletMap = new Map((wallets || []).map((w: any) => [w.user_id, Number(w.balance || 0)]));
    const adminSet = new Set((roles || []).map((r: any) => r.user_id));
    setUsers(
      (profiles || []).map((u: any) => ({
        ...u,
        balance: walletMap.get(u.user_id) || 0,
        isAdminRole: adminSet.has(u.user_id),
      })),
    );
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openUser = async (u: UserRow) => {
    setSelected(u);
    setEditing({ ...u });
    setStats(EMPTY_STATS);
    setChamas([]);
    setTransactions([]);
    setLoadingTx(true);

    // Load detailed financial activity + full transaction history
    const [tx, loans, savings, chamaMembers, harambees, mpesaIn, mpesaOut, loanDisb, savingsDep, chamaSav] = await Promise.all([
      supabase.from('wallet_transactions').select('id, type, amount, description, reference_id, created_at, status').eq('user_id', u.user_id).order('created_at', { ascending: false }).limit(200),
      supabase.from('loan_disbursements').select('outstanding_balance, status').eq('user_id', u.user_id).eq('status', 'active'),
      supabase.from('personal_savings').select('saved_amount').eq('user_id', u.user_id),
      supabase.from('chama_members').select('group_id, role, is_active, chama_groups(name)').eq('user_id', u.user_id).eq('is_active', true),
      supabase.from('chama_harambees').select('id', { count: 'exact', head: true }).eq('created_by', u.user_id),
      u.phone ? supabase.from('mpesa_c2b_transactions').select('id, trans_id, trans_amount, msisdn, first_name, last_name, bill_ref_number, created_at, processed').eq('msisdn', u.phone).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
      supabase.from('mpesa_b2c_requests').select('id, amount, phone, mpesa_receipt, status, created_at, result_desc').eq('user_id', u.user_id).order('created_at', { ascending: false }).limit(50),
      supabase.from('loan_disbursements').select('id, loan_id, disbursed_amount, outstanding_balance, status, disbursed_at, created_at').eq('user_id', u.user_id).order('created_at', { ascending: false }).limit(50),
      supabase.from('personal_savings_deposits').select('id, savings_id, amount, stk_reference, created_at').eq('user_id', u.user_id).order('created_at', { ascending: false }).limit(50),
      supabase.from('chama_savings').select('id, group_id, amount, stk_reference, month, created_at, chama_groups(name)').eq('user_id', u.user_id).order('created_at', { ascending: false }).limit(50),
    ]);
    const txs = tx.data || [];
    setStats({
      totalDeposits: txs.filter((t: any) => t.type === 'deposit' || t.type === 'credit').reduce((s, t: any) => s + Number(t.amount), 0),
      totalWithdrawals: txs.filter((t: any) => t.type === 'withdrawal' || t.type === 'debit').reduce((s, t: any) => s + Number(t.amount), 0),
      totalSent: txs.filter((t: any) => t.type === 'transfer_out').reduce((s, t: any) => s + Number(t.amount), 0),
      totalReceived: txs.filter((t: any) => t.type === 'transfer_in').reduce((s, t: any) => s + Number(t.amount), 0),
      activeLoans: (loans.data || []).reduce((s, l: any) => s + Number(l.outstanding_balance || 0), 0),
      totalSaved: (savings.data || []).reduce((s, p: any) => s + Number(p.saved_amount || 0), 0),
      chamaCount: (chamaMembers.data || []).length,
      harambeeCount: harambees.count || 0,
    });
    setChamas(chamaMembers.data || []);

    // Build unified transaction stream
    const unified: UnifiedTx[] = [];
    txs.forEach((t: any) => unified.push({
      id: `w-${t.id}`, source: 'wallet', type: t.type,
      amount: Number(t.amount), description: t.description || '—',
      reference: t.reference_id, counterparty: null, date: t.created_at, status: t.status || 'completed',
    }));
    (mpesaIn.data || []).forEach((t: any) => unified.push({
      id: `mi-${t.id}`, source: 'mpesa_in', type: 'mpesa_deposit',
      amount: Number(t.trans_amount),
      description: `M-Pesa deposit from ${[t.first_name, t.last_name].filter(Boolean).join(' ') || t.msisdn}`,
      reference: t.trans_id, counterparty: t.msisdn, date: t.created_at,
      status: t.processed ? 'completed' : 'pending',
    }));
    (mpesaOut.data || []).forEach((t: any) => unified.push({
      id: `mo-${t.id}`, source: 'mpesa_out', type: 'mpesa_payout',
      amount: Number(t.amount),
      description: `Payout to ${t.phone}${t.result_desc ? ` — ${t.result_desc}` : ''}`,
      reference: t.mpesa_receipt, counterparty: t.phone, date: t.created_at, status: t.status,
    }));
    (loanDisb.data || []).forEach((t: any) => unified.push({
      id: `l-${t.id}`, source: 'loan', type: 'loan_disbursement',
      amount: Number(t.disbursed_amount),
      description: `Loan disbursed (Outstanding KES ${Number(t.outstanding_balance).toLocaleString()})`,
      reference: t.loan_id, counterparty: null, date: t.disbursed_at || t.created_at, status: t.status,
    }));
    (savingsDep.data || []).forEach((t: any) => unified.push({
      id: `s-${t.id}`, source: 'savings', type: 'savings_deposit',
      amount: Number(t.amount), description: 'Personal savings deposit',
      reference: t.stk_reference, counterparty: null, date: t.created_at, status: 'completed',
    }));
    (chamaSav.data || []).forEach((t: any) => unified.push({
      id: `c-${t.id}`, source: 'chama', type: 'chama_contribution',
      amount: Number(t.amount),
      description: `Chama contribution — ${t.chama_groups?.name || 'Group'}${t.month ? ` (${t.month})` : ''}`,
      reference: t.stk_reference, counterparty: null, date: t.created_at, status: 'completed',
    }));
    unified.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setTransactions(unified);
    setLoadingTx(false);
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || u.full_name?.toLowerCase().includes(q)
      || u.email?.toLowerCase().includes(q)
      || u.phone?.includes(q)
      || u.id_number?.includes(q)
      || u.mpesa_account_code?.toLowerCase().includes(q);
    if (!matchSearch) return false;
    if (filter === 'active') return u.is_active;
    if (filter === 'disabled') return !u.is_active;
    if (filter === 'verified') return u.is_verified;
    if (filter === 'unverified') return !u.is_verified;
    if (filter === 'admins') return u.isAdminRole;
    return true;
  });

  const counts = {
    all: users.length,
    active: users.filter((u) => u.is_active).length,
    disabled: users.filter((u) => !u.is_active).length,
    verified: users.filter((u) => u.is_verified).length,
    unverified: users.filter((u) => !u.is_verified).length,
    admins: users.filter((u) => u.isAdminRole).length,
  };

  const saveProfile = async () => {
    if (!selected) return;
    setActionLoading(true);
    const updates: any = {
      full_name: editing.full_name,
      email: editing.email,
      phone: editing.phone,
      county: editing.county,
      sub_county: editing.sub_county,
      ward: editing.ward,
      address: editing.address,
      id_number: editing.id_number,
      date_of_birth: editing.date_of_birth || null,
      is_active: editing.is_active,
      is_verified: editing.is_verified,
      disable_reason: editing.is_active ? null : (editing.disable_reason || 'Disabled by admin'),
      mpesa_account_code: editing.mpesa_account_code,
    };
    const { error } = await supabase.from('profiles').update(updates).eq('user_id', selected.user_id);
    if (error) toast.error(error.message);
    else {
      toast.success('Profile updated');
      const { data: { user: admin } } = await supabase.auth.getUser();
      await supabase.from('audit_logs').insert({
        admin_id: admin?.id, user_id: selected.user_id,
        action: 'profile_edit', details: updates,
      });
      await load();
      setSelected(null);
    }
    setActionLoading(false);
  };

  const adjustWallet = async () => {
    if (!selected || !adjustAmount) return;
    const amt = Number(adjustAmount);
    if (!Number.isFinite(amt) || amt <= 0) { toast.error('Invalid amount'); return; }
    setActionLoading(true);
    const newBal = adjustType === 'credit' ? selected.balance + amt : Math.max(0, selected.balance - amt);
    const { data: existing } = await supabase.from('wallets').select('user_id').eq('user_id', selected.user_id).maybeSingle();
    const walletOp = existing
      ? supabase.from('wallets').update({ balance: newBal }).eq('user_id', selected.user_id)
      : supabase.from('wallets').insert({ user_id: selected.user_id, balance: newBal });
    const { error } = await walletOp;
    if (error) { toast.error(error.message); setActionLoading(false); return; }
    await supabase.from('wallet_transactions').insert({
      user_id: selected.user_id,
      type: adjustType === 'credit' ? 'credit' : 'debit',
      amount: amt,
      description: `Admin adjustment: ${adjustReason || 'Manual'}`,
      status: 'completed',
    });
    const { data: { user: admin } } = await supabase.auth.getUser();
    await supabase.from('audit_logs').insert({
      admin_id: admin?.id, user_id: selected.user_id,
      action: `wallet_${adjustType}`, details: { amount: amt, reason: adjustReason },
    });
    toast.success(`Wallet ${adjustType === 'credit' ? 'credited' : 'debited'}`);
    setAdjustOpen(false); setAdjustAmount(''); setAdjustReason('');
    await openUser({ ...selected, balance: newBal });
    await load();
    setActionLoading(false);
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selected) return;
    setActionLoading(true);
    const { data: { user: admin } } = await supabase.auth.getUser();
    const { error } = await supabase.from('admin_messages').insert({
      admin_id: admin!.id, user_id: selected.user_id,
      subject: messageSubject || null, message: messageText, type: 'admin_notice',
    });
    if (!error) {
      await supabase.from('notifications').insert({
        user_id: selected.user_id,
        title: messageSubject || 'Message from Admin',
        message: messageText, type: 'admin_message',
      });
      toast.success('Message sent');
      setMessageOpen(false); setMessageText(''); setMessageSubject('');
    } else toast.error(error.message);
    setActionLoading(false);
  };

  const toggleAdminRole = async () => {
    if (!selected) return;
    setActionLoading(true);
    if (selected.isAdminRole) {
      await supabase.from('user_roles').delete().eq('user_id', selected.user_id).eq('role', 'admin');
      toast.success('Admin role removed');
    } else {
      await supabase.from('user_roles').insert({ user_id: selected.user_id, role: 'admin' });
      toast.success('Promoted to admin');
    }
    await load();
    setSelected({ ...selected, isAdminRole: !selected.isAdminRole });
    setActionLoading(false);
  };

  const fmt = (n: number) => `KES ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

  return (
    <div className="space-y-5">
      <AdminSectionHeader
        title="User Management"
        description={`${users.length} registered users — full access, fully editable`}
        icon={Users}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, phone, ID, M-Pesa code…"
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {([
            ['all', 'All'], ['active', 'Active'], ['disabled', 'Disabled'],
            ['verified', 'Verified'], ['unverified', 'Unverified'], ['admins', 'Admins'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                filter === k
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              {label} <span className="opacity-60">({counts[k]})</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <AdminEmptyState icon={Users} title="No users match" />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {filtered.map((u) => (
              <button
                key={u.id}
                onClick={() => openUser(u)}
                className="w-full flex items-center gap-3 p-4 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="h-11 w-11 rounded-full bg-accent/10 text-accent flex items-center justify-center font-semibold text-sm shrink-0">
                  {(u.full_name || 'U').slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground truncate">{u.full_name || 'Unnamed'}</p>
                    {u.isAdminRole && <Badge variant="default" className="text-[10px] bg-destructive">Admin</Badge>}
                    {u.is_verified ? (
                      <Badge variant="secondary" className="text-[10px]">Verified</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">Unverified</Badge>
                    )}
                    {!u.is_active && <Badge variant="destructive" className="text-[10px]">Disabled</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.phone || '—'} • {u.email || 'no email'}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70 truncate">
                    ID: {u.id_number || '—'} • {u.county || '—'}{u.mpesa_account_code ? ` • ${u.mpesa_account_code}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground tabular-nums">{fmt(u.balance)}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(u.created_at), 'MMM d, yy')}</p>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* User detail sheet */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          {selected && (
            <>
              <SheetHeader className="p-5 border-b sticky top-0 bg-card z-10">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-accent/10 text-accent flex items-center justify-center font-bold shrink-0">
                    {(selected.full_name || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <SheetTitle className="text-left truncate">{selected.full_name || 'Unnamed'}</SheetTitle>
                    <p className="text-xs text-muted-foreground truncate">
                      {selected.email || 'no email'} • Joined {format(new Date(selected.created_at), 'MMM d, yyyy')}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selected.isAdminRole && <Badge className="text-[10px] bg-destructive">Admin</Badge>}
                      <Badge variant={selected.is_verified ? 'secondary' : 'outline'} className="text-[10px]">
                        {selected.is_verified ? 'Verified' : 'Unverified'}
                      </Badge>
                      <Badge variant={selected.is_active ? 'default' : 'destructive'} className="text-[10px]">
                        {selected.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <Tabs defaultValue="profile" className="p-5">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="profile" className="text-[11px]">Profile</TabsTrigger>
                  <TabsTrigger value="finance" className="text-[11px]">Finance</TabsTrigger>
                  <TabsTrigger value="transactions" className="text-[11px]">Activity</TabsTrigger>
                  <TabsTrigger value="groups" className="text-[11px]">Groups</TabsTrigger>
                  <TabsTrigger value="actions" className="text-[11px]">Actions</TabsTrigger>
                </TabsList>

                {/* PROFILE */}
                <TabsContent value="profile" className="space-y-4 mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field icon={Users} label="Full name" value={editing.full_name || ''} onChange={(v) => setEditing({ ...editing, full_name: v })} />
                    <Field icon={IdCard} label="ID number" value={editing.id_number || ''} onChange={(v) => setEditing({ ...editing, id_number: v })} />
                    <Field icon={Phone} label="Phone" value={editing.phone || ''} onChange={(v) => setEditing({ ...editing, phone: v })} />
                    <Field icon={Mail} label="Email" value={editing.email || ''} onChange={(v) => setEditing({ ...editing, email: v })} />
                    <Field icon={Calendar} label="Date of birth" type="date" value={editing.date_of_birth?.slice(0, 10) || ''} onChange={(v) => setEditing({ ...editing, date_of_birth: v })} />
                    <Field icon={Wallet} label="M-Pesa account code" value={editing.mpesa_account_code || ''} onChange={(v) => setEditing({ ...editing, mpesa_account_code: v })} />
                    <Field icon={MapPin} label="County" value={editing.county || ''} onChange={(v) => setEditing({ ...editing, county: v })} />
                    <Field icon={MapPin} label="Sub-county" value={editing.sub_county || ''} onChange={(v) => setEditing({ ...editing, sub_county: v })} />
                    <Field icon={MapPin} label="Ward" value={editing.ward || ''} onChange={(v) => setEditing({ ...editing, ward: v })} />
                    <Field icon={MapPin} label="Address" value={editing.address || ''} onChange={(v) => setEditing({ ...editing, address: v })} />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t">
                    <div>
                      <Label className="text-xs">Account status</Label>
                      <Select value={editing.is_active ? 'active' : 'disabled'} onValueChange={(v) => setEditing({ ...editing, is_active: v === 'active' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="disabled">Disabled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">KYC verification</Label>
                      <Select value={editing.is_verified ? 'verified' : 'unverified'} onValueChange={(v) => setEditing({ ...editing, is_verified: v === 'verified' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="unverified">Unverified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {!editing.is_active && (
                      <div className="sm:col-span-2">
                        <Label className="text-xs">Disable reason</Label>
                        <Input value={editing.disable_reason || ''} onChange={(e) => setEditing({ ...editing, disable_reason: e.target.value })} placeholder="Why is this account disabled?" />
                      </div>
                    )}
                  </div>

                  <Button onClick={saveProfile} disabled={actionLoading} className="w-full">
                    {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Save changes</>}
                  </Button>
                </TabsContent>

                {/* FINANCE */}
                <TabsContent value="finance" className="space-y-3 mt-4">
                  <Card className="p-4 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
                    <p className="text-xs text-muted-foreground">Wallet balance</p>
                    <p className="text-3xl font-bold text-foreground tabular-nums">{fmt(selected.balance)}</p>
                    <Button size="sm" variant="outline" className="mt-3" onClick={() => setAdjustOpen(true)}>
                      <Wallet size={14} /> Adjust balance
                    </Button>
                  </Card>

                  <div className="grid grid-cols-2 gap-2">
                    <StatBox label="Total deposits" value={fmt(stats.totalDeposits)} icon={Wallet} />
                    <StatBox label="Total withdrawals" value={fmt(stats.totalWithdrawals)} icon={Wallet} />
                    <StatBox label="Sent" value={fmt(stats.totalSent)} icon={Activity} />
                    <StatBox label="Received" value={fmt(stats.totalReceived)} icon={Activity} />
                    <StatBox label="Active loans" value={fmt(stats.activeLoans)} icon={FileText} />
                    <StatBox label="Total saved" value={fmt(stats.totalSaved)} icon={PiggyBank} />
                  </div>
                </TabsContent>

                {/* GROUPS */}
                <TabsContent value="groups" className="space-y-3 mt-4">
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <StatBox label="Chamas" value={String(stats.chamaCount)} icon={Users} />
                    <StatBox label="Harambees created" value={String(stats.harambeeCount)} icon={Activity} />
                  </div>
                  {chamas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Not a member of any chama</p>
                  ) : (
                    <div className="space-y-2">
                      {chamas.map((c: any) => (
                        <Card key={c.group_id} className="p-3 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-sm">{c.chama_groups?.name || 'Group'}</p>
                            <p className="text-xs text-muted-foreground capitalize">{c.role}</p>
                          </div>
                          <Badge variant="outline" className="text-[10px]">{c.is_active ? 'Active' : 'Inactive'}</Badge>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* ACTIONS */}
                <TabsContent value="actions" className="space-y-2 mt-4">
                  <Button variant="outline" className="w-full justify-start" onClick={() => setMessageOpen(true)}>
                    <MessageSquare size={16} /> Send message / notification
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={toggleAdminRole} disabled={actionLoading}>
                    <Shield size={16} /> {selected.isAdminRole ? 'Revoke admin role' : 'Promote to admin'}
                  </Button>
                  <Button
                    variant={selected.is_active ? 'destructive' : 'default'}
                    className="w-full justify-start"
                    onClick={() => { setEditing({ ...editing, is_active: !selected.is_active }); }}
                  >
                    {selected.is_active ? <><Ban size={16} /> Mark for disable (Save in Profile)</> : <><CheckCircle2 size={16} /> Mark for enable (Save in Profile)</>}
                  </Button>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Message dialog */}
      <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Message {selected?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={messageSubject} onChange={(e) => setMessageSubject(e.target.value)} placeholder="Subject (optional)" />
            <Textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type your message…" rows={5} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageOpen(false)}>Cancel</Button>
            <Button onClick={sendMessage} disabled={actionLoading || !messageText.trim()}>Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wallet adjust dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust wallet — {selected?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Action</Label>
              <Select value={adjustType} onValueChange={(v) => setAdjustType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="credit">Credit (add funds)</SelectItem>
                  <SelectItem value="debit">Debit (remove funds)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Amount (KES)</Label>
              <Input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label className="text-xs">Reason (logged to audit)</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. M-Pesa reconciliation" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>Cancel</Button>
            <Button onClick={adjustWallet} disabled={actionLoading || !adjustAmount}>
              {actionLoading ? <Loader2 className="animate-spin" size={14} /> : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  icon: Icon, label, value, onChange, type = 'text',
}: { icon: any; label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <Label className="text-xs flex items-center gap-1.5 text-muted-foreground">
        <Icon size={12} /> {label}
      </Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function StatBox({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon size={12} />
        <p className="text-[10px] uppercase tracking-wider font-semibold">{label}</p>
      </div>
      <p className="text-sm font-bold tabular-nums truncate">{value}</p>
    </Card>
  );
}
