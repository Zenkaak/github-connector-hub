import { useState, useEffect } from 'react';
import { UserPlus, Check, X, DollarSign } from 'lucide-react';
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
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const isChair = myRole === 'chairperson';
  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);
  const joiningFee = group?.joining_fee || 0;

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('chama_join_requests')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (data) {
      setRequests(data);
      const userIds = [...new Set(data.map(r => r.user_id))];
      if (userIds.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name, phone').in('user_id', userIds);
        if (profs) {
          const map: Record<string, any> = {};
          profs.forEach(p => { map[p.user_id] = p; });
          setProfiles(map);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [groupId]);

  const handleLeaderDecision = async (requestId: string, decision: 'approved' | 'rejected', reason?: string) => {
    try {
      const roleField = `${myRole}_decision`;
      const updateData: any = { [roleField]: decision };
      if (reason) updateData.reject_reason = reason;

      // If chairperson approves, that's final
      if (isChair && decision === 'approved') {
        updateData.status = 'approved';
      } else if (decision === 'rejected') {
        updateData.status = 'rejected';
        updateData.reject_reason = reason;
      }

      const { error } = await supabase.from('chama_join_requests').update(updateData).eq('id', requestId);
      if (error) throw error;

      const req = requests.find(r => r.id === requestId);
      if (req) {
        if (isChair && decision === 'approved') {
          if (joiningFee > 0) {
            // Notify user about joining fee — they need to pay via STK push
            await supabase.from('notifications').insert({
              user_id: req.user_id,
              title: 'Join Request Approved ✅',
              message: `Your request to join "${group?.name}" has been approved! You are required to pay a mandatory joining fee of KES ${joiningFee.toLocaleString()} before being added to the group.`,
            });
          } else {
            // Add member directly (no joining fee)
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
              message: `You have been added to "${group?.name}". Start participating now!`,
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

      toast({ title: decision === 'approved' ? 'Request Approved' : 'Request Rejected' });
      setRejectOpen(null);
      setRejectReason('');
      fetchRequests();
      onRefreshGroup();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500/10 text-yellow-600',
    approved: 'bg-emerald-500/10 text-emerald-600',
    rejected: 'bg-destructive/10 text-destructive',
  };

  if (!isLeader) return null;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <UserPlus size={16} /> Join Requests
          </h3>
          {joiningFee > 0 && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <DollarSign size={11} /> Joining fee: KES {joiningFee.toLocaleString()}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-4"><div className="h-16 bg-muted animate-pulse rounded" /></div>
        ) : requests.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No join requests</div>
        ) : (
          <div className="divide-y">
            {requests.map(req => {
              const profile = profiles[req.user_id];
              return (
                <div key={req.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <p className="text-sm font-medium">{profile?.full_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{profile?.phone} · {new Date(req.created_at).toLocaleDateString('en-KE')}</p>
                    </div>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium capitalize ${statusColors[req.status] || ''}`}>
                      {req.status}
                    </span>
                  </div>
                  {req.status === 'pending' && isLeader && (
                    <div className="flex gap-2 mt-2">
                      {isChair && (
                        <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => handleLeaderDecision(req.id, 'approved')}>
                          <Check size={12} /> Approve
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => setRejectOpen(req.id)}>
                        <X size={12} /> Reject
                      </Button>
                    </div>
                  )}
                  {req.reject_reason && (
                    <p className="text-xs text-destructive mt-1">Reason: {req.reject_reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Dialog open={!!rejectOpen} onOpenChange={() => { setRejectOpen(null); setRejectReason(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Join Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason for rejection</Label>
              <Textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3} className="mt-1" />
            </div>
            <Button variant="destructive" onClick={() => rejectOpen && handleLeaderDecision(rejectOpen, 'rejected', rejectReason)} className="w-full">
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
