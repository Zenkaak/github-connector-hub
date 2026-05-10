import { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AdminKpiCardProps {
  label: string;
  value: string | number;
  delta?: number;
  icon: LucideIcon;
  accent?: 'gold' | 'emerald' | 'red' | 'blue' | 'violet';
  onClick?: () => void;
  hint?: string;
}

const ACCENTS: Record<string, { bg: string; ring: string; text: string }> = {
  gold:    { bg: 'from-amber-500/15 to-amber-500/0',    ring: 'ring-amber-500/20',    text: 'text-amber-600' },
  emerald: { bg: 'from-emerald-500/15 to-emerald-500/0', ring: 'ring-emerald-500/20', text: 'text-emerald-600' },
  red:     { bg: 'from-red-500/15 to-red-500/0',         ring: 'ring-red-500/20',     text: 'text-red-600' },
  blue:    { bg: 'from-blue-500/15 to-blue-500/0',       ring: 'ring-blue-500/20',    text: 'text-blue-600' },
  violet:  { bg: 'from-violet-500/15 to-violet-500/0',   ring: 'ring-violet-500/20',  text: 'text-violet-600' },
};

export function AdminKpiCard({ label, value, delta, icon: Icon, accent = 'gold', onClick, hint }: AdminKpiCardProps) {
  const a = ACCENTS[accent];
  const positive = (delta ?? 0) >= 0;
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      className={cn(
        'group text-left bg-card border border-border rounded-xl p-4 relative overflow-hidden w-full',
        onClick && 'hover:border-accent/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200'
      )}
    >
      <div className={cn('absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br opacity-60', a.bg)} />
      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('w-9 h-9 rounded-lg bg-background flex items-center justify-center ring-1', a.ring, a.text)}>
            <Icon size={16} />
          </div>
          {delta !== undefined && (
            <span className={cn(
              'text-[11px] font-bold inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded',
              positive ? 'text-emerald-600 bg-emerald-500/10' : 'text-red-600 bg-red-500/10'
            )}>
              {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {Math.abs(delta).toFixed(1)}%
            </span>
          )}
        </div>
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
        <p className="text-lg sm:text-xl md:text-2xl font-bold text-foreground mt-1 tracking-tight truncate">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </div>
    </Comp>
  );
}
