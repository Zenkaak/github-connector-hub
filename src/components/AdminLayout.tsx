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
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'A';

  const currentLabel = navSections
    .flatMap((s) => s.items)
    .find((i) => i.path === location.pathname)?.label || 'Admin Panel';

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card/95 backdrop-blur-xl border-b border-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-destructive/90 flex items-center justify-center">
            <Shield size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-foreground">{currentLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <AdminAlertsPopover />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-[#0d1117] z-40 transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] flex flex-col border-r border-white/[0.05]',
          'lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo area */}
        <div className="h-16 flex items-center px-5 border-b border-white/[0.06] shrink-0">
          <Logo size="md" variant="white" />
        </div>

        {/* Admin profile chip */}
        <div className="mx-3 mt-4 mb-3 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.07] flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-red-500/80 to-red-700/80 flex items-center justify-center shrink-0">
            <Shield size={16} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white text-[13px] truncate leading-tight">{profile?.full_name || 'Admin'}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-[10px] text-white/40 uppercase tracking-wider font-medium">Super Admin</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-1 space-y-4">
          {navSections.map((section) => (
            <div key={section.label}>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/20 px-2 mb-1">{section.label}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        'group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-all duration-150 text-[13px]',
                        isActive
                          ? 'bg-accent/90 text-black font-semibold shadow-sm'
                          : 'text-white/45 hover:bg-white/[0.05] hover:text-white/75'
                      )}
                    >
                      <item.icon size={15} strokeWidth={isActive ? 2.5 : 1.8} className="shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom sign out */}
        <div className="p-3 border-t border-white/[0.06] shrink-0">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-white/35 hover:text-white/65 hover:bg-white/[0.05] transition-all text-[13px]"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        {/* Desktop Top Bar */}
        <div className="hidden lg:flex items-center justify-between h-16 px-8 border-b border-border bg-card/70 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-destructive/80 flex items-center justify-center">
              <Shield size={13} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-foreground">{currentLabel}</p>
          </div>
          <div className="flex items-center gap-3">
            <AdminAlertsPopover />
            <div className="w-px h-5 bg-border" />
            <button className="flex items-center gap-2 hover:bg-muted/60 px-2 py-1.5 rounded-lg transition-colors">
              <div className="w-7 h-7 rounded-lg bg-destructive/80 flex items-center justify-center text-white text-[11px] font-bold">
                {initials}
              </div>
              <div className="text-left">
                <p className="text-[12px] font-semibold leading-tight text-foreground">{profile?.full_name?.split(' ')[0] || 'Admin'}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">Administrator</p>
              </div>
              <ChevronDown size={12} className="text-muted-foreground ml-1" />
            </button>
            <div className="w-px h-5 bg-border" />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={handleSignOut}>
              <LogOut size={16} />
            </Button>
          </div>
        </div>

        <div className="pt-14 lg:pt-0 pb-20 lg:pb-0">{children}</div>
      </main>

      {/* Mobile Bottom Nav */}
      <AdminBottomNav />
    </div>
  );
}
