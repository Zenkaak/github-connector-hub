import { useState, useEffect } from 'react';
import { UserPlus, Check, X, DollarSign, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Props {
  groupId: string;
  group: any;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string } }>;
  myRole: string;
  onRefreshGroup: () => void;
}

export function ChamaJoinRequests({ groupId, group, members, myRole, onRefreshGroup }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isChair = myRole === 'chairperson';
  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);
  const joiningFee = Number(group?.joining_fee || 0);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('chama_join_requests')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: "Error fetching requests", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (data) {
      setRequests(data);
      const userIds = [...new Set(data.map(r => r.user_id))];
      if (userIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, phone')
          .in('user_id', userIds);
        
        if (profs) {
          const map: Record<string, any> = {};
          profs.forEach(p => { map[p.user_id] = p; });
          setProfiles(map);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => { 
    fetchRequests(); 
    
    // Subscribe to changes so the list updates in real-time
    const channel = supabase
      .channel('join_requests_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'chama_join_requests', filter: `group_id=eq.${groupId}` }, 
        () => fetchRequests()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const handleLeaderDecision = async (requestId: string, decision: 'approved' | 'rejected', reason?: string) => {
    setProcessingId(requestId);
    try {
      const roleField = `${myRole}_decision`;
      const updateData: any = { [roleField]: decision };
      
      // Final status logic
      if (decision === 'rejected') {
        updateData.status = 'rejected';
        updateData.reject_reason = reason || 'Declined by leadership';
      } else if (isChair && decision === 'approved') {
        // If there's a joining fee, status stays 'approved' for the user to pay.
        // If NO joining fee, status becomes 'completed' and we add them now.
        updateData.status = joiningFee > 0 ? 'approved' : 'completed';
      }

      const { error: updateError } = await supabase
        .from('chama_join_requests')
        .update(updateData)
        .eq('id', requestId);

      if (updateError) throw updateError;

      const req = requests.find(r => r.id === requestId);
      if (req) {
        if (isChair && decision === 'approved') {
          if (joiningFee > 0) {
            // Notification for Payment Required
            await supabase.from('notifications').insert({
              user_id: req.user_id,
              title: 'Join Request Approved ✅',
              message: `Your request to join "${group?.name}" has been approved! Please pay the joining fee of KES ${joiningFee.toLocaleString()} to finalize your membership.`,
            });
          } else {
            // Direct Add to Members (No Fee)
            await supabase.from('chama_members').insert({
              group_id: groupId,
              user_id: req.user_id,
              role: 'member',
              added_by: user!.id,
              joining_fee_paid: true,
            });
            
            await supabase.from('notifications').insert({
              user_id: req.user_id,
              title: 'Welcome to the Group! 🎉',
              message: `You have been added to "${group?.name}". You can now start participating.`,
            });
          }
        } else if (decision === 'rejected') {
          await supabase.from('notifications').insert({
            user_id: req.user_id,
            title: 'Join Request Rejected ❌',
            message: `Your request to join "${group?.name}" was rejected. Reason: ${reason || 'No reason provided.'}`,
          });
        }
      }

      toast({ 
        title: decision === 'approved' ? 'Request Approved' : 'Request Rejected',
        description: joiningFee > 0 && decision === 'approved' ? "User notified to pay joining fee." : "" 
      });
      
      setRejectOpen(null);
      setRejectReason('');
      fetchRequests();
      onRefreshGroup();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-600',
    approved: 'bg-blue-500/10 text-blue-600', // Awaiting payment
    completed: 'bg-emerald-500/10 text-emerald-600', // Fully joined
    rejected: 'bg-destructive/10 text-destructive',
  };

  if (!isLeader) return null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="p-4 border-b bg-slate-50/50 flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-2 text-slate-800">
            <UserPlus size={16} className="text-primary" /> Join Requests
          </h3>
          {joiningFee > 0 && (
            <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded border border-emerald-100">
              <DollarSign size={12} />
              <span className="text-[10px] font-black uppercase">Fee: KES {joiningFee.toLocaleString()}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-slate-300" /></div>
        ) : requests.length === 0 ? (
          <div className="p-10 text-center">
            <UserPlus size={32} className="mx-auto text-slate-200 mb-2" />
            <p className="text-sm text-slate-400 font-medium">No active join requests</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {requests.map(req => {
              const profile = profiles[req.user_id];
              const isProcessing = processingId === req.id;
              
              return (
                <div key={req.id} className="p-4 hover:bg-slate-50/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-slate-900">{profile?.full_name || 'Loading user...'}</p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        {profile?.phone} • {new Date(req.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-tight ${statusColors[req.status] || ''}`}>
                      {req.status === 'approved' && joiningFee > 0 ? 'Awaiting Payment' : req.status}
                    </span>
                  </div>

                  {req.status === 'pending' && (
                    <div className="flex gap-2 mt-4">
                      {isChair && (
                        <Button 
                          size="sm" 
                          disabled={isProcessing}
                          className="flex-1 gap-1 h-8 text-xs font-bold bg-slate-900" 
                          onClick={() => handleLeaderDecision(req.id, 'approved')}
                        >
                          {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Check size={14} />} 
                          Approve
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        variant="outline" 
                        disabled={isProcessing}
                        className="flex-1 gap-1 h-8 text-xs font-bold border-slate-200 text-destructive hover:bg-destructive/5" 
                        onClick={() => setRejectOpen(req.id)}
                      >
                        <X size={14} /> Reject
                      </Button>
                    </div>
                  )}

                  {req.reject_reason && (
                    <div className="mt-3 p-2 bg-destructive/5 rounded border border-destructive/10">
                      <p className="text-[11px] text-destructive font-medium">
                        <span className="font-bold uppercase text-[9px] block">Reason for Rejection:</span>
                        {req.reject_reason}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectOpen} onOpenChange={() => { setRejectOpen(null); setRejectReason(''); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900 uppercase tracking-tight">Reject Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-slate-500">Reason for rejection</Label>
              <Textarea 
                value={rejectReason} 
                onChange={e => setRejectReason(e.target.value)} 
                placeholder="Explain why the request is being declined..."
                rows={4} 
                className="resize-none font-medium"
              />
            </div>
            <Button 
              variant="destructive" 
              className="w-full h-12 font-black uppercase tracking-wide shadow-lg shadow-destructive/20"
              onClick={() => rejectOpen && handleLeaderDecision(rejectOpen, 'rejected', rejectReason)}
            >
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
 
