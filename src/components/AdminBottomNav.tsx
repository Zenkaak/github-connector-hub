import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Users2,
  ShieldCheck,
  FileText,
  Send,
  PiggyBank,
  Activity,
  Heart,
  Building2,
  Megaphone,
  ClipboardList,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Overview',   icon: LayoutDashboard, path: '/dashboard/admin' },
  { label: 'Users',      icon: Users,           path: '/dashboard/admin/users' },
  { label: 'KYC',        icon: ShieldCheck,     path: '/dashboard/admin/kyc' },
  { label: 'Loans',      icon: FileText,        path: '/dashboard/admin/loans' },
  { label: 'Transfers',  icon: Send,            path: '/dashboard/admin/transfers' },
  { label: 'M-Pesa',     icon: Wallet,          path: '/dashboard/admin/mpesa' },
  { label: 'Withdraw',   icon: PiggyBank,       path: '/dashboard/admin/withdrawals' },
  { label: 'Chamas',     icon: Users2,          path: '/dashboard/admin/chama' },
  { label: 'MGR',        icon: Activity,        path: '/dashboard/admin/mgr' },
  { label: 'Harambee',   icon: Heart,           path: '/dashboard/admin/harambee-applications' },
  { label: 'Tenants',    icon: Building2,       path: '/dashboard/admin/tenants' },
  { label: 'Broadcast',  icon: Megaphone,       path: '/dashboard/admin/broadcast' },
  { label: 'Audit',      icon: ClipboardList,   path: '/dashboard/admin/audit' },
  { label: 'Settings',   icon: Settings,        path: '/dashboard/admin/settings' },
];

export function AdminBottomNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0d1117]/98 backdrop-blur-xl border-t border-white/[0.06] safe-area-bottom">
      <div className="flex items-center gap-1 h-16 px-2 overflow-x-auto no-scrollbar">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 shrink-0 min-w-[64px] h-full rounded-xl px-2 transition-all duration-200',
                isActive ? 'text-accent' : 'text-white/40 active:text-white/70',
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-accent" />
              )}
              <item.icon
                size={19}
                strokeWidth={isActive ? 2.5 : 1.7}
                className={cn(
                  'transition-all duration-200',
                  isActive && 'drop-shadow-[0_0_6px_hsl(42_92%_56%_/_0.7)] scale-110',
                )}
              />
              <span
                className={cn(
                  'text-[9px] uppercase tracking-[0.06em] font-medium transition-all whitespace-nowrap',
                  isActive && 'font-bold text-accent',
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
