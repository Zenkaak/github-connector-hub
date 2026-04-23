import { useState } from 'react';
import {
  ArrowRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  User,
  MessageSquare,
  Calendar,
  Hash,
  Loader2,
  Phone
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  sender_number: string | null;
  recipient_number: string | null;
  status: string;
  cancelled_at: string | null;
  created_at: string;
}

export function TransferDetailsDialog({
  transfer,
  onClose,
  onRefresh
}: any) {
  const { user } = useAuth();

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!transfer) return null;

  const isSender = transfer.sender_id === user?.id;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString('en-KE', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });

  const status = transfer.status === 'cancelled'
    ? { label: 'Cancelled', color: 'text-red-600', bg: 'bg-red-50' }
    : { label: 'Completed', color: 'text-green-600', bg: 'bg-green-50' };

  return (
    <Dialog open={!!transfer} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Send size={16} /> Transaction Receipt
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">

          {/* STATUS + AMOUNT */}
          <div className="text-center space-y-2">
            <div className={cn('inline-flex px-3 py-1 rounded-full text-xs font-medium', status.bg, status.color)}>
              {status.label}
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              {formatCurrency(transfer.amount)}
            </h1>

            <p className="text-xs text-muted-foreground">
              {formatDate(transfer.created_at)}
            </p>
          </div>

          {/* TRANSFER FLOW CARD */}
          <div className="border rounded-xl p-4 bg-muted/20 space-y-4">

            {/* Sender */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {transfer.sender_name ?? 'Unknown Sender'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {transfer.sender_number ?? 'No number'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Sender
              </span>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <ArrowRight className="text-muted-foreground" size={18} />
            </div>

            {/* Receiver */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User size={16} className="text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {transfer.receiver_name ?? 'Unknown Receiver'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {transfer.recipient_number ?? 'No number'}
                  </p>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Receiver
              </span>
            </div>

          </div>

          {/* DETAILS */}
          <div className="border rounded-xl p-4 space-y-3 text-sm">

            <div className="flex items-center gap-2">
              <MessageSquare size={14} />
              <span>{transfer.reason || 'No reason provided'}</span>
            </div>

            <div className="flex items-center gap-2">
              <Hash size={14} />
              <span className="break-all">{transfer.id}</span>
            </div>

          </div>

          {/* ACTIONS */}
          <div className="flex gap-2">

            <Button variant="outline" className="flex-1" onClick={onClose}>
              Close
            </Button>

            <Button
              variant="ghost"
              className="flex-1 text-red-600"
              onClick={() => setReportOpen(true)}
            >
              <AlertTriangle size={14} /> Report
            </Button>

          </div>

          {/* REPORT BOX */}
          {reportOpen && (
            <div className="border rounded-xl p-3 space-y-2">
              <Textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Describe the issue..."
                className="text-sm"
              />
              <Button
                className="w-full"
                disabled={!reportReason.trim() || loading}
                onClick={async () => {
                  setLoading(true);
                  // replace with your API
                  setTimeout(() => {
                    toast.success('Report submitted');
                    setLoading(false);
                    setReportOpen(false);
                    setReportReason('');
                  }, 800);
                }}
              >
                {loading ? <Loader2 className="animate-spin" /> : 'Submit Report'}
              </Button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
