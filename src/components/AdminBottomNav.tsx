import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Wallet,
  Users2,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, path: '/dashboard/admin' },
  { label: 'Members',  icon: Users,            path: '/dashboard/admin/users' },
  { label: 'Finance',  icon: Wallet,            path: '/dashboard/admin/mpesa' },
  { label: 'Chamas',   icon: Users2,            path: '/dashboard/admin/chama' },
  { label: 'KYC',      icon: ShieldCheck,       path: '/dashboard/admin/kyc' },
];

export function AdminBottomNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0d1117]/98 backdrop-blur-xl border-t border-white/[0.06] safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1 flex-1 h-full rounded-xl transition-all duration-200',
                isActive ? 'text-accent' : 'text-white/30 active:text-white/55',
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-accent" />
              )}
              <item.icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.6}
                className={cn(
                  'transition-all duration-200',
                  isActive && 'drop-shadow-[0_0_6px_hsl(42_92%_56%_/_0.7)] scale-110',
                )}
              />
              <span
                className={cn(
                  'text-[9px] uppercase tracking-[0.08em] font-medium transition-all',
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
