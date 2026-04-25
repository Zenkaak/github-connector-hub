import { LucideIcon } from 'lucide-react';

interface AdminEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export function AdminEmptyState({ icon: Icon, title, description }: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon size={24} className="text-muted-foreground" />
      </div>
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
    </div>
  );
}
