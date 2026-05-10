import { useNavigate } from 'react-router-dom';
import { ShieldCheck, FileText, Send, Wallet, PiggyBank, Heart, Users, Settings, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAction {
  label: string;
  icon: LucideIcon;
  path: string;
  tone: 'gold' | 'emerald' | 'red' | 'blue' | 'violet';
  count?: number;
}

const TONES: Record<QuickAction['tone'], { ring: string; text: string; bg: string }> = {
  gold:    { ring: 'ring-amber-500/30',   text: 'text-amber-500',   bg: 'bg-amber-500/10' },
  emerald: { ring: 'ring-emerald-500/30', text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  red:     { ring: 'ring-red-500/30',     text: 'text-red-500',     bg: 'bg-red-500/10' },
  blue:    { ring: 'ring-blue-500/30',    text: 'text-blue-500',    bg: 'bg-blue-500/10' },
  violet:  { ring: 'ring-violet-500/30',  text: 'text-violet-500',  bg: 'bg-violet-500/10' },
};

interface Props {
  pendingKyc?: number;
  pendingLoans?: number;
  pendingWithdrawals?: number;
  pendingHarambees?: number;
  unmappedMpesa?: number;
}

export function AdminQuickActions({
  pendingKyc = 0,
  pendingLoans = 0,
  pendingWithdrawals = 0,
  pendingHarambees = 0,
  unmappedMpesa = 0,
}: Props) {
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    { label: 'Review KYC',        icon: ShieldCheck, path: '/dashboard/admin/kyc',                     tone: 'gold',    count: pendingKyc },
    { label: 'Approve Loans',     icon: FileText,    path: '/dashboard/admin/loans',                   tone: 'emerald', count: pendingLoans },
    { label: 'Withdrawals',       icon: PiggyBank,   path: '/dashboard/admin/withdrawals',             tone: 'blue',    count: pendingWithdrawals },
    { label: 'Harambee Apps',     icon: Heart,       path: '/dashboard/admin/harambee-applications',   tone: 'violet',  count: pendingHarambees },
    { label: 'M-Pesa Reconcile',  icon: Wallet,      path: '/dashboard/admin/mpesa',                   tone: 'red',     count: unmappedMpesa },
    { label: 'Send Transfer',     icon: Send,        path: '/dashboard/admin/transfers',               tone: 'emerald' },
    { label: 'Manage Users',      icon: Users,       path: '/dashboard/admin/users',                   tone: 'gold' },
    { label: 'Settings',          icon: Settings,    path: '/dashboard/admin/settings',                tone: 'blue' },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Quick actions</h3>
        <span className="text-[11px] text-muted-foreground">Tap to jump in</span>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {actions.map((a) => {
          const t = TONES[a.tone];
          return (
            <button
              key={a.label}
              onClick={() => navigate(a.path)}
              className="group flex flex-col items-center gap-2 p-2.5 rounded-xl border border-border bg-background hover:border-accent/50 hover:-translate-y-0.5 transition-all relative"
            >
              {a.count !== undefined && a.count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {a.count > 99 ? '99+' : a.count}
                </span>
              )}
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center ring-1', t.bg, t.ring, t.text)}>
                <a.icon size={18} />
              </div>
              <span className="text-[10.5px] font-semibold text-foreground text-center leading-tight">{a.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
