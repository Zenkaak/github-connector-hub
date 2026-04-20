import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, CreditCard, Users, User, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { label: 'Home', icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Products', icon: CreditCard, path: '/dashboard/products' },
  { label: 'Wallet', icon: Wallet, path: '/dashboard/wallet' },
  { label: 'Chama', icon: Users, path: '/dashboard/chama' },
  { label: 'Account', icon: User, path: '/dashboard/account' },
];

export function MobileBottomNav() {
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-primary border-t border-white/[0.06] z-50 safe-area-bottom shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.25)]">
      <div className="flex items-stretch justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive =
            item.path === '/dashboard'
              ? location.pathname === '/dashboard'
              : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5 transition-all duration-200 relative',
                isActive ? 'text-accent' : 'text-white/45 hover:text-white/70'
              )}
            >
              {isActive && (
                <>
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-b-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]" />
                  <span className="absolute inset-x-3 inset-y-1.5 rounded-xl bg-accent/[0.08]" />
                </>
              )}
              <item.icon
                size={20}
                strokeWidth={isActive ? 2.4 : 1.7}
                className="relative z-10"
              />
              <span
                className={cn(
                  'text-[10px] leading-tight truncate max-w-full relative z-10 tracking-wide',
                  isActive ? 'font-semibold' : 'font-medium'
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
