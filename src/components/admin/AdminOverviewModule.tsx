import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, Wallet, FileText, Heart, AlertTriangle,
  ShieldAlert, Send, PiggyBank, Activity, TrendingUp,
  Loader2, CheckCircle, Banknote, CreditCard,
  Coins, Receipt, ArrowDownLeft, RefreshCw, ArrowUpRight,
  ArrowDownRight, ChevronRight, Clock, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, subDays, startOfDay } from 'date-fns';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid,
} from 'recharts';
import { cn } from '@/lib/utils';

interface Stats {
  totalUsers: number; newUsersToday: number; pendingKyc: number;
  pendingLoans: number; pendingHarambees: number; pendingWithdrawals: number;
  unmappedMpesa: number; failedB2c: number; totalWalletBalance: number;
  totalTransfersToday: number; totalTransfers7d: number; activeChamas: number;
  openMgrCycles: number; totalLoansActive: number; totalLoanValue: number;
  platformFees30d: number; joiningFees30d: number; revenue30d: number;
  depositsToday: number; payoutsToday: number;
}

const fmtKes = (n: number) => `KES ${Math.round(n).toLocaleString('en-KE')}`;
const fmtKesCompact = (n: number) => {
  if (n >= 1_000_000) return `KES ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `KES ${(n / 1_000).toFixed(1)}K`;
  return `KES ${Math.round(n).toLocaleString()}`;
};
const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
};

const PIE_COLORS = ['hsl(42,92%,56%)', 'hsl(213,72%,40%)', 'hsl(156,72%,38%)', 'hsl(213,40%,55%)', 'hsl(213,30%,72%)'];

const CHART_TICK_COLOR = '#94a3b8';
const CHART_GRID_COLOR = '#e2e8f0';
const customTooltipStyle = {
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  fontSize: '11px',
  color: '#334155',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

function Divider() {
  return <div className="h-px bg-border" />;
}

function StatPill({ label, value, up }: { label: string; value: string; up?: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-muted/60 border border-border rounded-lg px-3 py-1.5">
      {up !== undefined ? (
        up
          ? <ArrowUpRight size={12} className="text-emerald-600 shrink-0" />
          : <ArrowDownRight size={12} className="text-red-500 shrink-0" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
      )}
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">{label}</span>
      <span className="text-[11px] font-bold text-foreground ml-1">{value}</span>
    </div>
  );
}

function ActionChip({
  label, count, icon: Icon, urgent, path,
}: { label: string; count: number; icon: any; urgent?: boolean; path: string }) {
  const navigate = useNavigate();
  const hasItems = count > 0;
  return (
    <button
      onClick={() => navigate(path)}
      className={cn(
        'flex flex-col gap-2 p-4 rounded-xl border text-left transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]',
        hasItems
          ? urgent
            ? 'bg-card border-destructive/30 hover:border-destructive/60'
            : 'bg-card border-accent/40 hover:border-accent'
          : 'bg-muted/30 border-border hover:border-border',
      )}
    >
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center',
        hasItems ? (urgent ? 'bg-destructive/10 text-destructive' : 'bg-accent/10 text-accent') : 'bg-muted text-muted-foreground/40',
      )}>
        <Icon size={14} />
      </div>
      <div>
        <p className={cn(
          'font-display text-xl font-bold leading-none tracking-tight tabular-nums',
          hasItems ? (urgent ? 'text-destructive' : 'text-foreground') : 'text-muted-foreground/40',
        )}>
          {count}
        </p>
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground mt-1.5 leading-tight">
          {label}
        </p>
      </div>
    </button>
  );
}


function TransactionRow({ sender, receiver, amount, status, time }: {
  sender: string; receiver: string; amount: number; status: string; time: string;
}) {
  const ok = status === 'completed';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
        ok ? 'bg-emerald-50' : 'bg-red-50',
      )}>
        <Send size={12} className={ok ? 'text-emerald-600' : 'text-red-500'} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-foreground truncate leading-tight">{sender}</p>
        <p className="text-[10px] text-muted-foreground truncate leading-tight">→ {receiver}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[12px] font-bold text-foreground">{fmtKesCompact(amount)}</p>
        <p className="text-[9px] text-muted-foreground/60">{time}</p>
      </div>
    </div>
  );
}

function MemberRow({ name, phone, verified, time }: {
  name: string; phone: string; verified: boolean; time: string;
}) {
  const initials = name?.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
        <span className="text-[10px] font-bold text-accent">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-foreground truncate leading-tight">{name || 'Unknown'}</p>
        <p className="text-[10px] text-muted-foreground truncate">{phone || '—'}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn(
          'inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md',
          verified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700',
        )}>
          {verified ? <CheckCircle size={8} /> : <Clock size={8} />}
          {verified ? 'KYC' : 'Pending'}
        </span>
        <p className="text-[9px] text-muted-foreground/60">{time}</p>
      </div>
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
      <div className="flex flex-col items-center justify-center py-40 gap-3">
        <Loader2 className="animate-spin text-accent" size={28} />
        <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-medium">Loading overview</p>
      </div>
    );
  }

  const urgentCount = stats.unmappedMpesa + stats.failedB2c;

  return (
    <div className="space-y-4">

      {/* ── Hero header ──────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(213,72%,14%)] via-[hsl(213,72%,18%)] to-[hsl(160,84%,20%)] p-6 sm:p-8 text-white shadow-lg">
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full bg-accent/20 text-accent text-[9px] font-bold uppercase tracking-[0.22em] border border-accent/30">DASNET</span>
              <span className="text-[10px] font-medium text-white/50 uppercase tracking-widest">Control Centre</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-none">Executive Overview</h1>
            <p className="text-[12px] text-white/60 mt-2 font-medium">{format(new Date(), "EEEE, d MMM yyyy")}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-emerald-500/20 border border-emerald-400/30 backdrop-blur rounded-lg px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Live</span>
            </div>
            {urgentCount > 0 && (
              <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-400/30 backdrop-blur rounded-lg px-3 py-1.5">
                <Zap size={11} className="text-red-300" />
                <span className="text-[10px] font-bold text-red-200 uppercase tracking-wider">{urgentCount} Urgent</span>
              </div>
            )}
            <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-[11px] text-white/80 hover:text-white border border-white/15 hover:bg-white/10" onClick={load}>
              <RefreshCw size={11} /> Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* ── Hero KPI tiles · Bento (Navy Trust) ──────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
        {[
          { label: 'Assets Under Management', value: fmtKesCompact(stats.totalWalletBalance), sub: `${stats.totalUsers.toLocaleString()} member wallets`, icon: Wallet, path: '/dashboard/admin/users', span: 'sm:col-span-3', primary: true },
          { label: 'Transfer Volume · 7d', value: fmtKesCompact(stats.totalTransfers7d), sub: `${fmtKesCompact(stats.totalTransfersToday)} today`, icon: TrendingUp, path: '/dashboard/admin/transfers', span: 'sm:col-span-3', primary: false },
          { label: 'Active Loan Portfolio', value: fmtKesCompact(stats.totalLoanValue), sub: `${stats.totalLoansActive} active loans`, icon: Banknote, path: '/dashboard/admin/loans', span: 'sm:col-span-6', primary: false },
        ].map(({ label, value, sub, icon: Icon, path, span, primary }) => (
          <button
            key={label}
            onClick={() => navigate(path)}
            className={cn(
              'group relative overflow-hidden rounded-2xl p-5 sm:p-6 text-left transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.995] border',
              span,
              primary
                ? 'text-white bg-[radial-gradient(120%_120%_at_0%_0%,hsl(213_72%_22%)_0%,hsl(213_72%_14%)_45%,hsl(213_72%_10%)_100%)] border-white/5 shadow-[0_24px_60px_-30px_hsl(213_72%_8%/0.9)]'
                : 'text-foreground bg-card border-border hover:border-accent/40 shadow-sm hover:shadow-md',
            )}
          >
            {primary && <div aria-hidden className="absolute -top-12 -right-12 w-56 h-56 rounded-full bg-accent/15 blur-3xl pointer-events-none" />}
            <div className="relative flex items-start justify-between mb-5">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center ring-1',
                primary ? 'bg-white/10 ring-white/15 backdrop-blur' : 'bg-accent/10 ring-accent/20 text-accent',
              )}>
                <Icon size={17} className={primary ? 'text-accent' : undefined} />
              </div>
              <ChevronRight size={14} className={cn('transition-transform group-hover:translate-x-0.5', primary ? 'text-white/50' : 'text-muted-foreground/50')} />
            </div>
            <p className={cn('relative text-[9px] font-bold uppercase tracking-[0.22em] mb-2', primary ? 'text-white/55' : 'text-muted-foreground')}>{label}</p>
            <p className={cn('relative font-display text-2xl sm:text-3xl font-bold tracking-tight tabular-nums leading-none', primary ? 'text-white' : 'text-foreground')}>{value}</p>
            <p className={cn('relative text-[11px] font-medium mt-2', primary ? 'text-white/60' : 'text-muted-foreground')}>{sub}</p>
          </button>
        ))}
      </div>


      {/* ── Alert banner ───────────────────────────────── */}
      {totalActions > 0 && (
        <div className="px-4 py-3 rounded-xl flex items-center gap-3 bg-card border border-accent/30">
          <div className="w-9 h-9 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <AlertTriangle size={15} />
          </div>
          <div className="flex-1">
            <span className="text-[12px] font-bold text-foreground">{totalActions} item{totalActions !== 1 ? 's' : ''} pending review</span>
            <span className="text-[11px] text-muted-foreground ml-2">KYC · loans · withdrawals · M-Pesa</span>
          </div>
          <Button size="sm" className="h-7 text-[11px] shrink-0 bg-accent hover:bg-accent/90 text-accent-foreground border-0" onClick={() => navigate('/dashboard/admin/kyc')}>
            Review <ChevronRight size={12} />
          </Button>
        </div>
      )}


      {/* ── Revenue metrics ─────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-accent/10 ring-1 ring-accent/20 text-accent flex items-center justify-center">
            <Coins size={13} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">Revenue · Last 30 days</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Net Revenue', value: fmtKesCompact(stats.revenue30d), icon: Coins, accent: true },
            { label: 'Joining Fees', value: fmtKesCompact(stats.joiningFees30d), icon: Receipt },
            { label: 'M-Pesa Inflow', value: fmtKesCompact(stats.depositsToday), icon: ArrowDownLeft },
            { label: 'Payouts Today', value: fmtKesCompact(stats.payoutsToday), icon: Send },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className={cn('relative overflow-hidden p-4 rounded-xl border bg-card hover:shadow-md transition-shadow', accent ? 'border-accent/30 bg-accent/[0.04]' : 'border-border')}>
              <div className={cn('absolute top-0 left-0 w-full h-[2px]', accent ? 'bg-accent' : 'bg-border')} />
              <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3 ring-1', accent ? 'bg-accent/15 ring-accent/30 text-accent' : 'bg-muted ring-border text-foreground/70')}>
                <Icon size={15} />
              </div>
              <p className="font-display text-xl font-bold tracking-tight tabular-nums leading-none text-foreground">{value}</p>
              <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground mt-2">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Platform stats ──────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-muted/30 p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/10 ring-1 ring-primary/20 text-primary-foreground/80 flex items-center justify-center">
            <Activity size={13} className="text-accent" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">Platform · Live</span>
          <div className="flex-1 h-px bg-border" />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatPill label="Members" value={stats.totalUsers.toLocaleString()} up={stats.newUsersToday > 0} />
          <StatPill label="New today" value={`+${stats.newUsersToday}`} />
          <StatPill label="Chamas" value={stats.activeChamas.toLocaleString()} />
          <StatPill label="MGR Cycles" value={stats.openMgrCycles.toLocaleString()} />
          <StatPill label="Active loans" value={stats.totalLoansActive.toLocaleString()} />
        </div>
      </div>

      {/* ── Action queue ────────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-accent/10 ring-1 ring-accent/20 text-accent flex items-center justify-center">
            <Clock size={13} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">Action Queue</span>
          <div className="flex-1 h-px bg-border" />
          {totalActions > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[9px] font-bold uppercase tracking-wider">{totalActions} pending</span>
          )}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <ActionChip label="KYC" count={stats.pendingKyc} icon={ShieldAlert} path="/dashboard/admin/kyc" />
          <ActionChip label="Loans" count={stats.pendingLoans} icon={FileText} path="/dashboard/admin/loans" />
          <ActionChip label="Harambee" count={stats.pendingHarambees} icon={Heart} path="/dashboard/admin/harambee-applications" />
          <ActionChip label="Withdrawal" count={stats.pendingWithdrawals} icon={PiggyBank} path="/dashboard/admin/withdrawals" />
          <ActionChip label="Unmapped" count={stats.unmappedMpesa} icon={AlertTriangle} path="/dashboard/admin/mpesa" urgent />
          <ActionChip label="Failed B2C" count={stats.failedB2c} icon={Send} path="/dashboard/admin/mpesa" urgent />
        </div>
      </div>

      {/* ── Charts row ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent/10 ring-1 ring-accent/20 text-accent flex items-center justify-center">
                <TrendingUp size={13} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-foreground uppercase tracking-[0.2em]">Transfer Volume</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Daily completed total · 14 days</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-muted-foreground/60">KES</span>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={transferTrend} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="trGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(42,92%,56%)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(42,92%,56%)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 9, fill: CHART_TICK_COLOR, fontWeight: 600 }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 9, fill: CHART_TICK_COLOR, fontWeight: 600 }} axisLine={false} tickLine={false} tickFormatter={fmtCompact} />
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => [fmtKes(v), 'Volume']} />
                <Area type="monotone" dataKey="amount" stroke="hsl(42,92%,56%)" strokeWidth={2.5} fill="url(#trGrad)" dot={false} activeDot={{ r: 4, fill: 'hsl(42,92%,56%)', strokeWidth: 0 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 ring-1 ring-primary/20 text-accent flex items-center justify-center">
                <CreditCard size={13} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-foreground uppercase tracking-[0.2em]">Loan Portfolio</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">By status</p>
              </div>
            </div>
          </div>
          {loanMix.length === 0 ? (
            <div className="h-52 flex items-center justify-center"><p className="text-[11px] text-muted-foreground/40">No loan data</p></div>
          ) : (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={loanMix} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={42} outerRadius={66} paddingAngle={3} strokeWidth={0}>
                      {loanMix.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
                    </Pie>
                    <Tooltip contentStyle={customTooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-1.5 mt-3">
                {loanMix.map((m, i) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-[10px] text-muted-foreground capitalize">{m.name}</span>
                    </div>
                    <span className="text-[11px] font-bold text-foreground/70">{m.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Member growth ───────────────────────────────── */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 ring-1 ring-primary/20 text-accent flex items-center justify-center">
              <Users size={13} />
            </div>
            <div>
              <p className="text-[11px] font-bold text-foreground uppercase tracking-[0.2em]">Member Growth</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Daily new signups · 14 days</p>
            </div>
          </div>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={userTrend} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: CHART_TICK_COLOR, fontWeight: 600 }} axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 9, fill: CHART_TICK_COLOR, fontWeight: 600 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => [v, 'New members']} />
              <Bar dataKey="users" fill="hsl(213,72%,50%)" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recent activity tables ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold text-foreground/75 uppercase tracking-wider">Recent Transfers</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Latest wallet transactions</p>
            </div>
            <button
              onClick={() => navigate('/dashboard/admin/transfers')}
              className="flex items-center gap-1 text-[10px] font-semibold text-accent/70 hover:text-accent transition-colors"
            >
              View all <ChevronRight size={11} />
            </button>
          </div>
          {recentTransfers.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/40 py-8 text-center">No transfers yet</p>
          ) : (
            <div>
              {recentTransfers.map((t: any) => (
                <TransactionRow
                  key={t.id}
                  sender={t.sender_name || '—'}
                  receiver={t.receiver_name || '—'}
                  amount={Number(t.amount || 0)}
                  status={t.status}
                  time={format(new Date(t.created_at), 'HH:mm · d MMM')}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent members */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-bold text-foreground/75 uppercase tracking-wider">New Members</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Latest registrations</p>
            </div>
            <button
              onClick={() => navigate('/dashboard/admin/users')}
              className="flex items-center gap-1 text-[10px] font-semibold text-accent/70 hover:text-accent transition-colors"
            >
              View all <ChevronRight size={11} />
            </button>
          </div>
          {recentUsers.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/40 py-8 text-center">No members yet</p>
          ) : (
            <div>
              {recentUsers.map((u: any) => (
                <MemberRow
                  key={u.id}
                  name={u.full_name || ''}
                  phone={u.phone || ''}
                  verified={u.is_verified}
                  time={format(new Date(u.created_at), 'HH:mm · d MMM')}
                />
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
