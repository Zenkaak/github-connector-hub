import { useState, useEffect } from 'react';
import { Send, Loader2, User, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

interface SendMoneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletBalance: number;
  onSuccess: () => void;
}

export function SendMoneyDialog({ open, onOpenChange, walletBalance, onSuccess }: SendMoneyDialogProps) {
  const { user, profile } = useAuth();
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amount);

  useEffect(() => {
    if (!open) {
      setPhone('');
      setAmount('');
      setReason('');
      setRecipientName(null);
      setRecipientId(null);
      setPassword('');
      setShowPasswordStep(false);
    }
  }, [open]);

  useEffect(() => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length >= 10) {
      searchUser(cleaned);
    } else {
      setRecipientName(null);
      setRecipientId(null);
    }
  }, [phone]);

  const searchUser = async (phoneNumber: string) => {
    setSearching(true);
    setRecipientName(null);
    setRecipientId(null);
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
          setRecipientName('⚠️ This is your own account');
          setRecipientId(null);
        } else {
          setRecipientName(data[0].full_name);
          setRecipientId(data[0].user_id);
        }
      } else {
        setRecipientName('User not found on DataVend');
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handlePasswordVerify = async () => {
    if (!password.trim() || !user?.email) return;
    setVerifyingPassword(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: password,
      });
      if (error) {
        toast.error('Incorrect password');
        return;
      }
      await executeSend();
    } catch (err: any) {
      toast.error('Password verification failed');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleSend = async () => {
    if (!recipientId || !amount || !user) return;
    const amt = Number(amount);
    if (amt <= 0 || amt > walletBalance) {
      toast.error('Invalid amount');
      return;
    }
    setPassword('');
    setShowPasswordStep(true);
  };

  const executeSend = async () => {
    if (!recipientId || !amount || !user) return;
    const amt = Number(amount);

    setSending(true);
    try {
      const { data, error } = await supabase.rpc('transfer_wallet_funds', {
        _sender_id: user.id,
        _receiver_id: recipientId,
        _amount: amt,
        _reason: reason || null,
        _sender_name: profile?.full_name || null,
        _receiver_name: recipientName || null,
      });

      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        toast.error(result?.error || 'Transfer failed');
        return;
      }

      await Promise.all([
        supabase.from('notifications').insert({
          user_id: recipientId,
          title: '💰 Money Received',
          message: `You received ${formatCurrency(amt)} from ${profile?.full_name || 'a DataVend user'}.${reason ? ` Reason: ${reason}` : ''}`,
        }),
        supabase.from('notifications').insert({
          user_id: user.id,
          title: '💸 Money Sent',
          message: `You sent ${formatCurrency(amt)} to ${recipientName} successfully.${reason ? ` Reason: ${reason}` : ''}`,
        }),
      ]);

      toast.success(`${formatCurrency(amt)} sent successfully!`);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showPasswordStep ? <Lock size={18} /> : <Send size={18} />}
            {showPasswordStep ? 'Authorize Transfer' : 'Send Money'}
          </DialogTitle>
        </DialogHeader>

        {/* Password authorization step - replaces main content */}
        {showPasswordStep ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/40 text-center space-y-1">
              <p className="text-xs text-muted-foreground">Sending</p>
              <p className="text-3xl font-bold font-display text-primary">{formatCurrency(Number(amount))}</p>
              <p className="text-sm text-muted-foreground">to <span className="font-semibold text-foreground">{recipientName}</span></p>
              {reason && <p className="text-xs text-muted-foreground italic">"{reason}"</p>}
            </div>

            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Lock size={14} className="text-accent" />
                Enter your password to authorize
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your account password"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordVerify(); }}
              />
            </div>
          </div>
        ) : (
          /* Main send money form */
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
              <p className="text-xs text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold font-display text-primary">{formatCurrency(walletBalance)}</p>
            </div>

            <div>
              <Label className="text-xs">Recipient Phone Number</Label>
              <div className="relative mt-1">
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XXXXXXXX"
                />
                {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={16} />}
              </div>
              {recipientName && (
                <div className={`mt-2 flex items-center gap-2 p-2 rounded-lg ${recipientId ? 'bg-success/10 border border-success/20' : 'bg-destructive/10 border border-destructive/20'}`}>
                  <User size={14} className={recipientId ? 'text-success' : 'text-destructive'} />
                  <span className={`text-sm font-medium ${recipientId ? 'text-success' : 'text-destructive'}`}>{recipientName}</span>
                </div>
              )}
            </div>

            {recipientId && (
              <>
                <div>
                  <Label className="text-xs">Amount (KES)</Label>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="Enter amount"
                    max={walletBalance}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Reason (optional)</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Payment for goods, Gift, etc."
                    className="mt-1 min-h-[60px] text-sm"
                    maxLength={200}
                  />
                </div>
              </>
            )}

            <p className="text-xs text-muted-foreground">Free instant transfer between DataVend wallets.</p>
          </div>
        )}

        <DialogFooter>
          {showPasswordStep ? (
            <>
              <Button variant="outline" onClick={() => setShowPasswordStep(false)}>Back</Button>
              <Button
                variant="gold"
                onClick={handlePasswordVerify}
                disabled={verifyingPassword || sending || !password.trim()}
              >
                {verifyingPassword || sending ? <Loader2 className="animate-spin" size={16} /> : <>Confirm & Send</>}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                variant="gold"
                onClick={handleSend}
                disabled={!recipientId || !amount || Number(amount) <= 0 || Number(amount) > walletBalance}
              >
                Send {amount ? formatCurrency(Number(amount)) : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
