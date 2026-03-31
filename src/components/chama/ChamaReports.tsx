import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Props {
  groupId: string;
  group: any;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string; phone: string } }>;
}

export function ChamaReports({ groupId, group, members }: Props) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const getMemberName = (userId: string) => members.find(m => m.user_id === userId)?.profile?.full_name || 'Unknown';
  const getMemberPhone = (userId: string) => members.find(m => m.user_id === userId)?.profile?.phone || '';

  const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Report downloaded!', description: filename });
  };

  const exportSavings = async () => {
    setDownloading('savings');
    try {
      const { data } = await supabase
        .from('chama_savings')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      if (!data || data.length === 0) {
        toast({ title: 'No data', description: 'No savings records found', variant: 'destructive' });
        return;
      }
      const headers = ['Member', 'Phone', 'Amount (KES)', 'Period Date', 'Reference', 'Date'];
      const rows = data.map(s => [
        getMemberName(s.user_id),
        getMemberPhone(s.user_id),
        String(s.amount),
        s.period_date,
        s.stk_reference || '',
        format(new Date(s.created_at), 'yyyy-MM-dd HH:mm'),
      ]);
      downloadCsv(`${group.name}_Savings`, headers, rows);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setDownloading(null); }
  };

  const exportMembers = async () => {
    setDownloading('members');
    try {
      const headers = ['Name', 'Phone', 'Role', 'Status'];
      const rows = members.map(m => [
        m.profile?.full_name || 'Unknown',
        m.profile?.phone || '',
        m.role,
        'Active',
      ]);
      downloadCsv(`${group.name}_Members`, headers, rows);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setDownloading(null); }
  };

  const exportContributions = async () => {
    setDownloading('contributions');
    try {
      const { data: harambees } = await supabase
        .from('chama_harambees')
        .select('id, beneficiary_name, order_number')
        .eq('group_id', groupId);
      if (!harambees || harambees.length === 0) {
        toast({ title: 'No data', description: 'No harambee contributions found', variant: 'destructive' });
        return;
      }
      const { data: contribs } = await supabase
        .from('chama_harambee_contributions')
        .select('*')
        .in('harambee_id', harambees.map(h => h.id))
        .order('created_at', { ascending: false });
      if (!contribs || contribs.length === 0) {
        toast({ title: 'No data', variant: 'destructive' });
        return;
      }
      const headers = ['Harambee', 'Order #', 'Contributor', 'Amount (KES)', 'Reference', 'Date'];
      const rows = contribs.map(c => {
        const h = harambees.find(h => h.id === c.harambee_id);
        return [
          h?.beneficiary_name || '',
          h?.order_number || '',
          getMemberName(c.contributor_id),
          String(c.amount),
          c.stk_reference || '',
          format(new Date(c.created_at), 'yyyy-MM-dd HH:mm'),
        ];
      });
      downloadCsv(`${group.name}_Harambee_Contributions`, headers, rows);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setDownloading(null); }
  };

  const exportPenalties = async () => {
    setDownloading('penalties');
    try {
      const { data } = await supabase
        .from('chama_penalties')
        .select('*')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false });
      if (!data || data.length === 0) {
        toast({ title: 'No data', description: 'No penalties found', variant: 'destructive' });
        return;
      }
      const headers = ['Member', 'Amount (KES)', 'Reason', 'Status', 'Period', 'Date'];
      const rows = (data as any[]).map(p => [
        getMemberName(p.user_id),
        String(p.amount),
        p.reason,
        p.status,
        p.period_date,
        format(new Date(p.created_at), 'yyyy-MM-dd HH:mm'),
      ]);
      downloadCsv(`${group.name}_Penalties`, headers, rows);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setDownloading(null); }
  };

  const reports = [
    { id: 'savings', label: 'Savings Report', description: 'All member savings contributions with amounts and dates', action: exportSavings, icon: '💰' },
    { id: 'members', label: 'Members List', description: 'Active members with roles and contact info', action: exportMembers, icon: '👥' },
    { id: 'contributions', label: 'Harambee Contributions', description: 'All harambee contributions by members', action: exportContributions, icon: '🤝' },
    { id: 'penalties', label: 'Penalties Report', description: 'All penalties applied to members', action: exportPenalties, icon: '⚠️' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Reports & Exports
      </h2>
      <p className="text-xs text-muted-foreground">Download CSV reports for your records.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        {reports.map(report => (
          <Card key={report.id} className="p-4 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">
              {report.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{report.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{report.description}</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 gap-1.5 text-xs"
                onClick={report.action}
                disabled={downloading === report.id}
              >
                {downloading === report.id ? (
                  <><Loader2 size={12} className="animate-spin" /> Downloading...</>
                ) : (
                  <><Download size={12} /> Download CSV</>
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
