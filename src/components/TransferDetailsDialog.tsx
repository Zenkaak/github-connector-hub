import { useState } from 'react';
import { ArrowRight, Clock, CheckCircle, XCircle, AlertTriangle, Send, User, MessageSquare, Calendar, Hash, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Transfer {
  id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  reason: string | null;
  sender_name: string | null;
  receiver_name: string | null;
  status: string;
  cancelled_at: string | null;
  created_at: string;
}

interface TransferDetailsDialogProps {
  transfer: Transfer | null;
  onClose: () => void;
  onRefresh: () => void;
}

export function TransferDetailsDialog({ transfer, onClose, onRefresh }: TransferDetailsDialogProps) {
  const { user } = useAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportLoading, setReportLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  if (!transfer) return null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const isSender = transfer.sender_id === user?.id;
  const minutesAgo = (Date.now() - new Date(transfer.created_at).getTime()) / 60000;
  const canCancel = isSender && transfer.status === 'completed' && minutesAgo <= 10;
  const timeLeft = Math.max(0, Math.ceil(10 - minutesAgo));

  const handleCancel = async () => {
    if (!user) return;
    setCancelLoading(true);
    try {
      const { error } = await supabase.rpc('cancel_wallet_transfer', {
        _transfer_id: transfer.id,
        _user_id: user.id,
      });
      if (error) throw error;
      toast.success('Transfer cancelled and refunded');
      onClose();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReport = async () => {
    if (!user || !reportReason.trim()) return;
    setReportLoading(true);
    try {
      const { error } = await supabase.from('transaction_reports' as any).insert({
        transfer_id: transfer.id,
        reporter_id: user.id,
        reason: reportReason.trim(),
      } as any);
      if (error) throw error;
      toast.success('Report submitted. Admin will review shortly.');
      setReportOpen(false);
      setReportReason('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report');
    } finally {
      setReportLoading(false);
    }
  };

  const statusConfig = {
    completed: { label: 'Completed', icon: CheckCircle, color: 'text-success', bg: 'bg-success/10' },
    cancelled: { label: 'Cancelled', icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  };
  const config = statusConfig[transfer.status as keyof typeof statusConfig] || statusConfig.completed;
  const StatusIcon = config.icon;

  return (
    <Dialog open={!!transfer} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Send size={16} /> Transfer Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Amount & Status */}
          <div className="text-center py-4">
            <div className={cn('w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center', config.bg)}>
              <StatusIcon className={config.color} size={24} />
            </div>
            <p className="text-3xl font-bold font-display">{formatCurrency(transfer.amount)}</p>
            <span className={cn('inline-block mt-1 px-3 py-1 rounded-full text-xs font-semibold', config.bg, config.color)}>
              {config.label}
            </span>
          </div>

          {/* Sender → Recipient */}
          <div className="flex items-center justify-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
            <div className="text-center flex-1">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-1">
                <User size={16} className="text-primary" />
              </div>
              <p className="text-xs font-medium truncate">{transfer.sender_name || 'Unknown'}</p>
              <p className="text-[10px] text-muted-foreground">{isSender ? '(You)' : 'Sender'}</p>
            </div>
            <ArrowRight size={18} className="text-muted-foreground shrink-0" />
            <div className="text-center flex-1">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-1">
                <User size={16} className="text-accent" />
              </div>
              <p className="text-xs font-medium truncate">{transfer.receiver_name || 'Unknown'}</p>
              <p className="text-[10px] text-muted-foreground">{!isSender ? '(You)' : 'Recipient'}</p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3 bg-muted/30 rounded-xl p-4">
            {[
              { icon: MessageSquare, label: 'Reason', value: transfer.reason || 'No reason provided' },
              { icon: Calendar, label: 'Date', value: formatDate(transfer.created_at) },
              { icon: Hash, label: 'Transfer ID', value: transfer.id.slice(0, 16) + '...' },
              ...(transfer.cancelled_at ? [{ icon: XCircle, label: 'Cancelled At', value: formatDate(transfer.cancelled_at) }] : []),
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-background flex items-center justify-center shrink-0">
                  <item.icon size={14} className="text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
                  <p className="text-sm font-medium break-all">{item.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Cancel button */}
          {canCancel && (
            <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-destructive">Cancel this transfer?</p>
                  <p className="text-[10px] text-muted-foreground">{timeLeft} min left to cancel</p>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleCancel}
                  disabled={cancelLoading}
                  className="gap-1"
                >
                  {cancelLoading ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                  Cancel Transfer
                </Button>
              </div>
            </div>
          )}

          {/* Report problem */}
          {!reportOpen ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground gap-1"
              onClick={() => setReportOpen(true)}
            >
              <AlertTriangle size={12} /> Report a problem with this transaction
            </Button>
          ) : (
            <div className="p-3 rounded-xl bg-accent/5 border border-accent/20 space-y-3">
              <Label className="text-xs font-medium">Describe the problem</Label>
              <Textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="e.g. Sent to wrong person, amount is incorrect..."
                className="min-h-[60px] text-sm"
                maxLength={500}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setReportOpen(false); setReportReason(''); }} className="flex-1">
                  Cancel
                </Button>
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handleReport}
                  disabled={reportLoading || !reportReason.trim()}
                  className="flex-1 gap-1"
                >
                  {reportLoading ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Submit Report
                </Button>
              </div>
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
