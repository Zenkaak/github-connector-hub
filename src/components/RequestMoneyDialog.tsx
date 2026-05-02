import { useState, useEffect } from 'react';
import { HandCoins, Loader2, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface RequestMoneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RequestMoneyDialog({ open, onOpenChange, onSuccess }: RequestMoneyDialogProps) {
  const { user, profile } = useAuth();
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [targetName, setTargetName] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const formatCurrency = (amt: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amt);

  useEffect(() => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length >= 10) {
      searchUser(cleaned);
    } else {
      setTargetName(null);
      setTargetId(null);
    }
  }, [phone]);

  const searchUser = async (phoneNumber: string) => {
    setSearching(true);
    setTargetName(null);
    setTargetId(null);
    try {
      const variants = [phoneNumber];
      if (phoneNumber.startsWith('0')) {
        variants.push('+254' + phoneNumber.slice(1));
        variants.push('254' + phoneNumber.slice(1));
      } else if (phoneNumber.startsWith('+254')) {
        variants.push('0' + phoneNumber.slice(4));
        variants.push('254' + phoneNumber.slice(4));
      } else if (phoneNumber.startsWith('254')) {
        variants.push('0' + phoneNumber.slice(3));
        variants.push('+' + phoneNumber);
      }

      const { data } = await supabase
        .from('profiles')
        .select('user_id, full_name, phone')
        .in('phone', variants)
        .limit(1);

      if (data && data.length > 0) {
        if (data[0].user_id === user?.id) {
          setTargetName('⚠️ This is your own account');
          setTargetId(null);
        } else {
          setTargetName(data[0].full_name);
          setTargetId(data[0].user_id);
        }
      } else {
        setTargetName('User not found on Dasnet');
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleRequest = async () => {
    if (!targetId || !amount || !user) return;
    const amt = Number(amount);
    if (amt <= 0) { toast.error('Invalid amount'); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('money_requests').insert([{
        requester_id: user.id,
        requested_from_id: targetId,
        amount: amt,
      }]);
      if (error) throw error;

      // Notify target user (in-app)
      await supabase.from('notifications').insert({
        user_id: targetId,
        title: '💸 Money Request',
        message: `${profile?.full_name || 'A Dasnet user'} has requested ${formatCurrency(amt)} from you. Open your wallet to approve or decline.`,
      });

      // Fire SMS + email to BOTH parties (best-effort, never block)
      try {
        const { data: targetProf } = await supabase
          .from('profiles')
          .select('phone, full_name, email')
          .eq('user_id', targetId)
          .maybeSingle();
        const requesterName = profile?.full_name || 'A Dasnet user';
        const targetFirst = (targetProf?.full_name || targetName || 'Member').split(' ')[0];
        const senderFirst = (profile?.full_name || 'Member').split(' ')[0];

        const smsPromises: Promise<any>[] = [];
        if (targetProf?.phone) {
          smsPromises.push(supabase.functions.invoke('send-sms', {
            body: { phone: targetProf.phone, message: `Dear ${targetFirst}, ${requesterName} has requested ${formatCurrency(amt)} from you on DASNET VENTURES. Open the app to approve or decline.` },
          }));
        }
        if (profile?.phone) {
          smsPromises.push(supabase.functions.invoke('send-sms', {
            body: { phone: profile.phone, message: `Dear ${senderFirst}, your request for ${formatCurrency(amt)} from ${targetProf?.full_name || targetName} has been sent. You'll be notified when they respond. — DASNET VENTURES.` },
          }));
        }
        Promise.all(smsPromises).catch(() => {});

        const dateStr = new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
        if (targetProf?.email) {
          supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'transaction-notification',
              recipientEmail: targetProf.email,
              idempotencyKey: `mreq-${user.id}-${targetId}-${Date.now()}`,
              templateData: {
                name: targetFirst,
                type: 'Money Request Received',
                amount: formatCurrency(amt),
                status: 'Pending',
                date: dateStr,
                description: `${requesterName} has requested ${formatCurrency(amt)} from you. Open the app to approve or decline.`,
              },
            },
          }).catch(() => {});
        }
      } catch (e) { console.warn('Money-request notify side-effects failed:', e); }

      toast.success('Money request sent!');
      onOpenChange(false);
      setPhone('');
      setAmount('');
      setTargetName(null);
      setTargetId(null);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><HandCoins size={18} /> Request Money</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Request From (Phone Number)</Label>
            <div className="relative mt-1">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07XXXXXXXX"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={16} />}
            </div>
            {targetName && (
              <div className={`mt-2 flex items-center gap-2 p-2 rounded-lg ${targetId ? 'bg-success/10 border border-success/20' : 'bg-destructive/10 border border-destructive/20'}`}>
                <User size={14} className={targetId ? 'text-success' : 'text-destructive'} />
                <span className={`text-sm font-medium ${targetId ? 'text-success' : 'text-destructive'}`}>{targetName}</span>
              </div>
            )}
          </div>

          {targetId && (
            <div>
              <Label className="text-xs">Amount (KES)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                className="mt-1"
              />
            </div>
          )}

          <p className="text-xs text-muted-foreground">A notification will be sent to the user to approve your request.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="gold"
            onClick={handleRequest}
            disabled={submitting || !targetId || !amount || Number(amount) <= 0}
          >
            {submitting ? <Loader2 className="animate-spin" size={16} /> : <>Request {amount ? formatCurrency(Number(amount)) : ''}</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
