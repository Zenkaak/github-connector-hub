import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ShieldCheck, FileText, Wallet, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Overview', icon: LayoutDashboard, path: '/dashboard/admin' },
  { label: 'Users', icon: Users, path: '/dashboard/admin/users' },
  { label: 'KYC', icon: ShieldCheck, path: '/dashboard/admin/kyc' },
  { label: 'Loans', icon: FileText, path: '/dashboard/admin/loans' },
  { label: 'M-Pesa', icon: Wallet, path: '/dashboard/admin/mpesa' },
];

export function AdminBottomNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-card/95 backdrop-blur-xl border-t border-border z-50 flex items-center justify-around px-1 safe-area-bottom">
      {navItems.map((item) => {
        const isActive = location.pathname === item.path;
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 py-1 rounded-lg transition-colors relative',
              isActive ? 'text-accent' : 'text-muted-foreground'
            )}
          >
            {isActive && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-accent rounded-full" />}
            <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span className={cn('text-[10px]', isActive && 'font-semibold')}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
