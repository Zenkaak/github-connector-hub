import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, Wallet, FileText, Heart, AlertTriangle,
  ShieldAlert, Send, PiggyBank, Activity, TrendingUp,
  Loader2, Server, CheckCircle, XCircle,
  Banknote, CreditCard, Eye, BarChart3,
  Coins, Receipt, ArrowDownLeft, RefreshCw,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, subDays, startOfDay } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { AdminQuickActions } from './AdminQuickActions';
import { cn } from '@/lib/utils';

interface Stats {
  totalUsers: number;
  newUsersToday: number;
  pendingKyc: number;
  pendingLoans: number;
  pendingHarambees: number;
  pendingWithdrawals: number;
  unmappedMpesa: number;
  failedB2c: number;
  totalWalletBalance: number;
  totalTransfersToday: number;
  totalTransfers7d: number;
  activeChamas: number;
  openMgrCycles: number;
  totalLoansActive: number;
  totalLoanValue: number;
  platformFees30d: number;
  joiningFees30d: number;
  revenue30d: number;
  depositsToday: number;
  payoutsToday: number;
}

const fmtKes = (n: number) => `KES ${Math.round(n).toLocaleString()}`;
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: any;
  color: 'amber' | 'emerald' | 'red' | 'blue' | 'violet';
  onClick?: () => void;
  trend?: number[];
  alert?: boolean;
}

const colorMap = {
  amber:   { bg: 'bg-amber-500/10',   text: 'text-amber-600',   border: 'hover:border-amber-500/30',   dot: 'bg-amber-500',   stroke: 'hsl(42,92%,56%)' },
  emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-600', border: 'hover:border-emerald-500/30', dot: 'bg-emerald-500', stroke: 'hsl(160,84%,39%)' },
  red:     { bg: 'bg-red-500/10',     text: 'text-red-600',     border: 'hover:border-red-500/30',     dot: 'bg-red-500',     stroke: 'hsl(0,84%,60%)' },
  blue:    { bg: 'bg-blue-500/10',    text: 'text-blue-600',    border: 'hover:border-blue-500/30',    dot: 'bg-blue-500',    stroke: 'hsl(213,72%,50%)' },
  violet:  { bg: 'bg-violet-500/10',  text: 'text-violet-600',  border: 'hover:border-violet-500/30',  dot: 'bg-violet-500',  stroke: 'hsl(270,60%,60%)' },
};

function MetricCard({ label, value, sub, icon: Icon, color, onClick, trend, alert }: MetricCardProps) {
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      className={cn(
        'group text-left bg-card border rounded-xl p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md relative overflow-hidden',
        alert ? 'border-red-500/30 bg-red-500/5' : `border-border ${c.border}`
      )}
    >
      <div className={cn('absolute top-0 right-0 w-20 h-20 rounded-bl-full opacity-40', c.bg)} />
      <div className="relative">
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-3', c.bg)}>
          <Icon size={15} className={c.text} />
        </div>
        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-0.5">{label}</p>
        <p className="text-xl font-bold text-foreground tracking-tight">{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
        {trend && trend.length > 1 && (
          <div className="h-7 mt-2 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.map((v, i) => ({ i, v }))}>
                <defs>
                  <linearGradient id={`sg-${label.replace(/\s/g,'')}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.stroke} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={c.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={c.stroke} strokeWidth={1.5} fill={`url(#sg-${label.replace(/\s/g,'')})`} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </button>
  );
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="flex items-end gap-3 mb-3">
      <div>
        <h2 className="text-sm font-bold text-foreground tracking-tight">{title}</h2>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
      <div className="flex-1 h-px bg-border mb-1" />
    </div>
  );
}

export function AdminOverviewModule() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<any[]>([]);
  const [transferTrend, setTransferTrend] = useState<{ day: string; amount: number; count: number }[]>([]);
  const [userTrend, setUserTrend] = useState<{ day: string; users: number }[]>([]);
  const [loanMix, setLoanMix] = useState<{ name: string; value: number }[]>([]);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const today = startOfDay(new Date());
      const todayIso = today.toISOString();
      const sevenDaysAgo = subDays(today, 7).toISOString();
      const thirtyDaysAgo = subDays(today, 30).toISOString();

      const [
        usersTotal, usersToday, kyc, loans, harambees, withdrawals,
        unmapped, b2cFailed, walletSum, transfersToday, transfers7d, chamas, mgrOpen,
        loansActive, users5, transfers5, transfersHist, usersHist, loanByStatus,
        platformFees, joiningFees, depositsTodayQ, payoutsTodayQ,
      ] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayIso),
        supabase.from('kyc_documents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('loan_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('harambee_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('chama_withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('mpesa_unmapped_payments').select('id', { count: 'exact', head: true }).eq('resolved', false),
        supabase.from('mpesa_b2c_requests').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('wallets').select('balance'),
        supabase.from('wallet_transfers').select('amount').gte('created_at', todayIso).eq('status', 'completed'),
        supabase.from('wallet_transfers').select('amount').gte('created_at', sevenDaysAgo).eq('status', 'completed'),
        supabase.from('chama_groups').select('id', { count: 'exact', head: true }),
        supabase.from('chama_mgr_cycles').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('loan_applications').select('amount').eq('status', 'approved'),
        supabase.from('profiles').select('id, full_name, phone, created_at, is_verified').order('created_at', { ascending: false }).limit(6),
        supabase.from('wallet_transfers').select('id, sender_name, receiver_name, amount, status, created_at').order('created_at', { ascending: false }).limit(6),
        supabase.from('wallet_transfers').select('amount, created_at').gte('created_at', thirtyDaysAgo).eq('status', 'completed').limit(2000),
        supabase.from('profiles').select('created_at').gte('created_at', thirtyDaysAgo).limit(2000),
        supabase.from('loan_applications').select('status'),
        supabase.from('chama_platform_fees').select('amount').gte('created_at', thirtyDaysAgo),
        supabase.from('chama_joining_fees').select('amount').gte('created_at', thirtyDaysAgo),
        supabase.from('mpesa_c2b_transactions').select('trans_amount').gte('created_at', todayIso),
        supabase.from('mpesa_b2c_requests').select('amount').gte('created_at', todayIso).eq('status', 'completed'),
      ]);

      const days = 14;
      const dayBuckets: Record<string, { amount: number; count: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(today, i), 'MMM d');
        dayBuckets[d] = { amount: 0, count: 0 };
      }
      (transfersHist.data || []).forEach((t: any) => {
        const d = format(new Date(t.created_at), 'MMM d');
        if (dayBuckets[d]) { dayBuckets[d].amount += Number(t.amount || 0); dayBuckets[d].count += 1; }
      });
      setTransferTrend(Object.entries(dayBuckets).map(([day, v]) => ({ day, ...v })));

      const userBuckets: Record<string, number> = {};
      for (let i = days - 1; i >= 0; i--) { userBuckets[format(subDays(today, i), 'MMM d')] = 0; }
      (usersHist.data || []).forEach((u: any) => {
        const d = format(new Date(u.created_at), 'MMM d');
        if (userBuckets[d] !== undefined) userBuckets[d] += 1;
      });
      setUserTrend(Object.entries(userBuckets).map(([day, users]) => ({ day, users })));

      const mix: Record<string, number> = {};
      (loanByStatus.data || []).forEach((l: any) => { mix[l.status] = (mix[l.status] || 0) + 1; });
      setLoanMix(Object.entries(mix).map(([name, value]) => ({ name, value })));

      const platformFees30d = (platformFees.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
      const joiningFees30d  = (joiningFees.data  || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

      setStats({
        totalUsers: usersTotal.count || 0,
        newUsersToday: usersToday.count || 0,
        pendingKyc: kyc.count || 0,
        pendingLoans: loans.count || 0,
        pendingHarambees: harambees.count || 0,
        pendingWithdrawals: withdrawals.count || 0,
        unmappedMpesa: unmapped.count || 0,
        failedB2c: b2cFailed.count || 0,
        totalWalletBalance: (walletSum.data || []).reduce((s, w: any) => s + Number(w.balance || 0), 0),
        totalTransfersToday: (transfersToday.data || []).reduce((s, t: any) => s + Number(t.amount || 0), 0),
        totalTransfers7d: (transfers7d.data || []).reduce((s, t: any) => s + Number(t.amount || 0), 0),
        activeChamas: chamas.count || 0,
        openMgrCycles: mgrOpen.count || 0,
        totalLoansActive: loansActive.data?.length || 0,
        totalLoanValue: (loansActive.data || []).reduce((s: number, l: any) => s + Number(l.amount || 0), 0),
        platformFees30d,
        joiningFees30d,
        revenue30d: platformFees30d + joiningFees30d,
        depositsToday: (depositsTodayQ.data || []).reduce((s, r: any) => s + Number(r.trans_amount || 0), 0),
        payoutsToday: (payoutsTodayQ.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0),
      });

      setRecentUsers(users5.data || []);
      setRecentTransfers(transfers5.data || []);
    } catch (err) {
      console.error('[AdminOverview] load failed:', err);
      setStats({
        totalUsers: 0, newUsersToday: 0, pendingKyc: 0, pendingLoans: 0,
        pendingHarambees: 0, pendingWithdrawals: 0, unmappedMpesa: 0, failedB2c: 0,
        totalWalletBalance: 0, totalTransfersToday: 0, totalTransfers7d: 0,
        activeChamas: 0, openMgrCycles: 0, totalLoansActive: 0, totalLoanValue: 0,
        platformFees30d: 0, joiningFees30d: 0, revenue30d: 0,
        depositsToday: 0, payoutsToday: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalActions = useMemo(() => {
    if (!stats) return 0;
    return stats.pendingKyc + stats.pendingLoans + stats.pendingHarambees +
      stats.pendingWithdrawals + stats.unmappedMpesa + stats.failedB2c;
  }, [stats]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="animate-spin text-accent" size={28} />
      </div>
    );
  }

  const PIE_COLORS = ['hsl(42,92%,56%)', 'hsl(160,84%,39%)', 'hsl(0,84%,60%)', 'hsl(213,72%,50%)', 'hsl(270,60%,60%)'];

  return (
    <div className="p-5 sm:p-7 space-y-8 max-w-[1400px] mx-auto">

      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">Executive overview</p>
          <h1 className="text-2xl font-bold tracking-tight mt-0.5">Control Center</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">{format(new Date(), "EEEE, MMMM d, yyyy")} · Real-time</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/5 text-[11px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </Badge>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={load}>
            <RefreshCw size={13} /> Refresh
          </Button>
        </div>
      </div>

      {/* Alert banner */}
      {totalActions > 0 && (
        <div className="flex items-center gap-4 p-4 rounded-xl border border-red-500/25 bg-red-500/5">
          <div className="w-9 h-9 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-500" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-foreground">{totalActions} item{totalActions !== 1 ? 's' : ''} need attention</p>
            <p className="text-[11px] text-muted-foreground">KYC reviews, loan approvals, M-Pesa reconciliations</p>
          </div>
          <Button size="sm" variant="destructive" className="shrink-0 h-8 text-xs" onClick={() => navigate('/dashboard/admin/kyc')}>
            Review now
          </Button>
        </div>
      )}

      {/* Core metrics */}
      <div>
        <SectionHeader title="Platform metrics" sub="Live balances and activity" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Wallet balance"
            value={fmtKes(stats.totalWalletBalance)}
            icon={Wallet}
            color="amber"
            trend={transferTrend.map((t) => t.amount)}
            onClick={() => navigate('/dashboard/admin/users')}
          />
          <MetricCard
            label="Transfers (7d)"
            value={fmtKes(stats.totalTransfers7d)}
            sub={`${fmtKes(stats.totalTransfersToday)} today`}
            icon={TrendingUp}
            color="emerald"
            trend={transferTrend.map((t) => t.count)}
            onClick={() => navigate('/dashboard/admin/transfers')}
          />
          <MetricCard
            label="Total members"
            value={stats.totalUsers.toLocaleString()}
            sub={`+${stats.newUsersToday} today`}
            icon={Users}
            color="blue"
            trend={userTrend.map((u) => u.users)}
            onClick={() => navigate('/dashboard/admin/users')}
          />
          <MetricCard
            label="Loan book"
            value={fmtKes(stats.totalLoanValue)}
            sub={`${stats.totalLoansActive} active loans`}
            icon={Banknote}
            color="violet"
            onClick={() => navigate('/dashboard/admin/loans')}
          />
        </div>
      </div>

      {/* Revenue */}
      <div>
        <SectionHeader title="Revenue" sub="Last 30 days" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard label="Total revenue" value={fmtKes(stats.revenue30d)} icon={Coins} color="emerald" onClick={() => navigate('/dashboard/admin/chama')} />
          <MetricCard label="Joining fees" value={fmtKes(stats.joiningFees30d)} icon={Receipt} color="amber" />
          <MetricCard label="Deposits today" value={fmtKes(stats.depositsToday)} icon={ArrowDownLeft} color="blue" onClick={() => navigate('/dashboard/admin/mpesa')} />
          <MetricCard label="Payouts today" value={fmtKes(stats.payoutsToday)} icon={Send} color="red" onClick={() => navigate('/dashboard/admin/mpesa')} />
        </div>
      </div>

      {/* Pending queue */}
      <div>
        <SectionHeader title="Action queue" sub="Items requiring review" />
        <AdminQuickActions
          pendingKyc={stats.pendingKyc}
          pendingLoans={stats.pendingLoans}
          pendingWithdrawals={stats.pendingWithdrawals}
          pendingHarambees={stats.pendingHarambees}
          unmappedMpesa={stats.unmappedMpesa}
        />
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mt-3">
          {[
            { label: 'KYC',        value: stats.pendingKyc,        icon: ShieldAlert, urgent: false, path: '/dashboard/admin/kyc' },
            { label: 'Loans',      value: stats.pendingLoans,      icon: FileText,    urgent: false, path: '/dashboard/admin/loans' },
            { label: 'Harambees',  value: stats.pendingHarambees,  icon: Heart,       urgent: false, path: '/dashboard/admin/harambee-applications' },
            { label: 'Withdrawals',value: stats.pendingWithdrawals,icon: PiggyBank,   urgent: false, path: '/dashboard/admin/withdrawals' },
            { label: 'Unmapped',   value: stats.unmappedMpesa,     icon: AlertTriangle, urgent: true, path: '/dashboard/admin/mpesa' },
            { label: 'Failed B2C', value: stats.failedB2c,         icon: Send,        urgent: true, path: '/dashboard/admin/mpesa' },
          ].map((p) => (
            <button
              key={p.label}
              onClick={() => navigate(p.path)}
              className={cn(
                'p-3 rounded-xl border text-left transition-all hover:-translate-y-0.5 hover:shadow-sm',
                p.value > 0
                  ? p.urgent
                    ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/50'
                    : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50'
                  : 'border-border bg-card hover:border-accent/30'
              )}
            >
              <p.icon size={14} className={cn('mb-1.5', p.value > 0 ? (p.urgent ? 'text-red-500' : 'text-amber-500') : 'text-muted-foreground')} />
              <p className="text-lg font-bold leading-none mb-1">{p.value}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider leading-tight">{p.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div>
        <SectionHeader title="Trends" sub="14-day activity" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-sm text-foreground">Transfer volume</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Daily completed transfer total (14 days)</p>
              </div>
              <BarChart3 size={14} className="text-muted-foreground" />
            </div>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={transferTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(42,92%,56%)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(42,92%,56%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(v: number) => [fmtKes(v), 'Volume']}
                  />
                  <Area type="monotone" dataKey="amount" stroke="hsl(42,92%,56%)" strokeWidth={2} fill="url(#trGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-sm text-foreground">Loan portfolio</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">By application status</p>
              </div>
              <CreditCard size={14} className="text-muted-foreground" />
            </div>
            {loanMix.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-xs text-muted-foreground">No loan data</div>
            ) : (
              <>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={loanMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={44} outerRadius={70} paddingAngle={2}>
                        {loanMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center">
                  {loanMix.map((m, i) => (
                    <span key={m.name} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {m.name} ({m.value})
                    </span>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-sm text-foreground">New member signups</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Daily new accounts (14 days)</p>
              </div>
              <Users size={14} className="text-muted-foreground" />
            </div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userTrend} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} formatter={(v: number) => [v, 'Signups']} />
                  <Bar dataKey="users" fill="hsl(160,84%,39%)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Server size={14} className="text-muted-foreground" />
              <p className="font-semibold text-sm text-foreground">System health</p>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Database',     status: 'healthy' },
                { label: 'M-Pesa API',   status: 'healthy' },
                { label: 'Email queue',  status: stats.failedB2c > 0 ? 'warning' : 'healthy' },
                { label: 'B2C payouts',  status: stats.failedB2c > 5 ? 'error' : stats.failedB2c > 0 ? 'warning' : 'healthy' },
                { label: 'Chamas',       status: 'healthy', badge: stats.activeChamas.toString() },
                { label: 'MGR cycles',   status: 'healthy', badge: stats.openMgrCycles.toString() },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-border/60 last:border-0">
                  <div className="flex items-center gap-2">
                    {s.status === 'healthy' && <CheckCircle size={12} className="text-emerald-500 shrink-0" />}
                    {s.status === 'warning' && <AlertTriangle size={12} className="text-amber-500 shrink-0" />}
                    {s.status === 'error' && <XCircle size={12} className="text-red-500 shrink-0" />}
                    <span className="text-[12px] font-medium">{s.label}</span>
                  </div>
                  {s.badge ? (
                    <span className="text-[11px] font-bold text-muted-foreground">{s.badge}</span>
                  ) : (
                    <span className={cn('text-[10px] uppercase font-bold tracking-wider',
                      s.status === 'healthy' && 'text-emerald-600',
                      s.status === 'warning' && 'text-amber-600',
                      s.status === 'error' && 'text-red-600',
                    )}>{s.status}</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent activity */}
      <div>
        <SectionHeader title="Recent activity" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-sm text-foreground">Recent members</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Latest signups</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard/admin/users')} className="text-[11px] h-7 gap-1 px-2">
                View all <Eye size={11} />
              </Button>
            </div>
            <div className="space-y-1">
              {recentUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No members yet</p>
              ) : recentUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center text-[11px] font-bold text-amber-700 shrink-0">
                      {(u.full_name || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate">{u.full_name || 'Unnamed'}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{u.phone || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                      u.is_verified ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                    )}>
                      {u.is_verified ? 'Verified' : 'Pending'}
                    </span>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(u.created_at), 'MMM d')}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-sm text-foreground">Recent transfers</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Latest wallet movements</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard/admin/transfers')} className="text-[11px] h-7 gap-1 px-2">
                View all <Eye size={11} />
              </Button>
            </div>
            <div className="space-y-1">
              {recentTransfers.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No transfers yet</p>
              ) : recentTransfers.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Send size={12} className="text-emerald-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium truncate">{t.sender_name || '—'} → {t.receiver_name || '—'}</p>
                      <p className="text-[11px] text-muted-foreground">{format(new Date(t.created_at), 'MMM d, HH:mm')}</p>
                    </div>
                  </div>
                  <p className="text-[13px] font-bold text-emerald-700 shrink-0 ml-2">{fmtKes(Number(t.amount))}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
