import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, Loader2 } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function AdminAuditModule() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('audit_logs')
        .select('id, action, admin_id, user_id, details, created_at')
        .order('created_at', { ascending: false }).limit(200);
      setLogs(data || []); setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="Audit Logs" description="System activity history" icon={ClipboardList} />
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div> :
       logs.length === 0 ? <AdminEmptyState icon={ClipboardList} title="No audit logs" /> : (
        <Card className="divide-y divide-border">
          {logs.map((l) => (
            <div key={l.id} className="p-3 flex items-start gap-3">
              <Badge variant="outline" className="text-[10px] shrink-0">{l.action}</Badge>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{format(new Date(l.created_at), 'MMM d, yyyy HH:mm:ss')}</p>
                {l.details && <pre className="text-[10px] text-muted-foreground bg-muted/60 p-2 rounded mt-1 overflow-x-auto">{JSON.stringify(l.details, null, 2)}</pre>}
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
