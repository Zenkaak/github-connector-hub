import { LucideIcon } from 'lucide-react';

interface AdminSectionHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export function AdminSectionHeader({ title, description, icon: Icon, actions }: AdminSectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="flex items-start gap-3 min-w-0">
        {Icon && (
          <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">{title}</h1>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
