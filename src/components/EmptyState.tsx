import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/10 flex items-center justify-center mb-5 relative">
        <div className="absolute inset-0 rounded-3xl bg-accent/5 animate-pulse" />
        <Icon size={32} className="text-accent relative z-10" />
      </div>
      <h3 className="font-display text-lg font-bold mb-1.5 text-center">{title}</h3>
      <p className="text-sm text-muted-foreground text-center max-w-sm leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <Button variant="gold" size="sm" className="mt-5" onClick={onAction}>
          {actionLabel}
          <ArrowRight size={14} />
        </Button>
      )}
    </div>
  );
}
