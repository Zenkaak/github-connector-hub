import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Heart, Search, Loader2, Eye, CheckCircle, XCircle, Clock,
  FileText, Download, ExternalLink, ChevronDown, ChevronUp,
  AlertTriangle, User, Phone, Calendar, MapPin, DollarSign,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/EmptyState';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ProseText } from '@/components/ProseText';

interface HarambeeApp {
  id: string;
  user_id: string;
  category: string;
  beneficiary_name: string;
  beneficiary_phone: string | null;
  beneficiary_relationship: string;
  description: string;
  target_amount: number;
  deadline: string | null;
  is_public: boolean;
  platform_fee_percent: number;
  category_answers: any;
  status: string;
  admin_notes: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  payout_method: string | null;
  payout_phone: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_name: string | null;
  bank_branch: string | null;
}

interface AppDocument {
  id: string;
  application_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
}

interface Profile {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  id_number: string;
  is_verified: boolean;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending_review: { label: 'Pending Review', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: Clock },
  approved: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: XCircle },
  needs_info: { label: 'Needs Info', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: AlertTriangle },
};

const categoryLabels: Record<string, string> = {
  funeral: '⚰️ Funeral',
  school_fees: '🎓 School Fees',
  medical: '🏥 Medical',
  other: '📋 Other',
};

const fmt = (n: number) => `KES ${n.toLocaleString()}`;

export default function AdminHarambeeApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<HarambeeApp[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<HarambeeApp | null>(null);
  const [docs, setDocs] = useState<AppDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedAnswers, setExpandedAnswers] = useState(false);

  const fetchData = useCallback(async () => {
    const [appsRes, profilesRes] = await Promise.all([
      supabase.from('harambee_applications').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name, email, phone, id_number, is_verified'),
    ]);
    if (appsRes.data) setApplications(appsRes.data as any);
    if (profilesRes.data) setProfiles(profilesRes.data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();

    // Real-time subscription
    const channel = supabase
      .channel('harambee-apps-admin')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'harambee_applications' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const openReview = async (app: HarambeeApp) => {
    setSelected(app);
    setAdminNotes(app.admin_notes || '');
    setExpandedAnswers(false);
    setDocsLoading(true);
    const { data } = await supabase
      .from('harambee_application_documents')
      .select('*')
      .eq('application_id', app.id);
    setDocs((data as any) || []);
    setDocsLoading(false);
  };

  const handleAction = async (action: 'approved' | 'rejected' | 'needs_info') => {
    if (!selected) return;
    setActionLoading(true);
    try {
      const updateData: any = {
        status: action,
        admin_notes: adminNotes || null,
        approved_by: action === 'approved' ? user?.id : null,
        approved_at: action === 'approved' ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('harambee_applications')
        .update(updateData)
        .eq('id', selected.id);
      if (error) throw error;

      // If approved, create the actual harambee
      if (action === 'approved') {
        // Create a temporary group for standalone harambees
        const { data: harambee, error: hErr } = await supabase
          .from('chama_harambees')
          .insert({
            title: `${categoryLabels[selected.category]?.replace(/^.+\s/, '') || selected.category} - ${selected.beneficiary_name}`,
            description: selected.description,
            target_amount: selected.target_amount,
            beneficiary_name: selected.beneficiary_name,
            beneficiary_phone: selected.beneficiary_phone,
            deadline: selected.deadline,
            is_public: selected.is_public,
            created_by: selected.user_id,
            group_id: '00000000-0000-0000-0000-000000000000',
            status: 'active',
            order_number: `HAR-${Date.now().toString(36).toUpperCase()}`,
            payout_method: selected.payout_method || null,
            payout_phone: selected.payout_phone || null,
            bank_name: selected.bank_name || null,
            bank_account_number: selected.bank_account_number || null,
            bank_account_name: selected.bank_account_name || null,
            bank_branch: selected.bank_branch || null,
          })
          .select('id')
          .single();

        if (hErr) throw hErr;

        // Link application to harambee
        await supabase
          .from('harambee_applications')
          .update({ harambee_id: harambee.id })
          .eq('id', selected.id);
      }

      // Notify user
      const statusLabel = action === 'approved' ? 'Approved ✅' : action === 'rejected' ? 'Rejected ❌' : 'Needs More Info ℹ️';
      await supabase.from('notifications').insert({
        user_id: selected.user_id,
        title: `Harambee Application ${statusLabel}`,
        message: action === 'approved'
          ? `Your fundraiser for ${selected.beneficiary_name} has been approved! It is now live and accepting contributions.`
          : action === 'rejected'
          ? `Your fundraiser application was not approved.${adminNotes ? ' Reason: ' + adminNotes : ''}`
          : `We need additional information for your fundraiser application.${adminNotes ? ' Details: ' + adminNotes : ''}`,
        type: 'harambee',
      });

      // Audit log
      await supabase.from('audit_logs').insert({
        admin_id: user?.id,
        user_id: selected.user_id,
        action: `harambee_application_${action}`,
        details: { application_id: selected.id, category: selected.category, notes: adminNotes },
      });

      toast.success(`Application ${action.replace('_', ' ')}`);
      setSelected(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getProfile = (userId: string) => profiles.find(p => p.user_id === userId);

  const getDocUrl = async (path: string) => {
    const { data } = await supabase.storage.from('harambee-verification').createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast.error('Failed to load document');
  };

  const filtered = applications.filter(a => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search) {
      const profile = getProfile(a.user_id);
      const s = search.toLowerCase();
      return (
        a.beneficiary_name.toLowerCase().includes(s) ||
        a.category.includes(s) ||
        profile?.full_name.toLowerCase().includes(s) ||
        profile?.phone.includes(s)
      );
    }
    return true;
  });

  const counts = {
    all: applications.length,
    pending_review: applications.filter(a => a.status === 'pending_review').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length,
    needs_info: applications.filter(a => a.status === 'needs_info').length,
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 flex items-center justify-center">
                <Heart size={20} className="text-pink-500" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display">Harambee Applications</h1>
                <p className="text-xs text-muted-foreground">Review and approve fundraiser requests</p>
              </div>
            </div>
            {counts.pending_review > 0 && (
              <Badge variant="destructive" className="text-sm px-3 py-1">
                {counts.pending_review} Pending
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Total', value: counts.all, color: 'text-foreground' },
              { label: 'Pending', value: counts.pending_review, color: 'text-amber-600' },
              { label: 'Approved', value: counts.approved, color: 'text-emerald-600' },
              { label: 'Rejected', value: counts.rejected, color: 'text-destructive' },
              { label: 'Needs Info', value: counts.needs_info, color: 'text-blue-600' },
            ].map(s => (
              <Card key={s.label} className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name, category, phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1 overflow-x-auto">
              {(['all', 'pending_review', 'approved', 'rejected', 'needs_info'] as const).map(f => (
                <Button key={f} variant={filter === f ? 'default' : 'outline'} size="sm" onClick={() => setFilter(f)} className="whitespace-nowrap text-xs">
                  {f === 'all' ? 'All' : statusConfig[f]?.label || f}
                </Button>
              ))}
            </div>
          </div>

          {/* Applications List */}
          {filtered.length === 0 ? (
            <EmptyState icon={Heart} title="No applications found" description={filter === 'pending_review' ? 'All caught up! No pending reviews.' : 'No matching applications.'} />
          ) : (
            <div className="space-y-3">
              {filtered.map(app => {
                const profile = getProfile(app.user_id);
                const sc = statusConfig[app.status] || statusConfig.pending_review;
                const StatusIcon = sc.icon;
                return (
                  <Card key={app.id} className="border-border/50 hover:border-accent/30 transition-colors cursor-pointer" onClick={() => openReview(app)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{categoryLabels[app.category] || app.category}</span>
                            <Badge variant="outline" className={cn('text-[10px]', sc.color)}>
                              <StatusIcon size={10} className="mr-1" />
                              {sc.label}
                            </Badge>
                          </div>
                          <p className="font-semibold text-sm truncate">For: {app.beneficiary_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{app.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><User size={12} />{profile?.full_name || 'Unknown'}</span>
                            <span className="flex items-center gap-1"><DollarSign size={12} />{fmt(app.target_amount)}</span>
                            <span className="flex items-center gap-1"><Calendar size={12} />{format(new Date(app.created_at), 'MMM dd, yyyy')}</span>
                          </div>
                        </div>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <Eye size={16} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selected && (() => {
            const profile = getProfile(selected.user_id);
            const sc = statusConfig[selected.status] || statusConfig.pending_review;
            const StatusIcon = sc.icon;
            const answers = selected.category_answers || {};
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {categoryLabels[selected.category]} Application
                    <Badge variant="outline" className={cn('ml-2', sc.color)}>
                      <StatusIcon size={12} className="mr-1" />{sc.label}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                {/* Applicant Info */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><User size={14} />Applicant</CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Name:</span> {profile?.full_name}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {profile?.phone}</div>
                    <div><span className="text-muted-foreground">Email:</span> {profile?.email}</div>
                    <div><span className="text-muted-foreground">ID:</span> {profile?.id_number}</div>
                    <div><span className="text-muted-foreground">Verified:</span> {profile?.is_verified ? '✅ Yes' : '❌ No'}</div>
                  </CardContent>
                </Card>

                {/* Beneficiary & Details */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fundraiser Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-muted-foreground">Beneficiary:</span> {selected.beneficiary_name}</div>
                      <div><span className="text-muted-foreground">Relationship:</span> {selected.beneficiary_relationship}</div>
                      <div><span className="text-muted-foreground">Phone:</span> {selected.beneficiary_phone || 'N/A'}</div>
                      <div><span className="text-muted-foreground">Target:</span> <span className="font-bold text-accent">{fmt(selected.target_amount)}</span></div>
                      <div><span className="text-muted-foreground">Fee:</span> {selected.platform_fee_percent}%</div>
                      <div><span className="text-muted-foreground">Deadline:</span> {selected.deadline ? format(new Date(selected.deadline), 'MMM dd, yyyy') : 'None'}</div>
                    </div>
                    <Separator />
                    <div>
                      <p className="text-muted-foreground mb-2 text-xs uppercase tracking-wider font-semibold">Description</p>
                      <ProseText text={selected.description} className="text-sm text-foreground" />
                    </div>
                  </CardContent>
                </Card>

                {/* Category Answers */}
                {Object.keys(answers).length > 0 && (
                  <Card className="border-border/50">
                    <CardHeader className="pb-2 cursor-pointer" onClick={() => setExpandedAnswers(!expandedAnswers)}>
                      <CardTitle className="text-sm flex items-center justify-between">
                        Category Questions & Answers
                        {expandedAnswers ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </CardTitle>
                    </CardHeader>
                    {expandedAnswers && (
                      <CardContent className="space-y-2 text-sm">
                        {Object.entries(answers).map(([key, val]) => (
                          <div key={key} className="flex justify-between py-1 border-b border-border/30 last:border-0">
                            <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className="font-medium text-right max-w-[60%]">{String(val)}</span>
                          </div>
                        ))}
                      </CardContent>
                    )}
                  </Card>
                )}

                {/* Documents */}
                <Card className="border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2"><FileText size={14} />Verification Documents ({docs.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {docsLoading ? (
                      <div className="flex justify-center py-4"><Loader2 className="animate-spin" size={20} /></div>
                    ) : docs.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">No documents uploaded</p>
                    ) : (
                      <div className="space-y-2">
                        {docs.map(doc => (
                          <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate">{doc.file_name}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{doc.document_type.replace(/_/g, ' ')}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => getDocUrl(doc.file_path)}>
                              <ExternalLink size={14} className="mr-1" /> View
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Admin Notes & Actions */}
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Admin Notes</label>
                    <Textarea
                      value={adminNotes}
                      onChange={e => setAdminNotes(e.target.value)}
                      placeholder="Add notes for internal use or to send to applicant..."
                      rows={3}
                    />
                  </div>

                  {selected.status === 'pending_review' || selected.status === 'needs_info' ? (
                    <div className="flex gap-2">
                      <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={actionLoading} onClick={() => handleAction('approved')}>
                        {actionLoading ? <Loader2 size={14} className="animate-spin mr-1" /> : <CheckCircle size={14} className="mr-1" />}
                        Approve
                      </Button>
                      <Button variant="outline" className="flex-1 border-blue-500/30 text-blue-600" disabled={actionLoading} onClick={() => handleAction('needs_info')}>
                        <AlertTriangle size={14} className="mr-1" /> Need Info
                      </Button>
                      <Button variant="destructive" className="flex-1" disabled={actionLoading} onClick={() => handleAction('rejected')}>
                        <XCircle size={14} className="mr-1" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center">
                      This application has been {selected.status}
                      {selected.approved_at && ` on ${format(new Date(selected.approved_at), 'MMM dd, yyyy HH:mm')}`}
                    </p>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
