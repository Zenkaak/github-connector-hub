import { Search, Download, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FilterOption<T extends string = string> {
  key: T;
  label: string;
  count?: number;
}

interface AdminToolbarProps<T extends string = string> {
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption<T>[];
  activeFilter?: T;
  onFilterChange?: (k: T) => void;
  onExport?: () => void;
  exportLabel?: string;
  rightSlot?: React.ReactNode;
  className?: string;
}

/** Reusable admin toolbar: search + filter chips + export CSV. */
export function AdminToolbar<T extends string = string>({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters,
  activeFilter,
  onFilterChange,
  onExport,
  exportLabel = 'Export CSV',
  rightSlot,
  className,
}: AdminToolbarProps<T>) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {(onSearchChange || onExport || rightSlot) && (
        <div className="flex flex-col sm:flex-row gap-2">
          {onSearchChange && (
            <div className="relative flex-1 min-w-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search || ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 pr-9 bg-card border-border"
              />
              {search && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 shrink-0">
            {rightSlot}
            {onExport && (
              <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
                <Download size={14} /> {exportLabel}
              </Button>
            )}
          </div>
        </div>
      )}

      {filters && filters.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 no-scrollbar">
          {filters.map((f) => {
            const active = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => onFilterChange?.(f.key)}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border',
                  active
                    ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                    : 'bg-card text-foreground border-border hover:border-accent/40'
                )}
              >
                {f.label}
                {f.count !== undefined && (
                  <span className={cn('ml-1.5 text-[11px]', active ? 'opacity-70' : 'text-muted-foreground')}>
                    {f.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Helper to convert an array of records to a CSV file and trigger download.
 * Pass an array of column definitions describing how to extract values.
 */
export function exportToCsv<T extends Record<string, any>>(
  filename: string,
  rows: T[],
  columns: { header: string; get: (row: T) => string | number | null | undefined }[],
) {
  if (!rows.length) return;
  const escape = (v: any) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  };
  const header = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escape(c.get(r))).join(',')).join('\n');
  const csv = `${header}\n${body}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
