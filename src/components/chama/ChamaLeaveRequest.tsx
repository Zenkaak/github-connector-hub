import { useState, useEffect } from 'react';
import { LogOut, Check, X, Clock } from 'lucide-react';
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
  members: Array<{ user_id: string; role: string; profile?: { full_name: string; phone: string } }>;
  myRole: string;
  mySavings: number;
  onRefreshGroup: () => void;
}

export function ChamaLeaveRequest({ groupId, group, members, myRole, mySavings, onRefreshGroup }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decisionReason, setDecisionReason] = useState('');
  const [decisionOpen, setDecisionOpen] = useState<{ id: string; decision: string } | null>(null);

  const isChair = myRole === 'chairperson';
  const refundPolicy = group?.refund_policy || 'no_refund';
  const refundPercentage = group?.refund_percentage || 0;

  const calculateRefund = () => {
    if (refundPolicy === 'no_refund') return 0;
    if (refundPolicy === 'full_refund') return mySavings;
    if (refundPolicy === 'percentage') return Math.round(mySavings * (refundPercentage / 100));
    return 0;
  };

  const fetchRequests = async () => {
    let query = supabase.from('chama_leave_requests').select('*').eq('group_id', groupId).order('created_at', { ascending: false });
    const { data } = await query;
    if (data) setLeaveRequests(data);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [groupId]);

  const myPendingRequest = leaveRequests.find(r => r.user_id === user?.id && r.status === 'pending_chairperson');
  const getMemberName = (uid: string) => members.find(m => m.user_id === uid)?.profile?.full_name || 'Unknown';
  const getMemberPhone = (uid: string) => members.find(m => m.user_id === uid)?.profile?.phone || '';

  const handleLeave = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const refundAmount = calculateRefund();
      const phone = getMemberPhone(user.id);

      const { error } = await supabase.from('chama_leave_requests').insert({
        group_id: groupId,
        user_id: user.id,
        reason: reason.trim() || null,
        refund_amount: refundAmount,
        mpesa_phone: phone,
      } as any);
      if (error) throw error;

      // Notify all 3 officials
      const officials = members.filter(m => ['chairperson', 'secretary', 'treasurer'].includes(m.role));
      if (officials.length) {
        await supabase.from('notifications').insert(
          officials.map(o => ({
            user_id: o.user_id,
            title: 'Member Leave Request',
            message: `${getMemberName(user.id)} has requested to leave the group. Savings: KES ${mySavings.toLocaleString()}, Refund eligible: KES ${refundAmount.toLocaleString()}. Reason: ${reason.trim() || 'No reason given'}.`,
          }))
        );
      }

      toast({ title: 'Leave Request Submitted', description: 'Group officials have been notified.' });
      setLeaveOpen(false);
      setReason('');
      fetchRequests();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecision = async (requestId: string, decision: 'approved' | 'rejected') => {
    try {
      const req = leaveRequests.find(r => r.id === requestId);
      if (!req) return;

      const updateData: any = {
        chairperson_decision: decision,
        chairperson_reason: decisionReason.trim() || null,
        status: decision === 'approved' ? (req.refund_amount > 0 ? 'pending_admin' : 'completed') : 'rejected',
      };

      const { error } = await supabase.from('chama_leave_requests').update(updateData).eq('id', requestId);
      if (error) throw error;

      // If approved and no refund, deactivate member
      if (decision === 'approved' && req.refund_amount <= 0) {
        await supabase.from('chama_members').update({ is_active: false } as any).eq('group_id', groupId).eq('user_id', req.user_id);
      }

      // Notify the user
      await supabase.from('notifications').insert({
        user_id: req.user_id,
        title: decision === 'approved' ? 'Leave Request Approved ✅' : 'Leave Request Rejected ❌',
        message: decision === 'approved'
          ? req.refund_amount > 0
            ? `Your leave request has been approved. Refund of KES ${req.refund_amount.toLocaleString()} is pending admin processing.`
            : `Your leave request has been approved. You have been removed from the group.`
          : `Your leave request was rejected. Reason: ${decisionReason.trim() || 'No reason provided.'}`,
      });

      toast({ title: decision === 'approved' ? 'Leave Approved' : 'Leave Rejected' });
      setDecisionOpen(null);
      setDecisionReason('');
      fetchRequests();
      onRefreshGroup();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const statusColors: Record<string, string> = {
    pending_chairperson: 'bg-yellow-500/10 text-yellow-600',
    pending_admin: 'bg-blue-500/10 text-blue-500',
    completed: 'bg-emerald-500/10 text-emerald-600',
    rejected: 'bg-destructive/10 text-destructive',
  };

  const statusLabels: Record<string, string> = {
    pending_chairperson: 'Pending Chairperson',
    pending_admin: 'Pending Admin',
    completed: 'Completed',
    rejected: 'Rejected',
  };

  return (
    <div className="space-y-4">
      {/* My leave action */}
      {!isChair && !myPendingRequest && (
        <Card className="p-4 border-destructive/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Want to leave this group?</p>
              <p className="text-xs text-muted-foreground">
                Refund policy: {refundPolicy === 'no_refund' ? 'No refund' : refundPolicy === 'full_refund' ? 'Full refund' : `${refundPercentage}% of your savings`}
                {mySavings > 0 && ` · Your savings: KES ${mySavings.toLocaleString()}`}
                {calculateRefund() > 0 && ` · Eligible refund: KES ${calculateRefund().toLocaleString()}`}
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setLeaveOpen(true)} className="gap-1 shrink-0">
              <LogOut size={14} /> Request Leave
            </Button>
          </div>
        </Card>
      )}

      {myPendingRequest && (
        <Card className="p-4 bg-yellow-500/5 border-yellow-500/20">
          <p className="text-sm text-yellow-600 flex items-center gap-2">
            <Clock size={16} /> Your leave request is pending review by the Chairperson
          </p>
        </Card>
      )}

      {/* Chairperson: pending requests */}
      {isChair && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-sm">Leave Requests</h3>
          </div>
          {leaveRequests.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No leave requests</div>
          ) : (
            <div className="divide-y">
              {leaveRequests.map(req => (
                <div key={req.id} className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium">{getMemberName(req.user_id)}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusColors[req.status] || ''}`}>
                      {statusLabels[req.status] || req.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Savings: KES {req.refund_amount?.toLocaleString() || '0'} refund
                    {req.reason && ` · Reason: ${req.reason}`}
                  </p>
                  {req.status === 'pending_chairperson' && (
                    <div className="flex gap-2 mt-2">
                      <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => setDecisionOpen({ id: req.id, decision: 'approved' })}>
                        <Check size={12} /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1 h-7 text-xs" onClick={() => setDecisionOpen({ id: req.id, decision: 'rejected' })}>
                        <X size={12} /> Reject
                      </Button>
                    </div>
                  )}
                  {req.chairperson_reason && (
                    <p className="text-xs text-muted-foreground mt-1 italic">Chair: {req.chairperson_reason}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Leave dialog */}
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Request to Leave Group</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-3 bg-muted/50 text-sm">
              <p><strong>Refund policy:</strong> {refundPolicy === 'no_refund' ? 'No refund on leaving' : refundPolicy === 'full_refund' ? 'Full refund of your savings' : `${refundPercentage}% of your savings will be refunded`}</p>
              {calculateRefund() > 0 && <p className="mt-1"><strong>Estimated refund:</strong> KES {calculateRefund().toLocaleString()}</p>}
            </Card>
            <div>
              <Label>Reason for leaving (optional)</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-1" />
            </div>
            <Button variant="destructive" onClick={handleLeave} disabled={submitting} className="w-full">
              {submitting ? 'Submitting...' : 'Confirm Leave Request'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Decision dialog */}
      <Dialog open={!!decisionOpen} onOpenChange={() => { setDecisionOpen(null); setDecisionReason(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{decisionOpen?.decision === 'approved' ? 'Approve' : 'Reject'} Leave Request</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason (optional)</Label>
              <Textarea value={decisionReason} onChange={e => setDecisionReason(e.target.value)} rows={3} className="mt-1" />
            </div>
            <Button
              variant={decisionOpen?.decision === 'approved' ? 'default' : 'destructive'}
              onClick={() => decisionOpen && handleDecision(decisionOpen.id, decisionOpen.decision as any)}
              className="w-full"
            >
              Confirm {decisionOpen?.decision === 'approved' ? 'Approval' : 'Rejection'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
