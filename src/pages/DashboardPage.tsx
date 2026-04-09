import { useEffect, useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard,
  FileText,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  Plus,
  Eye,
  Settings,
  User,
  Activity,
  Bell,
  Upload,
  MessageSquare,
  Users,
  Crown,
  ChevronRight,
  Receipt,
  CheckCircle2,
  XCircle,
  Send,
  HandCoins,
  PiggyBank,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { loanProducts, LoanProduct } from '@/lib/loan-products';
import { LoanProductCard } from '@/components/LoanProductCard';
import { Progress } from '@/components/ui/progress';
import { DashboardPageSkeleton } from '@/components/DashboardSkeleton';
import { LoanCalculator } from '@/components/LoanCalculator';
import { EmptyState } from '@/components/EmptyState';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { SendMoneyDialog } from '@/components/SendMoneyDialog';
import { RequestMoneyDialog } from '@/components/RequestMoneyDialog';
import { useInstallPrompt, shouldShowInstallToast, markInstallToastShown } from '@/hooks/useInstallPrompt';
import { Download } from 'lucide-react';

function ChamaTxnSummary({ userId, chamaGroups }: { userId?: string; chamaGroups: ChamaGroup[] }) {
  const navigate = useNavigate();
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || !chamaGroups.length) { setLoading(false); return; }
    const fetchTxns = async () => {
      const groupIds = chamaGroups.map(g => g.id);
      // Fetch STK transactions with CHAMA_ prefix for user's groups
      const { data } = await supabase
        .from('stk_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      
      const chamaTxns = (data || []).filter(t => {
        const ref = t.reference || '';
        return ref.startsWith('CHAMA_') && groupIds.some(gid => ref.includes(gid));
      });
      setTxns(chamaTxns);
      setLoading(false);
    };
    fetchTxns();
  }, [userId, chamaGroups]);

  if (loading) return <div className="h-16 bg-muted/40 animate-pulse rounded-xl" />;
  if (txns.length === 0) return <p className="text-sm text-muted-foreground text-center py-4">No chama transactions yet</p>;

  const statusIcon = { success: CheckCircle2, failed: XCircle, pending: Clock };
  const statusColor = { success: 'text-emerald-500 bg-emerald-500/10', failed: 'text-destructive bg-destructive/10', pending: 'text-accent bg-accent/10' };

  return (
    <div className="space-y-2">
      {txns.slice(0, 5).map(tx => {
        const Icon = statusIcon[tx.status as keyof typeof statusIcon] || Clock;
        const color = statusColor[tx.status as keyof typeof statusColor] || statusColor.pending;
        const groupId = (tx.reference || '').replace('CHAMA_', '').split('_')[0];
        const group = chamaGroups.find(g => g.id === groupId);
        return (
          <div
            key={tx.id}
            className="flex items-center justify-between p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
            onClick={() => group && navigate(`/dashboard/chama/${group.id}`)}
          >
            <div className="flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', color.split(' ')[1])}>
                <Icon size={16} className={color.split(' ')[0]} />
              </div>
              <div>
                <p className="font-medium text-sm">{group?.name || 'Chama'} · KES {tx.amount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            </div>
            <span className={cn('text-[11px] font-medium px-2 py-1 rounded-full', color)}>{tx.status}</span>
          </div>
        );
      })}
    </div>
  );
}

interface LoanApplication {
  id: string;
  loan_type: string;
  applied_amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'disbursed';
  created_at: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ChamaGroup {
  id: string;
  name: string;
  member_count: number;
  my_role: string;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { profile, user, isAdmin } = useAuth();
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [chamaGroups, setChamaGroups] = useState<ChamaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendMoneyOpen, setSendMoneyOpen] = useState(false);
  const [requestMoneyOpen, setRequestMoneyOpen] = useState(false);
  const [disbursements, setDisbursements] = useState<any[]>([]);
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [chamaUpdates, setChamaUpdates] = useState<any[]>([]);

  const fetchApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('loan_applications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);
      if (error) throw error;
      setApplications((data as LoanApplication[]) || []);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setNotifications((data as Notification[]) || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchWalletBalance = async () => {
    try {
      const { data } = await supabase
        .from('wallets')
        .select('balance')
        .eq('user_id', user?.id)
        .maybeSingle();
      setWalletBalance(data?.balance ?? 0);
    } catch (error) {
      console.error('Error fetching wallet:', error);
    }
  };

  const fetchChamaGroups = async () => {
    try {
      const { data: memberships } = await supabase
        .from('chama_members')
        .select('group_id, role')
        .eq('user_id', user?.id);
      if (!memberships?.length) { setChamaGroups([]); return; }
      const groupIds = memberships.map(m => m.group_id);
      const { data: groupsData } = await supabase
        .from('chama_groups')
        .select('id, name')
        .in('id', groupIds);
      if (groupsData) {
        const enriched = await Promise.all(groupsData.map(async (g) => {
          const { count } = await supabase.from('chama_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id);
          const myRole = memberships.find(m => m.group_id === g.id)?.role || 'member';
          return { ...g, member_count: count || 0, my_role: myRole };
        }));
        setChamaGroups(enriched);
      }
    } catch (error) { console.error('Error fetching chama groups:', error); }
  };

  const fetchDisbursements = async () => {
    try {
      const { data } = await supabase
        .from('loan_disbursements')
        .select('*')
        .eq('user_id', user?.id)
        .eq('status', 'active')
        .order('repayment_due_date', { ascending: true });
      setDisbursements(data || []);
    } catch (error) {
      console.error('Error fetching disbursements:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchNotifications();
      fetchWalletBalance();
      fetchChamaGroups();
      fetchDisbursements();

      // Periodic install toast
      const timer = setTimeout(() => {
        if (shouldShowInstallToast() && !isInstalled) {
          markInstallToastShown();
          toast('📱 Download Dasnet App', {
            description: 'Install for faster access & instant notifications',
            action: {
              label: 'Install Now',
              onClick: () => promptInstall(),
            },
            duration: 8000,
          });
        }
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // Redirect admins to the admin panel
  if (isAdmin) {
    return <Navigate to="/dashboard/admin" replace />;
  }

  const hasActiveApplication = applications.some(
    (app) => app.status === 'pending' || app.status === 'approved'
  );

  const handleApplyLoan = (product: LoanProduct) => {
    if (!profile?.is_active) {
      toast.info('Please activate your account first');
      navigate('/dashboard/applications', { state: { showActivation: true, product } });
      return;
    }
    if (hasActiveApplication) {
      toast.error('You already have an active loan application');
      navigate('/dashboard/applications');
      return;
    }
    navigate('/dashboard/apply', { state: { product } });
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

  const stats = (() => {
    const total = applications.length;
    const approved = applications.filter((a) => a.status === 'approved' || a.status === 'disbursed').length;
    const pending = applications.filter((a) => a.status === 'pending').length;
    const totalAmount = applications
      .filter((a) => a.status === 'approved' || a.status === 'disbursed')
      .reduce((sum, a) => sum + a.applied_amount, 0);
    return { total, approved, pending, totalAmount };
  })();

  const statCards = [
    { label: 'Send Money', value: '→', icon: Send, color: 'text-primary', bg: 'bg-primary/10', trend: 'Free transfer', action: 'send' },
    { label: 'Request Money', value: '←', icon: HandCoins, color: 'text-accent', bg: 'bg-accent/10', trend: 'From users', action: 'request' },
    { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'text-accent', bg: 'bg-accent/10', trend: 'Under review' },
    { label: 'Total Disbursed', value: formatCurrency(stats.totalAmount), icon: Wallet, color: 'text-success', bg: 'bg-success/10', trend: 'Lifetime total' },
  ];

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const quickActions = [
    { label: 'Deposit', icon: ArrowDownLeft, path: '/dashboard/wallet', color: 'bg-success/80 text-success-foreground', desc: 'Add funds' },
    { label: 'Withdraw', icon: ArrowUpRight, path: '/dashboard/wallet', color: 'bg-accent text-accent-foreground', desc: 'Cash out' },
    { label: 'Apply for Loan', icon: Plus, path: '/dashboard/products', color: 'bg-primary text-primary-foreground', desc: 'Browse products' },
    { label: 'My Savings', icon: PiggyBank, path: '/dashboard/savings', color: 'bg-success/80 text-success-foreground', desc: 'Target & Lock savings' },
    { label: 'Transactions', icon: Receipt, path: '/dashboard/transactions', color: 'bg-primary/80 text-primary-foreground', desc: 'Payment history' },
    { label: 'Chama Groups', icon: Users, path: '/dashboard/chama', color: 'bg-primary text-primary-foreground', desc: 'My groups' },
    { label: 'Settings', icon: Settings, path: '/dashboard/settings', color: 'bg-muted text-foreground', desc: 'Preferences' },
  ];

  const profileCompletion = (() => {
    if (!profile) return 0;
    const fields = [profile.full_name, profile.email, profile.phone, profile.county, profile.sub_county, profile.ward, profile.address, profile.id_number, profile.date_of_birth];
    const filled = fields.filter(Boolean).length;
    return Math.round((filled / fields.length) * 100);
  })();

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardPageSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-5 lg:p-8 space-y-6 max-w-[1200px]">
        {/* Greeting + Quick Actions Row */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex-1">
            <h1 className="font-display text-2xl font-bold text-foreground">
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Here's your financial overview for today</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex items-center gap-2">
            <Button variant="gold" onClick={() => navigate('/dashboard/products')} className="shadow-gold">
              <Plus size={16} />
              New Loan Application
            </Button>
            <Button variant="outline" onClick={() => navigate('/dashboard/chama')} className="border-accent/30 text-accent hover:bg-accent/10">
              <Users size={16} />
              <span className="hidden sm:inline">Chama</span>
            </Button>
          </motion.div>
        </div>

        {/* Loan Activation Info - only shown if not yet activated */}
        {!profile?.is_active && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-primary/90 to-primary/80 p-5 md:p-6"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_hsl(42_92%_56%_/_0.15),_transparent_60%)]" />
            <div className="absolute inset-0 grid-pattern opacity-[0.02]" />
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
                  <Sparkles className="text-accent" size={22} />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-base">Loan Activation Required</h3>
                  <p className="text-sm text-white/50 mt-0.5">
                    Pay KES 349 once when you apply for your first loan to unlock borrowing
                  </p>
                </div>
              </div>
              <Button
                variant="hero"
                size="sm"
                onClick={() => navigate('/dashboard/products')}
                className="w-fit shrink-0"
              >
                Browse Loan Products
                <ArrowRight size={14} />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => navigate(action.path)}
                className="group p-4 rounded-2xl bg-card border border-border/50 hover:border-accent/30 hover:shadow-md transition-all duration-300 text-left"
              >
                <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                  <action.icon size={18} />
                </div>
                <p className="font-semibold text-sm">{action.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{action.desc}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i + 0.15 }}
            >
              <Card
                className={cn("border-border/50 hover:shadow-md transition-all duration-300 hover:border-accent/20", (stat as any).action && "cursor-pointer")}
                onClick={() => {
                  if ((stat as any).action === 'send') setSendMoneyOpen(true);
                  if ((stat as any).action === 'request') setRequestMoneyOpen(true);
                }}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <stat.icon className={stat.color} size={20} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold font-display tracking-tight">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-2 uppercase tracking-wider">{stat.trend}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Wallet Summary Card */}
        {walletBalance !== null && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <Card className="border-border/50 overflow-hidden">
              <div className="relative p-5 md:p-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_hsl(42_92%_56%_/_0.15),_transparent_60%)]" />
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Wallet Balance</p>
                    <p className="text-3xl font-bold font-display text-white">{formatCurrency(walletBalance)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="hero" size="sm" onClick={() => navigate('/dashboard/wallet')}>
                      <Wallet size={14} /> View Wallet
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Loan Repayment Tracker */}
        {disbursements.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }}>
            <Card className="border-border/50">
              <CardHeader className="flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp size={16} className="text-accent" />
                    Active Loan Repayments
                  </CardTitle>
                  <CardDescription>Track your outstanding balances</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {disbursements.map((d) => {
                  const total = d.disbursed_amount + (d.disbursed_amount * (d.interest_rate / 100));
                  const repaid = total - d.outstanding_balance;
                  const progress = total > 0 ? Math.min(100, Math.round((repaid / total) * 100)) : 0;
                  const daysLeft = Math.max(0, Math.ceil((new Date(d.repayment_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                  const isOverdue = daysLeft === 0 && d.outstanding_balance > 0;
                  return (
                    <div key={d.id} className="p-4 rounded-xl bg-muted/40 space-y-3 cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => navigate('/dashboard/applications')}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">Loan · {formatCurrency(d.disbursed_amount)}</p>
                          <p className="text-xs text-muted-foreground">
                            {isOverdue ? (
                              <span className="text-destructive font-medium">Overdue</span>
                            ) : (
                              <span>{daysLeft} day{daysLeft !== 1 ? 's' : ''} until due</span>
                            )}
                            {' · '}{new Date(d.repayment_due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-destructive">{formatCurrency(d.outstanding_balance)}</p>
                          <p className="text-[10px] text-muted-foreground">remaining</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                          <span>Repaid: {formatCurrency(repaid)}</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Chama Groups - prominent position */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <Card className="border-border/50">
            <CardHeader className="flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Users size={16} className="text-primary" />
                  My Chama Groups
                </CardTitle>
                <CardDescription>Your savings groups</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/dashboard/chama')}>
                View All <ArrowUpRight size={14} />
              </Button>
            </CardHeader>
            <CardContent>
              {chamaGroups.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No Chama groups yet"
                  description="Create or join a savings group"
                  actionLabel="Create Group"
                  onAction={() => navigate('/dashboard/chama')}
                />
              ) : (
                <div className="space-y-2">
                  {chamaGroups.slice(0, 3).map((group) => (
                    <Link key={group.id} to={`/dashboard/chama/${group.id}`}>
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Users className="text-primary" size={16} />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{group.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                group.my_role === 'chairperson' ? 'bg-accent/10 text-accent' :
                                group.my_role === 'treasurer' ? 'bg-emerald-500/10 text-emerald-500' :
                                group.my_role === 'secretary' ? 'bg-blue-500/10 text-blue-500' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {group.my_role === 'chairperson' && <Crown size={8} className="inline mr-0.5" />}
                                {group.my_role.charAt(0).toUpperCase() + group.my_role.slice(1)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{group.member_count} members</span>
                            </div>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Chama Transactions */}
        {chamaGroups.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
            <Card className="border-border/50">
              <CardHeader className="flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Receipt size={16} className="text-accent" />
                    Chama Transactions
                  </CardTitle>
                  <CardDescription>Your recent chama payments</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <ChamaTxnSummary userId={user?.id} chamaGroups={chamaGroups} />
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Profile Completion */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="border-border/50 h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity size={16} className="text-primary" />
                  Profile Completion
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Progress</span>
                    <span className="text-sm font-bold text-primary">{profileCompletion}%</span>
                  </div>
                  <Progress value={profileCompletion} className="h-2" />
                </div>
                <div className="space-y-2.5 pt-2">
                  {[
                    { label: 'Personal Info', done: !!(profile?.full_name && profile?.date_of_birth) },
                    { label: 'Contact Details', done: !!(profile?.email && profile?.phone) },
                    { label: 'Location', done: !!(profile?.county && profile?.address) },
                    { label: 'Account Activated', done: !!profile?.is_active },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center ${item.done ? 'bg-success/10' : 'bg-muted'}`}>
                        {item.done ? (
                          <CheckCircle size={12} className="text-success" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />
                        )}
                      </div>
                      <span className={`text-sm ${item.done ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => navigate('/dashboard/account')}
                >
                  View Account
                  <ArrowRight size={14} />
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Applications */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="lg:col-span-2">
            <Card className="border-border/50 h-full">
              <CardHeader className="flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-base">Recent Applications</CardTitle>
                  <CardDescription>Your latest loan activity</CardDescription>
                </div>
                {applications.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/dashboard/applications')}>
                    View All <ArrowUpRight size={14} />
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {applications.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No applications yet"
                    description="Start your journey by applying for a loan"
                    actionLabel="Browse Products"
                    onAction={() => navigate('/dashboard/products')}
                  />
                ) : (
                  <div className="space-y-2">
                    {applications.map((app) => (
                      <div
                        key={app.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
                        onClick={() => navigate('/dashboard/applications')}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                            <CreditCard className="text-primary" size={16} />
                          </div>
                          <div>
                            <p className="font-medium text-sm capitalize">{app.loan_type.replace('_', ' ')} Loan</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(app.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-semibold text-sm hidden sm:block">{formatCurrency(app.applied_amount)}</p>
                          <StatusBadge status={app.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Messages — separated by type */}
        {notifications.length > 0 && (() => {
          const chamaTitleKeywords = ['chama', 'harambee', 'meeting scheduled', 'meeting reminder', 'savings reminder', 'join request', 'leave request', 'group dissolved', 'new member', 'member removed'];
          const chamaNotifs = notifications.filter(n => {
            const t = n.title.toLowerCase();
            return chamaTitleKeywords.some(kw => t.includes(kw));
          });
          const supportNotifs = notifications.filter(n => !chamaNotifs.includes(n));

          const renderNotif = (notif: Notification, icon: React.ReactNode, accentClass: string) => {
            const isDocRequest = notif.message.startsWith('[DOCUMENT_REQUEST]');
            const displayMessage = isDocRequest ? notif.message.replace('[DOCUMENT_REQUEST] ', '') : notif.message;
            return (
              <div key={notif.id} className={`p-3 rounded-xl border transition-all ${!notif.is_read ? 'border-l-4 border-l-accent border-border/50 bg-accent/5' : 'border-border/40 bg-muted/30'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${accentClass}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h4 className="font-semibold text-xs">{notif.title}</h4>
                      {!notif.is_read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{displayMessage}</p>
                    {isDocRequest && (
                      <Button variant="outline" size="sm" className="mt-2 text-xs h-7" onClick={() => navigate('/dashboard/account')}>
                        <Upload size={12} className="mr-1" /> Upload Documents
                      </Button>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                      {(() => {
                        const diff = Date.now() - new Date(notif.created_at).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        return `${Math.floor(hrs / 24)}d ago`;
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            );
          };

          return (
            <div className="grid gap-5 lg:grid-cols-2">
              {/* Support & Admin Messages */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                <Card className="border-border/50 h-full">
                  <CardHeader className="flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare size={16} className="text-accent" />
                        Support & Admin
                      </CardTitle>
                      <CardDescription>Loan updates & account alerts</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/dashboard/notifications')}>
                      View All <ArrowUpRight size={14} />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {supportNotifs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No support messages</p>
                    ) : (
                      supportNotifs.slice(0, 4).map((notif) => {
                        const isDocRequest = notif.message.startsWith('[DOCUMENT_REQUEST]');
                        return renderNotif(
                          notif,
                          isDocRequest ? <Upload size={14} className="text-primary" /> : <MessageSquare size={14} className="text-accent" />,
                          isDocRequest ? 'bg-primary/10' : 'bg-accent/10'
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Chama Messages */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-border/50 h-full">
                  <CardHeader className="flex-row items-center justify-between pb-3">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users size={16} className="text-primary" />
                        Chama Updates
                      </CardTitle>
                      <CardDescription>Group activity & reminders</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/dashboard/chama')}>
                      View All <ArrowUpRight size={14} />
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {chamaNotifs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No chama updates</p>
                    ) : (
                      chamaNotifs.slice(0, 4).map((notif) =>
                        renderNotif(notif, <Users size={14} className="text-primary" />, 'bg-primary/10')
                      )
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          );
        })()}

        {/* Download App Banner */}
        {!isInstalled && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.31 }}>
            <button
              onClick={() => {
                if (canInstall) {
                  promptInstall();
                } else {
                  toast.info('To install: tap your browser menu → "Add to Home Screen" or "Install App"');
                }
              }}
              className="w-full rounded-xl bg-accent text-accent-foreground p-4 flex items-center gap-3 shadow-gold hover:bg-accent/90 transition-colors cursor-pointer"
            >
              <Download size={20} className="shrink-0" />
              <div className="text-left flex-1">
                <p className="font-bold text-sm">Download Dasnet App</p>
                <p className="text-[11px] opacity-80">Install for faster access & instant notifications</p>
              </div>
              <ArrowRight size={16} className="shrink-0 opacity-70" />
            </button>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <LoanCalculator />
        </motion.div>

        {/* Loan Products */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-lg font-bold">Available Products</h2>
              <p className="text-sm text-muted-foreground">Choose a loan product that fits your needs</p>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/dashboard/products')}>
              See All <ArrowUpRight size={14} />
            </Button>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {loanProducts.slice(0, 3).map((product) => (
              <LoanProductCard key={product.id} product={product} onApply={handleApplyLoan} disabled={hasActiveApplication} />
            ))}
          </div>
        </motion.div>
      </div>

        <SendMoneyDialog
          open={sendMoneyOpen}
          onOpenChange={setSendMoneyOpen}
          walletBalance={walletBalance || 0}
          onSuccess={() => fetchWalletBalance()}
        />
        <RequestMoneyDialog
          open={requestMoneyOpen}
          onOpenChange={setRequestMoneyOpen}
          onSuccess={() => {}}
        />
    </DashboardLayout>
  );
}
