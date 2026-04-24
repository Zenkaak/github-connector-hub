import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  User,
  Users,
  Settings,
  Wallet,
  Shield,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { MobileBottomNav } from '@/components/MobileBottomNav';
import { cn } from '@/lib/utils';
import { AccountDisabledBanner } from '@/components/AccountDisabledBanner';
import { KycPromptModal } from '@/components/KycPromptModal';

function AnnouncementBanner() {
  const { getSetting } = usePlatformSettings();
  const text = getSetting('announcement_text');
  if (!text) return null;
  return (
    <div className="bg-accent/10 border-b border-accent/20 px-4 py-2.5 text-center">
      <p className="text-sm font-medium text-accent">{text}</p>
    </div>
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Loan Products', icon: CreditCard, path: '/dashboard/products' },
  { label: 'Applications', icon: FileText, path: '/dashboard/applications' },
  { label: 'Chama Groups', icon: Users, path: '/dashboard/chama' },
  { label: 'Wallet', icon: Wallet, path: '/dashboard/wallet' },
  { label: 'Savings', icon: Wallet, path: '/dashboard/savings' },
  { label: 'Transactions', icon: CreditCard, path: '/dashboard/transactions' },
  { label: 'Notifications', icon: Bell, path: '/dashboard/notifications' },
  { label: 'My Account', icon: User, path: '/dashboard/account' },
  { label: 'Settings', icon: Settings, path: '/dashboard/settings' },
  { label: 'Support', icon: MessageSquare, path: '/dashboard/support' },
];

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { profile, user, isAdmin, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false)
        .then(({ count }) => setUnreadCount(count || 0));
    }
  }, [user, location.pathname]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'User';
  const initials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'U';

  const allNavItems = isAdmin
    ? [...navItems, { label: 'Admin Panel', icon: Shield, path: '/dashboard/admin' }]
    : navItems;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-xl border-b z-50 flex items-center justify-between px-4">
        <Link to="/dashboard">
          <Logo size="sm" />
        </Link>
        <div className="flex items-center gap-1">
          <Link to="/dashboard/notifications">
            <Button variant="ghost" size="icon" className="relative">
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>
          </Link>
          <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-destructive">
            <LogOut size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-[272px] bg-primary z-40 transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="h-[72px] flex items-center px-6 border-b border-white/[0.06]">
          <Logo size="md" variant="white" />
        </div>

        {/* User Card */}
        <div className="mx-4 mt-5 mb-2 p-4 rounded-2xl bg-white/[0.05] border border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm shadow-gold">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm truncate">{profile?.full_name || 'User'}</p>
              {profile?.phone && (
                <p className="text-[11px] text-white/40 truncate flex items-center gap-1">
                  <Phone size={10} />
                  {profile.phone}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-0.5">
                {profile?.is_active ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] text-emerald-300/80">Active</span>
                  </>
                ) : (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
                    <span className="text-[11px] text-gold-300/80">Inactive</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 px-3 mb-2">Menu</p>
          {allNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isNotif = item.path === '/dashboard/notifications';
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'group flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 relative',
                  isActive
                    ? 'bg-accent text-accent-foreground font-semibold shadow-gold/20 shadow-md'
                    : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
                )}
              >
                <item.icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className="text-sm">{item.label}</span>
                {isNotif && unreadCount > 0 && !isActive && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
              </Link>
            );
          })}

          {!profile?.is_active && (
            <>
              <div className="my-4 mx-3 border-t border-white/[0.06]" />
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  navigate('/dashboard/applications', { state: { showActivation: true } });
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-all"
              >
                <Sparkles size={18} />
                <div className="text-left">
                  <p className="text-sm font-semibold">Activate Account</p>
                  <p className="text-[11px] text-accent/60">Pay KES 349</p>
                </div>
              </button>
            </>
          )}
        </nav>

        {/* Bottom */}
        <div className="p-3 border-t border-white/[0.06]">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-all"
          >
            <LogOut size={18} />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-[272px] min-h-screen">
        {/* Desktop Top Bar */}
        <div className="hidden lg:flex items-center justify-between h-[72px] px-8 border-b bg-card/60 backdrop-blur-sm sticky top-0 z-20">
          <div>
            <p className="text-sm text-muted-foreground">
              Welcome back, <span className="font-semibold text-foreground">{firstName}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard/notifications">
              <Button variant="ghost" size="icon" className="relative">
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </Link>
            <div className="w-px h-6 bg-border" />
            <Link to="/dashboard/account" className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-muted transition-colors">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                {initials}
              </div>
              <div className="text-sm">
                <p className="font-medium leading-tight">{firstName}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {profile?.phone || (profile?.is_active ? 'Active' : 'Inactive')}
                </p>
              </div>
            </Link>
            <div className="w-px h-6 bg-border" />
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-destructive">
              <LogOut size={18} />
            </Button>
          </div>
        </div>

        <AnnouncementBanner />
        <AccountDisabledBanner />
        <div className="pt-16 lg:pt-0 pb-20 lg:pb-0">{children}</div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />

      {/* KYC verification prompt (soft) */}
      <KycPromptModal />
    </div>
  );
}
