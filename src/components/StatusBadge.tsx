import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected' | 'disbursed' | 'active' | 'inactive';
  className?: string;
  icon?: LucideIcon;
}

const statusStyles = {
  pending: 'bg-gold-100 text-gold-600 border-gold-200',
  approved: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-red-100 text-red-600 border-red-200',
  disbursed: 'bg-blue-100 text-blue-600 border-blue-200',
  active: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  inactive: 'bg-gray-100 text-gray-600 border-gray-200',
};

const statusLabels = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  disbursed: 'Disbursed',
  active: 'Active',
  inactive: 'Inactive',
};

export function StatusBadge({ status, className, icon: Icon }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border',
        statusStyles[status],
        className
      )}
    >
      {Icon && <Icon size={12} />}
      {statusLabels[status]}
    </span>
  );
}
