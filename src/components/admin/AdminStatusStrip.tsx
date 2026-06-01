import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, ShieldCheck, PiggyBank, Activity, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Counts {
  pendingKyc: number;
  unmappedMpesa: number;
  pendingWithdrawals: number;
}

/**
 * Persistent operational pulse — live counts of items needing attention.
 * Shown directly below the admin top bar so urgent work is always visible.
 */
export function AdminStatusStrip() {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<Counts>({ pendingKyc: 0, unmappedMpesa: 0, pendingWithdrawals: 0 });
  const [healthy, setHealthy] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [kyc, mpesa, withdraws] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
          supabase.from('paybill_transactions').select('id', { count: 'exact', head: true }).eq('status', 'unmatched'),
          supabase.from('wallet_withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ]);
        if (!mounted) return;
        setCounts({
          pendingKyc: kyc.count ?? 0,
          unmappedMpesa: mpesa.count ?? 0,
          pendingWithdrawals: withdraws.count ?? 0,
        });
        setHealthy(true);
      } catch {
        if (mounted) setHealthy(false);
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const items = [
    { label: 'Pending KYC',       count: counts.pendingKyc,         icon: ShieldCheck, path: '/dashboard/admin/kyc',         tone: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Unmapped M-Pesa',   count: counts.unmappedMpesa,      icon: AlertCircle, path: '/dashboard/admin/mpesa',       tone: 'text-red-600 dark:text-red-400',     bg: 'bg-red-500/10' },
    { label: 'Withdrawals',       count: counts.pendingWithdrawals, icon: PiggyBank,   path: '/dashboard/admin/withdrawals', tone: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-500/10' },
  ];

  return (
    <div className="border-b border-border/50 bg-card/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 px-4 lg:px-8 h-10 overflow-x-auto no-scrollbar">
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => navigate(it.path)}
            className={cn(
              'inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0',
              it.count > 0 ? `${it.bg} ${it.tone} hover:opacity-80` : 'text-muted-foreground/70 hover:bg-muted/60'
            )}
          >
            <it.icon size={12} strokeWidth={2.2} />
            <span>{it.label}</span>
            <span className={cn(
              'tabular-nums text-[10.5px] px-1.5 py-0.5 rounded-md',
              it.count > 0 ? 'bg-white/40 dark:bg-black/30' : 'bg-muted/60'
            )}>{it.count}</span>
          </button>
        ))}
        <div className="flex-1" />
        <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-muted-foreground/80 whitespace-nowrap shrink-0">
          {healthy ? (
            <>
              <Activity size={11} className="text-emerald-500" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>All systems healthy</span>
            </>
          ) : (
            <>
              <Wifi size={11} className="text-red-500" />
              <span>Connection issue</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
