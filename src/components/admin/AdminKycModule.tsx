import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ShieldCheck, Loader2, FileText, Check, X as XIcon, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { AdminSectionHeader } from './AdminSectionHeader';
import { AdminEmptyState } from './AdminEmptyState';
import { AdminKpiCard } from './AdminKpiCard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function AdminKycModule() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [acting, setActing] = useState(false);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });

  useEffect(() => {
    (async () => {
      const [p, a, r] = await Promise.all([
        supabase.from('kyc_documents').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('kyc_documents').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('kyc_documents').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);
      setCounts({ pending: p.count || 0, approved: a.count || 0, rejected: r.count || 0 });
    })();
  }, []);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('kyc_documents')
      .select('id, user_id, document_type, file_path, status, review_notes, created_at, reviewed_at')
      .eq('status', filter)
      .order('created_at', { ascending: false })
      .limit(100);
    const userIds = [...new Set((data || []).map((d) => d.user_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone, email').in('user_id', userIds);
    const pmap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
    setDocs((data || []).map((d) => ({ ...d, profile: pmap.get(d.user_id) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [filter]);

  const openDoc = async (doc: any) => {
    setSelected(doc); setNotes(doc.review_notes || '');
    const { data } = await supabase.storage.from('kyc-documents').createSignedUrl(doc.file_path, 600);
    setImageUrl(data?.signedUrl || null);
  };

  const review = async (status: 'approved' | 'rejected') => {
    if (!selected) return;
    setActing(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('kyc_documents').update({
      status, review_notes: notes, reviewed_at: new Date().toISOString(), reviewed_by: user!.id,
    }).eq('id', selected.id);
    if (error) { toast.error(error.message); setActing(false); return; }
    if (status === 'approved') {
      await supabase.from('profiles').update({ is_verified: true }).eq('user_id', selected.user_id);
    }
    await supabase.from('notifications').insert({
      user_id: selected.user_id, type: 'kyc',
      title: status === 'approved' ? 'KYC Approved ✓' : 'KYC Rejected',
      message: status === 'approved' ? 'Your identity verification has been approved.' : `Your KYC was rejected: ${notes || 'See details'}`,
    });
    toast.success(`Document ${status}`);
    setSelected(null); setImageUrl(null); load();
    setActing(false);
  };

  return (
    <div className="space-y-5">
      <AdminSectionHeader title="KYC Reviews" description="Verify member identity documents" icon={ShieldCheck} />

      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-accent" /></div>
      ) : docs.length === 0 ? (
        <AdminEmptyState icon={FileText} title={`No ${filter} documents`} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {docs.map((d) => (
            <Card key={d.id} onClick={() => openDoc(d)} className="p-4 cursor-pointer hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{d.profile?.full_name || 'Unknown'}</p>
                  <p className="text-xs text-muted-foreground truncate">{d.profile?.phone || '—'}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">{d.document_type}</Badge>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(d.created_at), 'MMM d')}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => { if (!o) { setSelected(null); setImageUrl(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.profile?.full_name} — {selected.document_type}</DialogTitle>
              </DialogHeader>
              {imageUrl && (
                <div className="rounded-lg overflow-hidden border bg-muted">
                  <img src={imageUrl} alt={selected.document_type} className="w-full h-auto" />
                </div>
              )}
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Review notes (required for rejection)…" rows={3} />
              {filter === 'pending' && (
                <DialogFooter>
                  <Button variant="destructive" onClick={() => review('rejected')} disabled={acting}>
                    <XIcon size={14} /> Reject
                  </Button>
                  <Button variant="success" onClick={() => review('approved')} disabled={acting}>
                    <Check size={14} /> Approve
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
