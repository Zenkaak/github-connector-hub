import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Users, Wallet, FileText, Heart, AlertTriangle, ShieldAlert, Send, PiggyBank, Activity, TrendingUp, Loader2 } from 'lucide-react';
import { AdminStatCard } from './AdminStatCard';
import { AdminSectionHeader } from './AdminSectionHeader';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

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
  activeChamas: number;
  openMgrCycles: number;
}

export function AdminOverviewModule() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentTransfers, setRecentTransfers] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      const [
        usersTotal, usersToday, kyc, loans, harambees, withdrawals,
        unmapped, b2cFailed, walletSum, transfersToday, chamas, mgrOpen,
        users5, transfers5,
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
        supabase.from('chama_groups').select('id', { count: 'exact', head: true }),
        supabase.from('chama_mgr_cycles').select('id', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('profiles').select('id, full_name, phone, created_at, is_verified').order('created_at', { ascending: false }).limit(5),
        supabase.from('wallet_transfers').select('id, sender_name, receiver_name, amount, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

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
        activeChamas: chamas.count || 0,
        openMgrCycles: mgrOpen.count || 0,
      });
      setRecentUsers(users5.data || []);
      setRecentTransfers(transfers5.data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  const fmt = (n: number) => `KES ${n.toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;
  const totalActions = stats.pendingKyc + stats.pendingLoans + stats.pendingHarambees + stats.pendingWithdrawals + stats.unmappedMpesa + stats.failedB2c;

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        title="Platform Overview"
        description="Real-time snapshot of your platform's health and activity"
        icon={Activity}
      />

      {/* Action Required Banner */}
      {totalActions > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground">{totalActions} item{totalActions !== 1 ? 's' : ''} need your attention</p>
              <p className="text-sm text-muted-foreground">Review pending requests across KYC, loans, harambees, and payments.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Pending Actions Grid */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Pending Actions</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <AdminStatCard label="KYC Reviews" value={stats.pendingKyc} icon={ShieldAlert} tone={stats.pendingKyc > 0 ? 'warning' : 'default'} onClick={() => navigate('/dashboard/admin/kyc')} />
          <AdminStatCard label="Loan Apps" value={stats.pendingLoans} icon={FileText} tone={stats.pendingLoans > 0 ? 'warning' : 'default'} onClick={() => navigate('/dashboard/admin/loans')} />
          <AdminStatCard label="Harambees" value={stats.pendingHarambees} icon={Heart} tone={stats.pendingHarambees > 0 ? 'warning' : 'default'} onClick={() => navigate('/dashboard/admin/harambee-applications')} />
          <AdminStatCard label="Withdrawals" value={stats.pendingWithdrawals} icon={PiggyBank} tone={stats.pendingWithdrawals > 0 ? 'warning' : 'default'} onClick={() => navigate('/dashboard/admin/withdrawals')} />
          <AdminStatCard label="Unmapped M-Pesa" value={stats.unmappedMpesa} icon={AlertTriangle} tone={stats.unmappedMpesa > 0 ? 'danger' : 'default'} onClick={() => navigate('/dashboard/admin/mpesa')} />
          <AdminStatCard label="Failed Payouts" value={stats.failedB2c} icon={Send} tone={stats.failedB2c > 0 ? 'danger' : 'default'} onClick={() => navigate('/dashboard/admin/mpesa')} />
        </div>
      </div>

      {/* Platform Stats */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Platform Health</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <AdminStatCard label="Total Users" value={stats.totalUsers.toLocaleString()} sublabel={`+${stats.newUsersToday} today`} icon={Users} tone="accent" onClick={() => navigate('/dashboard/admin/users')} />
          <AdminStatCard label="Wallet Balance" value={fmt(stats.totalWalletBalance)} icon={Wallet} tone="success" onClick={() => navigate('/dashboard/admin/wallets')} />
          <AdminStatCard label="Transfers Today" value={fmt(stats.totalTransfersToday)} icon={TrendingUp} tone="accent" onClick={() => navigate('/dashboard/admin/transfers')} />
          <AdminStatCard label="Active Chamas" value={stats.activeChamas} icon={Users} onClick={() => navigate('/dashboard/admin/chama')} />
          <AdminStatCard label="Open MGR Cycles" value={stats.openMgrCycles} icon={Activity} onClick={() => navigate('/dashboard/admin/mgr')} />
          <AdminStatCard label="New Today" value={stats.newUsersToday} sublabel="signups" icon={Users} />
        </div>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Recent Signups</h3>
            <button onClick={() => navigate('/dashboard/admin/users')} className="text-xs font-semibold text-accent hover:underline">View all →</button>
          </div>
          <div className="space-y-2">
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{u.full_name || 'Unnamed'}</p>
                  <p className="text-xs text-muted-foreground">{u.phone || '—'}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${u.is_verified ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                  {u.is_verified ? 'Verified' : 'Unverified'}
                </span>
              </div>
            ))}
            {recentUsers.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No recent signups</p>}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground">Recent Transfers</h3>
            <button onClick={() => navigate('/dashboard/admin/transfers')} className="text-xs font-semibold text-accent hover:underline">View all →</button>
          </div>
          <div className="space-y-2">
            {recentTransfers.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{t.sender_name} → {t.receiver_name}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(t.created_at), 'MMM d, HH:mm')}</p>
                </div>
                <p className="text-sm font-bold text-foreground tabular-nums">{fmt(Number(t.amount))}</p>
              </div>
            ))}
            {recentTransfers.length === 0 && <p className="text-sm text-muted-foreground py-4 text-center">No recent transfers</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
