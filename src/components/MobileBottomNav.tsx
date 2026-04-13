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
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border/50 z-50 safe-area-bottom">
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
                'flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5 transition-colors relative',
                isActive ? 'text-accent' : 'text-muted-foreground'
              )}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-accent" />
              )}
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span
                className={cn(
                  'text-[10px] leading-tight truncate max-w-full',
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
 
