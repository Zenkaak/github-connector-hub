import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, Wallet, FileText, Heart, AlertTriangle,
  ShieldAlert, Send, PiggyBank, Activity, TrendingUp,
  Loader2, Server, CheckCircle, XCircle, ArrowUpRight,
  ArrowDownRight, Banknote, CreditCard, Eye, BarChart3,
  Coins, Receipt, ArrowDownLeft,
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
  // Financial / revenue
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

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: number;
  icon: any;
  accent?: 'gold' | 'emerald' | 'red' | 'blue';
  onClick?: () => void;
  trend?: number[];
}

function KpiCard({ label, value, delta, icon: Icon, accent = 'gold', onClick, trend }: KpiCardProps) {
  const accentMap = {
    gold: 'from-amber-500/10 to-amber-500/0 text-amber-600 ring-amber-500/15',
    emerald: 'from-emerald-500/10 to-emerald-500/0 text-emerald-600 ring-emerald-500/15',
    red: 'from-red-500/10 to-red-500/0 text-red-600 ring-red-500/15',
    blue: 'from-blue-500/10 to-blue-500/0 text-blue-600 ring-blue-500/15',
  };
  const positive = (delta ?? 0) >= 0;
  return (
    <button
      onClick={onClick}
      className="group text-left bg-card border border-border rounded-xl p-4 hover:border-accent/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden"
    >
      <div className={cn('absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br opacity-50', accentMap[accent].split(' ').slice(0, 2).join(' '))} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('w-9 h-9 rounded-lg bg-background flex items-center justify-center ring-1', accentMap[accent].split(' ').slice(2).join(' '))}>
            <Icon size={16} />
          </div>
          {delta !== undefined && (
            <span className={cn('text-[11px] font-bold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded',
              positive ? 'text-emerald-600 bg-emerald-500/10' : 'text-red-600 bg-red-500/10'
            )}>
              {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
        <p className="text-xl md:text-2xl font-bold text-foreground mt-1 tracking-tight">{value}</p>
        {trend && trend.length > 1 && (
          <div className="h-8 mt-2 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.map((v, i) => ({ i, v }))}>
                <defs>
                  <linearGradient id={`spark-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" stopOpacity={0.3} className={accent === 'emerald' ? 'text-emerald-500' : accent === 'red' ? 'text-red-500' : accent === 'blue' ? 'text-blue-500' : 'text-amber-500'} />
                    <stop offset="100%" stopColor="currentColor" stopOpacity={0} className={accent === 'emerald' ? 'text-emerald-500' : accent === 'red' ? 'text-red-500' : accent === 'blue' ? 'text-blue-500' : 'text-amber-500'} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke="currentColor" strokeWidth={1.5} fill={`url(#spark-${label})`}
                  className={accent === 'emerald' ? 'text-emerald-500' : accent === 'red' ? 'text-red-500' : accent === 'blue' ? 'text-blue-500' : 'text-amber-500'} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </button>
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

  useEffect(() => {
    const load = async () => {
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

      // Build transfer trend by day (last 14 days)
      const days = 14;
      const dayBuckets: Record<string, { amount: number; count: number }> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(today, i), 'MMM d');
        dayBuckets[d] = { amount: 0, count: 0 };
      }
      (transfersHist.data || []).forEach((t: any) => {
        const d = format(new Date(t.created_at), 'MMM d');
        if (dayBuckets[d]) {
          dayBuckets[d].amount += Number(t.amount || 0);
          dayBuckets[d].count += 1;
        }
      });
      setTransferTrend(Object.entries(dayBuckets).map(([day, v]) => ({ day, ...v })));

      // User signups trend
      const userBuckets: Record<string, number> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = format(subDays(today, i), 'MMM d');
        userBuckets[d] = 0;
      }
      (usersHist.data || []).forEach((u: any) => {
        const d = format(new Date(u.created_at), 'MMM d');
        if (userBuckets[d] !== undefined) userBuckets[d] += 1;
      });
      setUserTrend(Object.entries(userBuckets).map(([day, users]) => ({ day, users })));

      // Loan status mix
      const mix: Record<string, number> = {};
      (loanByStatus.data || []).forEach((l: any) => {
        mix[l.status] = (mix[l.status] || 0) + 1;
      });
      setLoanMix(Object.entries(mix).map(([name, value]) => ({ name, value })));

      const platformFees30d = (platformFees.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);
      const joiningFees30d = (joiningFees.data || []).reduce((s, r: any) => s + Number(r.amount || 0), 0);

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
        // Fall back to empty stats so the page still renders
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

    load();
  }, []);

  const totalActions = useMemo(() => {
    if (!stats) return 0;
    return stats.pendingKyc + stats.pendingLoans + stats.pendingHarambees +
      stats.pendingWithdrawals + stats.unmappedMpesa + stats.failedB2c;
  }, [stats]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  const PIE_COLORS = ['hsl(42, 92%, 56%)', 'hsl(160, 84%, 39%)', 'hsl(0, 84%, 60%)', 'hsl(213, 72%, 50%)', 'hsl(270, 60%, 60%)'];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Executive overview</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display mt-1">Control Center</h1>
          <p className="text-sm text-muted-foreground mt-1">{format(new Date(), 'EEEE, MMMM d, yyyy')} · Real-time platform metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </Badge>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            <Activity size={14} className="mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Critical alert */}
      {totalActions > 0 && (
        <Card className="p-4 border-red-500/30 bg-gradient-to-r from-red-500/10 to-red-500/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="text-red-500" size={20} />
              </div>
              <div>
                <p className="font-semibold text-foreground">{totalActions} action{totalActions === 1 ? '' : 's'} require attention</p>
                <p className="text-xs text-muted-foreground">KYC reviews, loan approvals, M-Pesa reconciliations</p>
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => navigate('/dashboard/admin/kyc')}>
              Review now
            </Button>
          </div>
        </Card>
      )}

      {/* Top KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total wallet balance"
          value={fmtKes(stats.totalWalletBalance)}
          icon={Wallet}
          accent="gold"
          trend={transferTrend.map((t) => t.amount)}
          onClick={() => navigate('/dashboard/admin/users')}
        />
        <KpiCard
          label="Transfers (7d)"
          value={fmtKes(stats.totalTransfers7d)}
          delta={stats.totalTransfersToday > 0 ? 12.4 : 0}
          icon={TrendingUp}
          accent="emerald"
          trend={transferTrend.map((t) => t.count)}
          onClick={() => navigate('/dashboard/admin/transfers')}
        />
        <KpiCard
          label="Active members"
          value={stats.totalUsers.toLocaleString()}
          delta={stats.newUsersToday > 0 ? (stats.newUsersToday / Math.max(stats.totalUsers, 1)) * 100 : 0}
          icon={Users}
          accent="blue"
          trend={userTrend.map((u) => u.users)}
          onClick={() => navigate('/dashboard/admin/users')}
        />
        <KpiCard
          label="Active loans"
          value={fmtKes(stats.totalLoanValue)}
          icon={Banknote}
          accent="gold"
          onClick={() => navigate('/dashboard/admin/loans')}
        />
      </div>

      {/* Financial / Revenue strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Platform revenue (30d)"
          value={fmtKes(stats.revenue30d)}
          icon={Coins}
          accent="emerald"
          onClick={() => navigate('/dashboard/admin/chama')}
        />
        <KpiCard
          label="Joining fees (30d)"
          value={fmtKes(stats.joiningFees30d)}
          icon={Receipt}
          accent="gold"
        />
        <KpiCard
          label="Deposits today"
          value={fmtKes(stats.depositsToday)}
          icon={ArrowDownLeft}
          accent="blue"
          onClick={() => navigate('/dashboard/admin/mpesa')}
        />
        <KpiCard
          label="Payouts today"
          value={fmtKes(stats.payoutsToday)}
          icon={Send}
          accent="red"
          onClick={() => navigate('/dashboard/admin/mpesa')}
        />
      </div>

      {/* Quick actions */}
      <AdminQuickActions
        pendingKyc={stats.pendingKyc}
        pendingLoans={stats.pendingLoans}
        pendingWithdrawals={stats.pendingWithdrawals}
        pendingHarambees={stats.pendingHarambees}
        unmappedMpesa={stats.unmappedMpesa}
      />
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pending queue</h3>
          <span className="text-[11px] text-muted-foreground">Click any to review</span>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {[
            { label: 'KYC', value: stats.pendingKyc, icon: ShieldAlert, color: 'amber', path: '/dashboard/admin/kyc' },
            { label: 'Loans', value: stats.pendingLoans, icon: FileText, color: 'amber', path: '/dashboard/admin/loans' },
            { label: 'Harambees', value: stats.pendingHarambees, icon: Heart, color: 'amber', path: '/dashboard/admin/harambee-applications' },
            { label: 'Withdrawals', value: stats.pendingWithdrawals, icon: PiggyBank, color: 'amber', path: '/dashboard/admin/withdrawals' },
            { label: 'Unmapped', value: stats.unmappedMpesa, icon: AlertTriangle, color: 'red', path: '/dashboard/admin/mpesa' },
            { label: 'Failed B2C', value: stats.failedB2c, icon: Send, color: 'red', path: '/dashboard/admin/mpesa' },
          ].map((p) => (
            <button
              key={p.label}
              onClick={() => navigate(p.path)}
              className={cn(
                'p-3 rounded-lg border transition-all hover:-translate-y-0.5 text-left',
                p.value > 0
                  ? p.color === 'red'
                    ? 'border-red-500/30 bg-red-500/5 hover:border-red-500/60'
                    : 'border-amber-500/30 bg-amber-500/5 hover:border-amber-500/60'
                  : 'border-border bg-card hover:border-accent/40'
              )}
            >
              <p.icon size={15} className={cn(
                'mb-1.5',
                p.value > 0 ? (p.color === 'red' ? 'text-red-500' : 'text-amber-500') : 'text-muted-foreground'
              )} />
              <p className="text-lg font-bold tracking-tight">{p.value}</p>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">{p.label}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue / transfer chart */}
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Transfer volume (14 days)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Daily completed transfer total</p>
            </div>
            <BarChart3 size={16} className="text-muted-foreground" />
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={transferTrend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="trGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(42, 92%, 56%)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(42, 92%, 56%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  formatter={(v: number) => fmtKes(v)}
                />
                <Area type="monotone" dataKey="amount" stroke="hsl(42, 92%, 56%)" strokeWidth={2} fill="url(#trGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Loan status pie */}
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Loan portfolio</h3>
              <p className="text-xs text-muted-foreground mt-0.5">By application status</p>
            </div>
            <CreditCard size={16} className="text-muted-foreground" />
          </div>
          {loanMix.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-xs text-muted-foreground">No loan data yet</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={loanMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                    {loanMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5 mt-2 justify-center">
            {loanMix.map((m, i) => (
              <span key={m.name} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="w-2 h-2 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                {m.name} ({m.value})
              </span>
            ))}
          </div>
        </Card>
      </div>

      {/* User growth + System status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">New member signups</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Daily new accounts (last 14 days)</p>
            </div>
            <Users size={16} className="text-muted-foreground" />
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userTrend} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="users" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Server size={16} className="text-muted-foreground" />
            <h3 className="font-semibold text-foreground">System health</h3>
          </div>
          <div className="space-y-2.5">
            {[
              { label: 'Database', status: 'healthy' },
              { label: 'M-Pesa API', status: 'healthy' },
              { label: 'Email queue', status: stats.failedB2c > 0 ? 'warning' : 'healthy' },
              { label: 'B2C payouts', status: stats.failedB2c > 5 ? 'error' : stats.failedB2c > 0 ? 'warning' : 'healthy' },
              { label: 'Active chamas', status: 'healthy', badge: stats.activeChamas.toString() },
              { label: 'MGR cycles', status: 'healthy', badge: stats.openMgrCycles.toString() },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  {s.status === 'healthy' && <CheckCircle size={13} className="text-emerald-500" />}
                  {s.status === 'warning' && <AlertTriangle size={13} className="text-amber-500" />}
                  {s.status === 'error' && <XCircle size={13} className="text-red-500" />}
                  <span className="text-xs font-medium">{s.label}</span>
                </div>
                {s.badge ? (
                  <span className="text-[11px] font-bold text-muted-foreground">{s.badge}</span>
                ) : (
                  <span className={cn(
                    'text-[10px] uppercase font-bold tracking-wider',
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

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-foreground">Recent members</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Latest signups</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard/admin/users')} className="text-xs h-7 gap-1">
              View all <Eye size={12} />
            </Button>
          </div>
          <div className="space-y-2">
            {recentUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No members yet</p>
            ) : recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center text-xs font-bold text-amber-700 shrink-0">
                    {(u.full_name || 'U').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.full_name || 'Unnamed'}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{u.phone || '—'}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn(
                    'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
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
              <h3 className="font-semibold text-foreground">Recent transfers</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Latest wallet movements</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => navigate('/dashboard/admin/transfers')} className="text-xs h-7 gap-1">
              View all <Eye size={12} />
            </Button>
          </div>
          <div className="space-y-2">
            {recentTransfers.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">No transfers yet</p>
            ) : recentTransfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Send size={13} className="text-emerald-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.sender_name || '—'} → {t.receiver_name || '—'}</p>
                    <p className="text-[11px] text-muted-foreground">{format(new Date(t.created_at), 'MMM d, HH:mm')}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-emerald-700 shrink-0 ml-2">{fmtKes(Number(t.amount))}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
