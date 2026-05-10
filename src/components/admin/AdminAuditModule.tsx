import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, Loader2 } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminToolbar, exportToCsv } from './AdminToolbar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function AdminAuditModule() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('id, action, admin_id, user_id, details, created_at')
        .order('created_at', { ascending: false }).limit(500);
      setLogs(data || []); setLoading(false);
    })();
  }, []);

  const actions = useMemo(() => {
    const counts = new Map<string, number>();
    logs.forEach((l) => counts.set(l.action, (counts.get(l.action) || 0) + 1));
    return [
      { key: 'all', label: 'All', count: logs.length },
      ...[...counts.entries()].slice(0, 6).map(([k, c]) => ({ key: k, label: k, count: c })),
    ];
  }, [logs]);

  const filtered = useMemo(() => logs.filter((l) => {
    if (filter !== 'all' && l.action !== filter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return l.action?.toLowerCase().includes(q) || JSON.stringify(l.details || {}).toLowerCase().includes(q);
  }), [logs, filter, search]);

  const handleExport = () => {
    exportToCsv(`audit-${format(new Date(), 'yyyy-MM-dd')}`, filtered, [
      { header: 'Action',   get: (l) => l.action },
      { header: 'Admin',    get: (l) => l.admin_id || '' },
      { header: 'User',     get: (l) => l.user_id || '' },
      { header: 'Details',  get: (l) => JSON.stringify(l.details || {}) },
      { header: 'Date',     get: (l) => format(new Date(l.created_at), 'yyyy-MM-dd HH:mm:ss') },
    ]);
  };

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Audit Logs" description={`${logs.length} entries · system-wide activity`} icon={ClipboardList} />

      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search action or details…"
        filters={actions}
        activeFilter={filter}
        onFilterChange={setFilter}
        onExport={filtered.length ? handleExport : undefined}
      />

      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div> :
       filtered.length === 0 ? <AdminEmptyState icon={ClipboardList} title="No matching logs" /> : (
        <Card className="divide-y divide-border">
          {filtered.map((l) => (
            <div key={l.id} className="p-3 flex items-start gap-3 hover:bg-muted/60 transition-colors">
              <Badge variant="outline" className="text-[10px] shrink-0 font-mono">{l.action}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{format(new Date(l.created_at), 'MMM d, yyyy HH:mm:ss')}</p>
                {l.details && Object.keys(l.details).length > 0 && (
                  <pre className="text-[10px] text-muted-foreground bg-muted/60 p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(l.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
