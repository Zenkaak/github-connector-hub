import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface AdminStatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon: LucideIcon;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent';
  trend?: { value: number; label: string };
  onClick?: () => void;
}

const toneStyles = {
  default: 'bg-muted/40 text-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-destructive/10 text-destructive',
  accent: 'bg-accent/10 text-accent',
};

export function AdminStatCard({ label, value, sublabel, icon: Icon, tone = 'default', trend, onClick }: AdminStatCardProps) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'p-5 transition-all duration-200',
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold text-foreground tabular-nums truncate">{value}</p>
          {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
          {trend && (
            <p className={cn('mt-1.5 text-xs font-semibold', trend.value >= 0 ? 'text-success' : 'text-destructive')}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center shrink-0', toneStyles[tone])}>
          <Icon size={20} />
        </div>
      </div>
    </Card>
  );
}
