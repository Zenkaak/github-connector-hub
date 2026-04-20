import { useEffect, useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CreditCard, FileText, TrendingUp, ArrowRight, CheckCircle, Clock, Sparkles,
  ArrowUpRight, ArrowDownLeft, Wallet, Plus, Eye, Settings, User, Activity,
  Bell, Upload, MessageSquare, Users, Crown, ChevronRight, Receipt,
  CheckCircle2, XCircle, Send, HandCoins, PiggyBank, HeartHandshake,
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

  const fetchChamaUpdates = async () => {
    try {
      const { data: memberships } = await supabase
        .from('chama_members')
        .select('group_id')
        .eq('user_id', user?.id)
        .eq('is_active', true);
      if (!memberships?.length) return;
      const groupIds = memberships.map(m => m.group_id);
      const [announcements, meetings, savings] = await Promise.all([
        supabase.from('chama_announcements').select('id, title, message, created_at, group_id').in('group_id', groupIds).order('created_at', { ascending: false }).limit(5),
        supabase.from('chama_meetings').select('id, title, meeting_date, status, group_id').in('group_id', groupIds).eq('status', 'scheduled').order('meeting_date', { ascending: true }).limit(3),
        supabase.from('chama_savings').select('id, amount, created_at, group_id, user_id').in('group_id', groupIds).order('created_at', { ascending: false }).limit(5),
      ]);
      const updates: any[] = [];
      (announcements.data || []).forEach(a => updates.push({ ...a, _type: 'announcement' }));
      (meetings.data || []).forEach(m => updates.push({ ...m, _type: 'meeting', created_at: m.meeting_date }));
      (savings.data || []).forEach(s => updates.push({ ...s, _type: 'saving' }));
      updates.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setChamaUpdates(updates.slice(0, 6));
    } catch (e) { console.error('Error fetching chama updates:', e); }
  };

  useEffect(() => {
    if (user) {
      fetchApplications();
      fetchNotifications();
      fetchWalletBalance();
      fetchChamaGroups();
      fetchDisbursements();
      fetchChamaUpdates();
      const timer = setTimeout(() => {
        if (shouldShowInstallToast() && !isInstalled) {
          markInstallToastShown();
          toast('📱 Download Dasnet App', {
            description: 'Install for faster access & instant notifications',
            action: { label: 'Install Now', onClick: () => promptInstall() },
            duration: 8000,
          });
        }
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [user]);

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
    const totalDisbursed = disbursements.reduce((sum, d) => sum + (d.disbursed_amount || 0), 0);
    return { total, approved, pending, totalDisbursed };
  })();

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const quickActions = [
    { label: 'Deposit', icon: ArrowDownLeft, onClick: () => navigate('/dashboard/wallet'), color: 'bg-success/15 text-success', desc: 'Add funds' },
    { label: 'Withdraw', icon: ArrowUpRight, onClick: () => navigate('/dashboard/wallet'), color: 'bg-accent/15 text-accent', desc: 'Cash out' },
    { label: 'Send', icon: Send, onClick: () => setSendMoneyOpen(true), color: 'bg-primary/15 text-primary', desc: 'Transfer' },
    { label: 'Request', icon: HandCoins, onClick: () => setRequestMoneyOpen(true), color: 'bg-accent/15 text-accent', desc: 'Ask money' },
    { label: 'Savings', icon: PiggyBank, onClick: () => navigate('/dashboard/savings'), color: 'bg-success/15 text-success', desc: 'Goals' },
    { label: 'Chamas', icon: Users, onClick: () => navigate('/dashboard/chama'), color: 'bg-primary/15 text-primary', desc: 'My groups' },
    { label: 'Loan', icon: CreditCard, onClick: () => navigate('/dashboard/products'), color: 'bg-accent/15 text-accent', desc: 'Apply' },
    { label: 'Harambee', icon: HeartHandshake, onClick: () => navigate('/dashboard/create-fundraiser'), color: 'bg-destructive/15 text-destructive', desc: 'Fundraise' },
  ];

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardPageSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="px-1.5 py-2 sm:px-3 lg:p-8 space-y-2.5 max-w-[1200px] mx-auto">
        {/* Greeting */}
        <div className="flex items-center justify-between">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h1 className="font-display text-lg font-bold text-foreground">
              {greeting}, {firstName} 👋
            </h1>
            <p className="text-[11px] text-muted-foreground">Here's your financial overview for today</p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="flex items-center gap-1.5">
            <Button variant="gold" size="sm" onClick={() => navigate('/dashboard/products')} className="shadow-gold h-8 text-[11px] px-2.5">
              <Plus size={13} />
              <span className="hidden sm:inline">New Loan Application</span>
              <span className="sm:hidden">Apply</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/chama')} className="border-accent/30 text-accent hover:bg-accent/10 h-8 w-8 sm:w-auto px-0 sm:px-2.5">
              <Users size={13} />
              <span className="hidden sm:inline text-[11px]">Chama</span>
            </Button>
          </motion.div>
        </div>

        {/* Loan Activation Info */}
        {!profile?.is_active && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary via-primary/90 to-primary/80 p-3"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_hsl(42_92%_56%_/_0.15),_transparent_60%)]" />
            <div className="absolute inset-0 grid-pattern opacity-[0.02]" />
            <div className="relative z-10 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center shrink-0">
                  <Sparkles className="text-accent" size={16} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-white text-xs">Activation Required</h3>
                  <p className="text-[10px] text-white/50 truncate">Pay KES 349 to unlock borrowing</p>
                </div>
              </div>
              <Button variant="hero" size="sm" onClick={() => navigate('/dashboard/products')} className="shrink-0 h-7 text-[11px]">
                Browse <ArrowRight size={11} />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                className="group flex flex-col items-center text-center p-2 sm:p-2.5 rounded-xl bg-card border border-border/50 hover:border-accent/30 hover:shadow-md transition-all duration-300 active:scale-[0.97]"
              >
                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${action.color} flex items-center justify-center mb-1 group-hover:scale-110 transition-transform duration-300`}>
                  <action.icon size={16} />
                </div>
                <p className="font-semibold text-[10px] sm:text-xs leading-tight">{action.label}</p>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{action.desc}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Total Disbursed stat */}
        {stats.totalDisbursed > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card className="border-border/50 cursor-pointer hover:border-accent/30 transition-colors" onClick={() => navigate('/dashboard/applications')}>
              <CardContent className="p-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-success/10 text-success flex items-center justify-center">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Total Disbursed</p>
                    <p className="font-semibold text-sm">{formatCurrency(stats.totalDisbursed)}</p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-muted-foreground" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Wallet Summary */}
        {walletBalance !== null && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <Card className="border-border/50 overflow-hidden">
              <div className="relative p-3 bg-gradient-to-r from-primary via-primary/90 to-primary/80">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_right,_hsl(42_92%_56%_/_0.15),_transparent_60%)]" />
                <div className="relative z-10 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] text-white/60 uppercase tracking-wider">Wallet Balance</p>
                    <p className="text-xl font-bold font-display text-white leading-tight">{formatCurrency(walletBalance)}</p>
                  </div>
                  <Button variant="hero" size="sm" onClick={() => navigate('/dashboard/wallet')} className="h-8 text-[11px]">
                    <Wallet size={13} /> View Wallet
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Loan Repayment Tracker */}
        {disbursements.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }}>
            <Card className="border-border/50">
              <CardHeader className="flex-row items-center justify-between px-2.5 sm:px-3 pt-2.5 pb-2">
                <div>
                  <CardTitle className="text-xs flex items-center gap-2">
                    <TrendingUp size={13} className="text-accent" />
                    Active Loan Repayments
                  </CardTitle>
                  <CardDescription className="text-[10px]">Track your outstanding balances</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="px-2.5 sm:px-3 pb-2.5 space-y-1.5">
                {disbursements.map((d) => {
                  const total = d.disbursed_amount + (d.disbursed_amount * (d.interest_rate / 100));
                  const repaid = total - d.outstanding_balance;
                  const progress = total > 0 ? Math.min(100, Math.round((repaid / total) * 100)) : 0;
                  const daysLeft = Math.max(0, Math.ceil((new Date(d.repayment_due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                  const isOverdue = daysLeft === 0 && d.outstanding_balance > 0;
                  return (
                    <div key={d.id} className="p-2.5 rounded-xl bg-muted/40 space-y-1.5 cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => navigate('/dashboard/applications')}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-xs">Loan · {formatCurrency(d.disbursed_amount)}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {isOverdue ? <span className="text-destructive font-medium">Overdue</span> : <span>{daysLeft} day{daysLeft !== 1 ? 's' : ''} until due</span>}
                            {' · '}{new Date(d.repayment_due_date).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-bold text-destructive">{formatCurrency(d.outstanding_balance)}</p>
                          <p className="text-[10px] text-muted-foreground">remaining</p>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Repaid: {formatCurrency(repaid)}</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Chama Groups */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
          <Card className="border-border/50">
            <CardHeader className="flex-row items-center justify-between px-2.5 sm:px-3 pt-2.5 pb-2">
              <div>
                <CardTitle className="text-xs flex items-center gap-2">
                  <Users size={13} className="text-primary" />
                  My Chama Groups
                </CardTitle>
                <CardDescription className="text-[10px]">Your savings groups</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => navigate('/dashboard/chama')}>
                View All <ArrowUpRight size={11} />
              </Button>
            </CardHeader>
            <CardContent className="px-2.5 sm:px-3 pb-2.5">
              {chamaGroups.length === 0 ? (
                <EmptyState icon={Users} title="No Chama groups yet" description="Create or join a savings group" actionLabel="Create Group" onAction={() => navigate('/dashboard/chama')} />
              ) : (
                <div className="space-y-1.5">
                  {chamaGroups.slice(0, 3).map((group) => (
                    <Link key={group.id} to={`/dashboard/chama/${group.id}`}>
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="text-primary" size={14} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-xs truncate">{group.name}</p>
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
                        <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Applications - now full width since Profile Completion was removed */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-border/50 h-full">
            <CardHeader className="flex-row items-center justify-between px-2.5 sm:px-3 pt-2.5 pb-2">
              <div>
                <CardTitle className="text-xs">Recent Applications</CardTitle>
                <CardDescription className="text-[10px]">Your latest loan activity</CardDescription>
              </div>
              {applications.length > 0 && (
                <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => navigate('/dashboard/applications')}>
                  View All <ArrowUpRight size={11} />
                </Button>
              )}
            </CardHeader>
            <CardContent className="px-2.5 sm:px-3 pb-2.5">
              {applications.length === 0 ? (
                <EmptyState icon={FileText} title="No applications yet" description="Start your journey by applying for a loan" actionLabel="Browse Products" onAction={() => navigate('/dashboard/products')} />
              ) : (
                <div className="space-y-1.5">
                  {applications.map((app) => (
                    <div
                      key={app.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors cursor-pointer"
                      onClick={() => navigate('/dashboard/applications')}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <CreditCard className="text-primary" size={14} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-xs capitalize truncate">{app.loan_type.replace('_', ' ')} Loan</p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(app.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <p className="font-semibold text-[10px] hidden sm:block">{formatCurrency(app.applied_amount)}</p>
                        <StatusBadge status={app.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Messages */}
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
              <div key={notif.id} className={`p-2.5 rounded-xl border transition-all ${!notif.is_read ? 'border-l-4 border-l-accent border-border/50 bg-accent/5' : 'border-border/40 bg-muted/30'}`}>
                <div className="flex items-start gap-2">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${accentClass}`}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="font-semibold text-[11px] truncate">{notif.title}</h4>
                      {!notif.is_read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{displayMessage}</p>
                    {isDocRequest && (
                      <Button variant="outline" size="sm" className="mt-1.5 text-[10px] h-6 px-2" onClick={() => navigate('/dashboard/account')}>
                        <Upload size={9} className="mr-1" /> Upload Documents
                      </Button>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
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
            <div className="grid gap-1.5 sm:gap-2 lg:grid-cols-2">
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
                <Card className="border-border/50 h-full">
                  <CardHeader className="flex-row items-center justify-between px-2.5 sm:px-3 pt-2.5 pb-2">
                    <div>
                      <CardTitle className="text-xs flex items-center gap-2">
                        <MessageSquare size={13} className="text-accent" />
                        Support & Admin
                      </CardTitle>
                      <CardDescription className="text-[10px]">Loan updates & account alerts</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => navigate('/dashboard/notifications')}>
                      View All <ArrowUpRight size={11} />
                    </Button>
                  </CardHeader>
                  <CardContent className="px-2.5 sm:px-3 pb-2.5 space-y-1.5">
                    {supportNotifs.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">No support messages</p>
                    ) : (
                      supportNotifs.slice(0, 4).map((notif) => {
                        const isDocRequest = notif.message.startsWith('[DOCUMENT_REQUEST]');
                        return renderNotif(
                          notif,
                          isDocRequest ? <Upload size={11} className="text-primary" /> : <MessageSquare size={11} className="text-accent" />,
                          isDocRequest ? 'bg-primary/10' : 'bg-accent/10'
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="border-border/50 h-full">
                  <CardHeader className="flex-row items-center justify-between px-2.5 sm:px-3 pt-2.5 pb-2">
                    <div>
                      <CardTitle className="text-xs flex items-center gap-2">
                        <Users size={13} className="text-primary" />
                        Chama Updates
                      </CardTitle>
                      <CardDescription className="text-[10px]">Group activity & reminders</CardDescription>
                    </div>
                    <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => navigate('/dashboard/chama')}>
                      View All <ArrowUpRight size={11} />
                    </Button>
                  </CardHeader>
                  <CardContent className="px-2.5 sm:px-3 pb-2.5 space-y-1.5">
                    {chamaUpdates.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">No chama updates</p>
                    ) : (
                      chamaUpdates.slice(0, 4).map((update) => {
                        const group = chamaGroups.find(g => g.id === update.group_id);
                        const groupName = group?.name || 'Chama';
                        let icon, accentClass, title, message;
                        if (update._type === 'announcement') {
                          icon = <Bell size={11} className="text-accent" />;
                          accentClass = 'bg-accent/10';
                          title = `📢 ${update.title}`;
                          message = `${groupName}: ${update.message?.slice(0, 60)}${(update.message?.length || 0) > 60 ? '…' : ''}`;
                        } else if (update._type === 'meeting') {
                          icon = <Clock size={11} className="text-primary" />;
                          accentClass = 'bg-primary/10';
                          title = `📅 ${update.title}`;
                          message = `${groupName} · ${new Date(update.created_at).toLocaleDateString('en-KE', { weekday: 'short', month: 'short', day: 'numeric' })}`;
                        } else {
                          icon = <PiggyBank size={11} className="text-emerald-500" />;
                          accentClass = 'bg-emerald-500/10';
                          title = `💰 Contribution`;
                          message = `${groupName} · KES ${Number(update.amount).toLocaleString()}`;
                        }
                        return (
                          <div key={update.id} className="p-2.5 rounded-xl border border-border/40 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                            onClick={() => group && navigate(`/dashboard/chama/${group.id}`)}>
                            <div className="flex items-start gap-2">
                              <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${accentClass}`}>
                                {icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold truncate">{title}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{message}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(update.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          );
        })()}

        {/* Download App Banner */}
        {!isInstalled && canInstall && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.31 }}>
            <button
              onClick={() => promptInstall()}
              className="w-full rounded-xl bg-accent text-accent-foreground p-2.5 flex items-center gap-2.5 shadow-gold hover:bg-accent/90 transition-colors cursor-pointer"
            >
              <Download size={16} className="shrink-0" />
              <div className="text-left flex-1 min-w-0">
                <p className="font-bold text-xs">Download Dasnet App</p>
                <p className="text-[10px] opacity-80">Tap to install — faster access & notifications</p>
              </div>
              <ArrowRight size={12} className="shrink-0 opacity-70" />
            </button>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }}>
          <LoanCalculator />
        </motion.div>

        {/* Loan Products */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <h2 className="font-display text-xs font-bold">Available Products</h2>
              <p className="text-[10px] text-muted-foreground">Choose a loan product that fits your needs</p>
            </div>
            <Button variant="ghost" size="sm" className="text-[11px] h-7 px-2" onClick={() => navigate('/dashboard/products')}>
              See All <ArrowUpRight size={11} />
            </Button>
          </div>
          <div className="grid gap-1.5 sm:gap-2 md:grid-cols-2 lg:grid-cols-3">
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
