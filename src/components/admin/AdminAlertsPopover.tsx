import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Bell, ShieldCheck, FileText, PiggyBank, Wallet, Heart, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface Alert {
  key: string;
  label: string;
  count: number;
  path: string;
  icon: any;
  tone: 'gold' | 'red' | 'blue' | 'violet';
}

const TONE_BG: Record<Alert['tone'], string> = {
  gold:   'bg-amber-500/10 text-amber-500 ring-amber-500/30',
  red:    'bg-red-500/10 text-red-500 ring-red-500/30',
  blue:   'bg-blue-500/10 text-blue-500 ring-blue-500/30',
  violet: 'bg-violet-500/10 text-violet-500 ring-violet-500/30',
};

/** Realtime admin alerts popover — replaces the generic Bell. */
export function AdminAlertsPopover() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);

  const refresh = async () => {
    const [kyc, loans, withdrawals, unmapped, b2c, harambees] = await Promise.all([
      supabase.from('kyc_documents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('loan_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('chama_withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('mpesa_unmapped_payments').select('id', { count: 'exact', head: true }).eq('resolved', false),
      supabase.from('mpesa_b2c_requests').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
      supabase.from('harambee_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setAlerts([
      { key: 'kyc',         label: 'KYC documents awaiting review', count: kyc.count || 0,         path: '/dashboard/admin/kyc',                   icon: ShieldCheck,    tone: 'gold' },
      { key: 'loans',       label: 'Loan applications pending',     count: loans.count || 0,       path: '/dashboard/admin/loans',                 icon: FileText,       tone: 'gold' },
      { key: 'withdrawals', label: 'Withdrawal requests pending',   count: withdrawals.count || 0, path: '/dashboard/admin/withdrawals',           icon: PiggyBank,      tone: 'blue' },
      { key: 'unmapped',    label: 'Unmapped M-Pesa payments',      count: unmapped.count || 0,    path: '/dashboard/admin/mpesa',                 icon: Wallet,         tone: 'red' },
      { key: 'b2c',         label: 'Failed B2C payouts',            count: b2c.count || 0,         path: '/dashboard/admin/mpesa',                 icon: AlertTriangle,  tone: 'red' },
      { key: 'harambees',   label: 'Harambee applications pending', count: harambees.count || 0,   path: '/dashboard/admin/harambee-applications', icon: Heart,          tone: 'violet' },
    ]);
  };

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`admin-alerts-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kyc_documents' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'loan_applications' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chama_withdrawals' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mpesa_unmapped_payments' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mpesa_b2c_requests' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'harambee_applications' }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const total = alerts.reduce((s, a) => s + a.count, 0);
  const visible = alerts.filter((a) => a.count > 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`${total} alerts`}>
          <Bell size={18} />
          {total > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-background animate-pulse">
              {total > 99 ? '99+' : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-card">
          <p className="text-sm font-bold text-foreground">Operations alerts</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {total === 0 ? 'All clear — nothing waiting' : `${total} item${total === 1 ? '' : 's'} need attention`}
          </p>
        </div>
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border">
          {visible.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">You're caught up 🎉</div>
          ) : (
            visible.map((a) => (
              <button
                key={a.key}
                onClick={() => { setOpen(false); navigate(a.path); }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center ring-1 shrink-0', TONE_BG[a.tone])}>
                  <a.icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{a.count} {a.label.toLowerCase().includes('failed') ? 'failed' : 'pending'}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{a.label}</p>
                </div>
                <ArrowRight size={14} className="text-muted-foreground shrink-0" />
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
