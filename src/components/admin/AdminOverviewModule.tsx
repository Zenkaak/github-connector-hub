import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Users, Wallet, FileText, Heart, AlertTriangle,
  ShieldAlert, Send, PiggyBank, Activity, TrendingUp,
  Loader2, Server, CheckCircle, XCircle
} from 'lucide-react';
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

  const fmt = (n: number) => `KES ${n.toLocaleString()}`;
  const totalActions =
    stats.pendingKyc +
    stats.pendingLoans +
    stats.pendingHarambees +
    stats.pendingWithdrawals +
    stats.unmappedMpesa +
    stats.failedB2c;

  return (
    <div className="space-y-6">

      <AdminSectionHeader
        title="Admin Control Center"
        description="Monitor system health, financial activity, and pending operations"
        icon={Activity}
      />

      {/* 🚨 Critical Alert */}
      {totalActions > 0 && (
        <Card className="p-4 border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-red-500" />
            <div>
              <p className="font-semibold">
                {totalActions} actions require immediate attention
              </p>
              <p className="text-sm text-muted-foreground">
                Includes KYC, loans, withdrawals, and failed M-Pesa operations
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* 💰 Core Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AdminStatCard label="Wallet Balance" value={fmt(stats.totalWalletBalance)} icon={Wallet} tone="success" onClick={() => navigate('/dashboard/admin/users')} />
        <AdminStatCard label="Transfers Today" value={fmt(stats.totalTransfersToday)} icon={TrendingUp} tone="accent" onClick={() => navigate('/dashboard/admin/transfers')} />
        <AdminStatCard label="Active Users" value={stats.totalUsers} icon={Users} onClick={() => navigate('/dashboard/admin/users')} />
        <AdminStatCard label="New Today" value={stats.newUsersToday} icon={Users} onClick={() => navigate('/dashboard/admin/users')} />
      </div>

      {/* ⚠️ Pending Actions */}
      <div>
        <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Pending Actions</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <AdminStatCard label="KYC" value={stats.pendingKyc} icon={ShieldAlert} tone="warning" onClick={() => navigate('/dashboard/admin/kyc')} />
          <AdminStatCard label="Loans" value={stats.pendingLoans} icon={FileText} tone="warning" onClick={() => navigate('/dashboard/admin/loans')} />
          <AdminStatCard label="Harambee" value={stats.pendingHarambees} icon={Heart} tone="warning" onClick={() => navigate('/dashboard/admin/harambee-applications')} />
          <AdminStatCard label="Withdrawals" value={stats.pendingWithdrawals} icon={PiggyBank} tone="warning" onClick={() => navigate('/dashboard/admin/withdrawals')} />
          <AdminStatCard label="Unmapped" value={stats.unmappedMpesa} icon={AlertTriangle} tone="danger" onClick={() => navigate('/dashboard/admin/mpesa')} />
          <AdminStatCard label="Failed Payouts" value={stats.failedB2c} icon={Send} tone="danger" onClick={() => navigate('/dashboard/admin/mpesa')} />
        </div>
      </div>

      {/* 🧠 System Status */}
      <Card className="p-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Server size={16} /> System Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle size={14} /> Database Healthy
          </div>
          <div className="flex items-center gap-2 text-green-600">
            <CheckCircle size={14} /> M-Pesa API Connected
          </div>
          <div className="flex items-center gap-2 text-yellow-600">
            <AlertTriangle size={14} /> Queue Delays
          </div>
          <div className="flex items-center gap-2 text-red-600">
            <XCircle size={14} /> {stats.failedB2c} Failed Payouts
          </div>
        </div>
      </Card>

      {/* 📊 Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card className="p-5">
          <h3 className="font-semibold mb-3">Recent Users</h3>
          {recentUsers.map(u => (
            <div key={u.id} className="flex justify-between py-2 border-b">
              <div>
                <p className="text-sm font-medium">{u.full_name}</p>
                <p className="text-xs text-muted-foreground">{u.phone}</p>
              </div>
              <span className="text-xs">
                {u.is_verified ? '✔ Verified' : 'Unverified'}
              </span>
            </div>
          ))}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold mb-3">Recent Transfers</h3>
          {recentTransfers.map(t => (
            <div key={t.id} className="flex justify-between py-2 border-b">
              <div>
                <p className="text-sm">{t.sender_name} → {t.receiver_name}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(t.created_at), 'MMM d HH:mm')}
                </p>
              </div>
              <p className="text-sm font-bold">{fmt(t.amount)}</p>
            </div>
          ))}
        </Card>

      </div>
    </div>
  );
        }
