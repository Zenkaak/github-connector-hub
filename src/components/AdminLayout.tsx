import { useState } from 'react';
import { AdminBottomNav } from '@/components/AdminBottomNav';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  ShieldCheck,
  ClipboardList,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Shield,
  Wallet,
  Send,
  PiggyBank,
  Settings,
  Activity,
  Heart,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { AdminAlertsPopover } from '@/components/admin/AdminAlertsPopover';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const adminNavItems = [
  { label: 'Overview', icon: LayoutDashboard, path: '/dashboard/admin' },
  { label: 'Users', icon: Users, path: '/dashboard/admin/users' },
  { label: 'KYC Reviews', icon: ShieldCheck, path: '/dashboard/admin/kyc' },
  { label: 'Loans', icon: FileText, path: '/dashboard/admin/loans' },
  { label: 'Transfers', icon: Send, path: '/dashboard/admin/transfers' },
  { label: 'M-Pesa', icon: Wallet, path: '/dashboard/admin/mpesa' },
  { label: 'Withdrawals', icon: PiggyBank, path: '/dashboard/admin/withdrawals' },
  { label: 'Chamas', icon: Users, path: '/dashboard/admin/chama' },
  { label: 'MGR Cycles', icon: Activity, path: '/dashboard/admin/mgr' },
  { label: 'Harambee Apps', icon: Heart, path: '/dashboard/admin/harambee-applications' },
  { label: 'Audit Logs', icon: ClipboardList, path: '/dashboard/admin/audit' },
  { label: 'Broadcast', icon: Megaphone, path: '/dashboard/admin/broadcast' },
  { label: 'Settings', icon: Settings, path: '/dashboard/admin/settings' },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const initials = profile?.full_name
    ?.split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'A';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-xl border-b border-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Shield size={18} className="text-accent" />
          <span className="font-bold text-sm">Admin Panel</span>
        </div>
        <div className="flex items-center gap-1">
          <AdminAlertsPopover />
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

        {/* Admin Badge */}
        <div className="mx-4 mt-5 mb-2 p-4 rounded-2xl bg-white/[0.05] border border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-destructive/80 flex items-center justify-center text-white font-bold text-sm">
              <Shield size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm truncate">{profile?.full_name || 'Admin'}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[11px] text-red-300/80">Administrator</span>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25 px-3 mb-2">Admin Menu</p>
          {adminNavItems.map((item) => {
            const isActive = location.pathname === item.path;
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
                {isActive && <ChevronRight size={14} className="ml-auto opacity-60" />}
              </Link>
            );
          })}
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
        <div className="hidden lg:flex items-center justify-between h-[72px] px-8 border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-destructive" />
            <p className="text-sm font-semibold text-foreground">Admin Panel</p>
          </div>
          <div className="flex items-center gap-2.5">
            <AdminAlertsPopover />
            <div className="w-px h-6 bg-border" />
            <div className="w-8 h-8 rounded-lg bg-destructive/80 flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="text-sm">
              <p className="font-medium leading-tight text-foreground">{profile?.full_name?.split(' ')[0] || 'Admin'}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Administrator</p>
            </div>
            <div className="w-px h-6 bg-border ml-2" />
            <Button variant="ghost" size="icon" onClick={handleSignOut} className="text-muted-foreground hover:text-destructive">
              <LogOut size={18} />
            </Button>
          </div>
        </div>

        <div className="pt-16 lg:pt-0 pb-20 lg:pb-0">{children}</div>
      </main>

      {/* Mobile Bottom Nav */}
      <AdminBottomNav />
    </div>
  );
}
