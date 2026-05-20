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
  Shield,
  Wallet,
  Send,
  PiggyBank,
  Settings,
  Activity,
  Heart,
  Megaphone,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { AdminAlertsPopover } from '@/components/admin/AdminAlertsPopover';
import { cn } from '@/lib/utils';

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navSections = [
  {
    label: 'Dashboard',
    items: [
      { label: 'Overview', icon: LayoutDashboard, path: '/dashboard/admin' },
    ],
  },
  {
    label: 'Members',
    items: [
      { label: 'Users', icon: Users, path: '/dashboard/admin/users' },
      { label: 'KYC Reviews', icon: ShieldCheck, path: '/dashboard/admin/kyc' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Loans', icon: FileText, path: '/dashboard/admin/loans' },
      { label: 'Transfers', icon: Send, path: '/dashboard/admin/transfers' },
      { label: 'M-Pesa', icon: Wallet, path: '/dashboard/admin/mpesa' },
      { label: 'Withdrawals', icon: PiggyBank, path: '/dashboard/admin/withdrawals' },
    ],
  },
  {
    label: 'Community',
    items: [
      { label: 'Chamas', icon: Users, path: '/dashboard/admin/chama' },
      { label: 'MGR Cycles', icon: Activity, path: '/dashboard/admin/mgr' },
      { label: 'Harambee Apps', icon: Heart, path: '/dashboard/admin/harambee-applications' },
    ],
  },
  {
    label: 'Platform',
    items: [
      { label: 'SACCO Tenants', icon: Building2, path: '/dashboard/admin/tenants' },
      { label: 'Broadcast', icon: Megaphone, path: '/dashboard/admin/broadcast' },
      { label: 'Audit Logs', icon: ClipboardList, path: '/dashboard/admin/audit' },
      { label: 'Settings', icon: Settings, path: '/dashboard/admin/settings' },
    ],
  },
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
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'A';

  const currentLabel = navSections
    .flatMap((s) => s.items)
    .find((i) => i.path === location.pathname)?.label || 'Admin Panel';

  return (
    <div className="min-h-screen bg-background">

      {/* ── Mobile Top Bar ── */}
      <header className="lg:hidden fixed top-0 inset-x-0 h-14 z-50 flex items-center justify-between px-3 bg-[#0d1117] border-b border-white/[0.06]">
        {/* Hamburger left */}
        <button
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.06] active:bg-white/[0.12] transition-colors"
        >
          <Menu size={18} className="text-white/75" />
        </button>

        {/* Page label centre */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent flex items-center justify-center shadow-[0_0_14px_-2px_hsl(42_92%_56%_/_0.6)]">
            <Shield size={12} className="text-accent-foreground" />
          </div>
          <span className="font-semibold text-[13px] text-white/90 tracking-tight truncate max-w-[140px]">
            {currentLabel}
          </span>
        </div>

        {/* Alerts right */}
        <div className="flex items-center">
          <AdminAlertsPopover />
        </div>
      </header>

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-72 z-[60] flex flex-col',
          'bg-[#0d1117] border-r border-white/[0.05]',
          'transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'lg:w-64 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Sidebar header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-white/[0.06] shrink-0">
          <Logo size="md" variant="white" />
          <button
            aria-label="Close sidebar"
            className="lg:hidden w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={16} />
          </button>
        </div>

        {/* Admin profile chip */}
        <div className="mx-3 mt-4 mb-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-accent/70 to-accent flex items-center justify-center shrink-0 shadow-[0_0_16px_-4px_hsl(42_92%_56%_/_0.5)]">
            <span className="text-accent-foreground font-bold text-[13px] leading-none">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-[13px] truncate leading-tight">
              {profile?.full_name || 'Admin'}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Super Admin</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4 no-scrollbar">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/20 px-2 mb-1.5">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'group flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-150 text-[13px] font-medium',
                        isActive
                          ? 'bg-accent text-accent-foreground shadow-[0_2px_14px_-3px_hsl(42_92%_56%_/_0.45)]'
                          : 'text-white/45 hover:bg-white/[0.06] hover:text-white/80',
                      )}
                    >
                      <item.icon
                        size={15}
                        strokeWidth={isActive ? 2.5 : 1.8}
                        className="shrink-0"
                      />
                      <span className="flex-1">{item.label}</span>
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-foreground/50" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sign out */}
        <div className="p-3 border-t border-white/[0.06] shrink-0">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/35 hover:text-white/65 hover:bg-white/[0.05] transition-all text-[13px] font-medium"
          >
            <LogOut size={15} strokeWidth={1.8} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[55]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Main Content ── */}
      <main className="lg:ml-64 min-h-screen admin-light bg-background">

        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center justify-between h-16 px-8 border-b border-border/50 bg-card/60 backdrop-blur-xl sticky top-0 z-20">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/90 flex items-center justify-center shadow-[0_0_14px_-3px_hsl(42_92%_56%_/_0.5)]">
              <Shield size={13} className="text-accent-foreground" />
            </div>
            <span className="text-[14px] font-semibold text-foreground">{currentLabel}</span>
          </div>

          <div className="flex items-center gap-2">
            <AdminAlertsPopover />
            <div className="w-px h-5 bg-border mx-1" />

            {/* Admin avatar + name */}
            <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl hover:bg-muted/60 transition-colors">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-accent/70 to-accent flex items-center justify-center text-accent-foreground text-[11px] font-bold shadow-[0_2px_10px_-2px_hsl(42_92%_56%_/_0.4)]">
                {initials}
              </div>
              <div className="text-left">
                <p className="text-[12px] font-semibold leading-tight text-foreground">
                  {profile?.full_name?.split(' ')[0] || 'Admin'}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight">Super Admin</p>
              </div>
              <ChevronDown size={12} className="text-muted-foreground ml-0.5" />
            </button>

            <div className="w-px h-5 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              title="Sign out"
              className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={handleSignOut}
            >
              <LogOut size={16} />
            </Button>
          </div>
        </div>

        {/* Page content — top-pad for mobile bar, bottom-pad for mobile nav */}
        <div className="pt-14 lg:pt-0 pb-20 lg:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <AdminBottomNav />
    </div>
  );
}
