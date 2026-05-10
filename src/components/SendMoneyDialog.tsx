import { useState, useEffect } from 'react';
import { Send, Loader2, User, Lock, Smartphone, Building2, Users, UserCheck, Fingerprint } from 'lucide-react';
import { hasSavedCredential, authenticateWithFingerprint } from '@/lib/webauthn';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type RecipientType = 'self' | 'mpesa' | 'bank' | 'dasnet';

interface SendMoneyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletBalance: number;
  onSuccess: () => void;
}

const FEE_RATES: Record<RecipientType, number> = {
  self: 0,      // free withdrawal to own number (still M-Pesa, but free)
  mpesa: 0.04,  // 4%
  bank: 0.05,   // 5%
  dasnet: 0,    // free
};

const TYPE_LABEL: Record<RecipientType, string> = {
  self: 'My M-Pesa Number',
  mpesa: 'Other M-Pesa Number',
  bank: 'Bank Account',
  dasnet: 'Dasnet User',
};

export function SendMoneyDialog({ open, onOpenChange, walletBalance, onSuccess }: SendMoneyDialogProps) {
  const { user, profile } = useAuth();
  const [recipientType, setRecipientType] = useState<RecipientType>('dasnet');
  const [phone, setPhone] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState(false);
  const [password, setPassword] = useState('');
  const [showPasswordStep, setShowPasswordStep] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);

  const formatCurrency = (a: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(a);

  useEffect(() => {
    if (!open) {
      setRecipientType('dasnet');
      setPhone(''); setBankName(''); setBankAccount('');
      setAmount(''); setReason('');
      setRecipientName(null); setRecipientId(null);
      setPassword(''); setShowPasswordStep(false);
    }
  }, [open]);

  // Auto-fill phone when "self" chosen
  useEffect(() => {
    if (recipientType === 'self' && profile?.phone) setPhone(profile.phone);
    if (recipientType !== 'dasnet') { setRecipientName(null); setRecipientId(null); }
  }, [recipientType, profile]);

  // Look up Dasnet user when typing
  useEffect(() => {
    if (recipientType !== 'dasnet') return;
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length >= 10) searchUser(cleaned);
    else { setRecipientName(null); setRecipientId(null); }
  }, [phone, recipientType]);

  const searchUser = async (phoneNumber: string) => {
    setSearching(true);
    setRecipientName(null); setRecipientId(null);
    try {
      const { data, error } = await supabase.rpc('lookup_dasnet_user_by_phone' as any, { _phone: phoneNumber });
      if (error) {
        console.warn('lookup_dasnet_user_by_phone error:', error);
        setRecipientName('User not on Dasnet');
        return;
      }
      const row = Array.isArray(data) && data.length > 0 ? (data[0] as any) : null;
      if (row) {
        if (row.user_id === user?.id) {
          setRecipientName('⚠️ This is your own account — switch to "My M-Pesa Number"');
          setRecipientId(null);
        } else {
          setRecipientName(row.full_name);
          setRecipientId(row.user_id);
        }
      } else {
        setRecipientName('User not on Dasnet');
      }
    } finally {
      setSearching(false);
    }
  };

  const amt = Number(amount) || 0;
  const feeRate = FEE_RATES[recipientType];
  const fee = Math.round(amt * feeRate);
  const totalDebit = amt + fee;
  const insufficient = totalDebit > walletBalance;

  const canProceed = (() => {
    if (!amt || amt <= 0 || insufficient) return false;
    if (recipientType === 'dasnet') return !!recipientId;
    if (recipientType === 'self' || recipientType === 'mpesa') return phone.replace(/\D/g, '').length >= 10;
    if (recipientType === 'bank') return !!bankName && bankAccount.length >= 6;
    return false;
  })();

  const handleSend = () => {
    if (!canProceed) return;
    setPassword('');
    setShowPasswordStep(true);
  };

  const handlePasswordVerify = async () => {
    if (!password.trim() || !user?.email) return;
    setVerifyingPassword(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password });
      if (error) { toast.error('Incorrect password'); return; }
      await executeSend();
    } finally {
      setVerifyingPassword(false);
    }
  };

  const handleFingerprintAuth = async () => {
    setVerifyingPassword(true);
    try {
      const cred = await authenticateWithFingerprint();
      if (!cred?.password) { toast.error('Fingerprint not verified'); return; }
      const { error } = await supabase.auth.signInWithPassword({ email: cred.email, password: cred.password });
      if (error) { toast.error('Authorization failed'); return; }
      await executeSend();
    } finally {
      setVerifyingPassword(false);
    }
  };

  const sendNotificationEmails = async (
    txnType: string,
    description: string,
    recipientEmail?: string | null,
    recipientFirstName?: string,
  ) => {
    try {
      const dateStr = new Date().toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
      if (profile?.email) {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'transaction-notification',
            recipientEmail: profile.email,
            idempotencyKey: `txn-${user?.id}-${Date.now()}`,
            templateData: {
              name: (profile.full_name || 'Member').split(' ')[0],
              type: txnType,
              amount: formatCurrency(amt),
              status: 'Completed',
              date: dateStr,
              description,
            },
          },
        });
      }
      if (recipientEmail) {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'transaction-notification',
            recipientEmail,
            idempotencyKey: `txn-recv-${recipientEmail}-${Date.now()}`,
            templateData: {
              name: recipientFirstName || 'Member',
              type: 'Money Received',
              amount: formatCurrency(amt),
              status: 'Completed',
              date: dateStr,
              description: `You received ${formatCurrency(amt)} from ${profile?.full_name || 'a Dasnet user'}.${reason ? ` Reason: ${reason}` : ''}`,
            },
          },
        });
      }
    } catch (e) { console.warn('Email notify failed:', e); }
  };

  const executeSend = async () => {
    if (!user) return;
    setSending(true);
    try {
      if (recipientType === 'dasnet') {
        if (!recipientId) return;
        const { error } = await supabase.rpc('transfer_wallet_funds', {
          _sender_id: user.id,
          _receiver_id: recipientId,
          _amount: amt,
          _reason: reason || null,
          _sender_name: profile?.full_name || null,
          _receiver_name: recipientName || null,
        });
        if (error) throw error;

        const [{ data: senderW }, { data: recvW }, { data: recvProf }] = await Promise.all([
          supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
          supabase.from('wallets').select('balance').eq('user_id', recipientId).maybeSingle(),
          supabase.from('profiles').select('phone, full_name, email').eq('user_id', recipientId).maybeSingle(),
        ]);

        await Promise.all([
          supabase.from('notifications').insert({
            user_id: recipientId, title: '💰 Money Received',
            message: `You received ${formatCurrency(amt)} from ${profile?.full_name || 'a Dasnet user'}.${reason ? ` Reason: ${reason}` : ''}`,
          }),
          supabase.from('notifications').insert({
            user_id: user.id, title: '💸 Money Sent',
            message: `You sent ${formatCurrency(amt)} to ${recipientName} successfully.${reason ? ` Reason: ${reason}` : ''}`,
          }),
        ]);

        const senderFirst = (profile?.full_name || 'Member').split(' ')[0];
        const recvFirst = (recvProf?.full_name || recipientName || 'Member').split(' ')[0];
        const amtStr = `KES ${Math.round(amt).toLocaleString()}`;
        const senderBalStr = `KES ${Math.round(Number(senderW?.balance || 0)).toLocaleString()}`;
        const recvBalStr = `KES ${Math.round(Number(recvW?.balance || 0)).toLocaleString()}`;
        const smsCalls: Promise<any>[] = [];
        if (profile?.phone) smsCalls.push(supabase.functions.invoke('send-sms', { body: { phone: profile.phone, message: `Dear ${senderFirst}, you have sent ${amtStr} to ${recipientName}. New wallet balance: ${senderBalStr}. Thank you for banking with DASNET VENTURES.` } }));
        if (recvProf?.phone) smsCalls.push(supabase.functions.invoke('send-sms', { body: { phone: recvProf.phone, message: `Dear ${recvFirst}, you have received ${amtStr} from ${profile?.full_name || 'a Dasnet user'}. New wallet balance: ${recvBalStr}. — DASNET VENTURES.` } }));
        Promise.all(smsCalls).catch(() => {});

        sendNotificationEmails(
          'Money Sent',
          `You sent ${formatCurrency(amt)} to ${recipientName}. New wallet balance: ${formatCurrency(Number(senderW?.balance || 0))}.`,
          recvProf?.email,
        );

        toast.success(`${formatCurrency(amt)} sent successfully!`);
      } else if (recipientType === 'self' || recipientType === 'mpesa') {
        // M-Pesa B2C withdrawal — fee 4% (0% for self)
        const txnLabel = recipientType === 'self' ? 'Withdraw to my M-Pesa' : 'Sent to M-Pesa';
        const { data, error } = await supabase.functions.invoke('mpesa-b2c-request', {
          body: {
            amount: amt,
            phone: phone.trim(),
            remarks: recipientType === 'self' ? 'Withdraw to my number' : `${txnLabel}${reason ? `: ${reason}` : ''}`,
            fee,
          },
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || 'M-Pesa transfer failed');
        toast.success(`${formatCurrency(amt)} is being processed. Fee: ${formatCurrency(fee)}.`);

        // NOTE: Sender + recipient SMS and email are sent ONLY after M-Pesa
        // confirms success (handled by the mpesa-b2c-result edge function).
        // We intentionally do NOT send any "on the way" notification here,
        // because failures (insufficient float, etc.) would falsely tell the
        // recipient they have received money.
      } else if (recipientType === 'bank') {
        // Record a pending bank-transfer withdrawal request — admin processes manually
        const { data: insertedRows, error } = await supabase.from('withdrawal_requests').insert({
          user_id: user.id,
          amount: amt,
          fee,
          phone: bankAccount,
          method: 'bank',
          bank_name: bankName,
          status: 'pending',
          remarks: reason || `Bank transfer to ${bankName} ${bankAccount}`,
        } as any).select('id').limit(1);
        if (error) throw error;
        const ref = (insertedRows?.[0]?.id || '').toString().slice(0, 10).toUpperCase() || 'DASNET';
        toast.success(`Bank transfer of ${formatCurrency(amt)} submitted. Fee: ${formatCurrency(fee)}. Processed within 1 business day.`);

        const bankAmtStr = `KES ${Math.round(amt).toLocaleString()}`;
        // Sender confirmation SMS
        if (profile?.phone) {
          supabase.functions.invoke('send-sms', {
            body: { phone: profile.phone, message: `Dear ${(profile.full_name || 'Member').split(' ')[0]}, you have sent ${bankAmtStr} to ${bankName} A/C ${bankAccount}. Reference: ${ref}. You'll be notified once the bank confirms. — DASNET VENTURES.` },
          }).catch(() => {});
        }

        sendNotificationEmails(
          'Bank Transfer Submitted',
          `Your bank transfer of ${formatCurrency(amt)} to ${bankName} (${bankAccount}) has been submitted. Fee: ${formatCurrency(fee)}. Reference: ${ref}.`,
        );
      }

      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setSending(false);
    }
  };

  const TypeButton = ({ t, icon: Icon, label, sub }: { t: RecipientType; icon: any; label: string; sub: string }) => (
    <button
      type="button"
      onClick={() => setRecipientType(t)}
      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${
        recipientType === t
          ? 'border-accent bg-accent/15 text-accent shadow-sm'
          : 'border-border bg-background hover:border-accent/40 text-foreground'
      }`}
    >
      <Icon size={20} />
      <span className="text-xs font-bold leading-tight">{label}</span>
      <span className={`text-[10px] leading-tight ${recipientType === t ? 'text-accent/80' : 'text-muted-foreground'}`}>{sub}</span>
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showPasswordStep ? <Lock size={18} /> : <Send size={18} />}
            {showPasswordStep ? 'Authorize Transfer' : 'Send Money'}
          </DialogTitle>
        </DialogHeader>

        {showPasswordStep ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-1">
              <p className="text-xs text-muted-foreground">Sending to {TYPE_LABEL[recipientType]}</p>
              <p className="text-2xl font-bold font-display text-primary">{formatCurrency(amt)}</p>
              {fee > 0 && <p className="text-xs text-muted-foreground">+ Fee: {formatCurrency(fee)} = Total {formatCurrency(totalDebit)}</p>}
              <p className="text-sm text-foreground">
                {recipientType === 'dasnet' && <>to <span className="font-semibold">{recipientName}</span></>}
                {(recipientType === 'self' || recipientType === 'mpesa') && <>to <span className="font-semibold">{phone}</span></>}
                {recipientType === 'bank' && <>to <span className="font-semibold">{bankName} · {bankAccount}</span></>}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 space-y-3">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Lock size={14} className="text-accent" /> Enter your password to authorize
              </Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your account password" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordVerify(); }} />
              {hasSavedCredential() && (
                <Button type="button" variant="outline" className="w-full" onClick={handleFingerprintAuth} disabled={verifyingPassword || sending}>
                  <Fingerprint size={16} className="mr-2 text-accent" /> Authorize with Fingerprint
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-center">
              <p className="text-xs text-muted-foreground">Available Balance</p>
              <p className="text-2xl font-bold font-display text-accent">{formatCurrency(walletBalance)}</p>
            </div>

            <div>
              <Label className="text-xs mb-2 block">Send to</Label>
              <div className="grid grid-cols-2 gap-2">
                <TypeButton t="dasnet" icon={Users} label="Dasnet User" sub="Free · Instant" />
                <TypeButton t="self" icon={UserCheck} label="My M-Pesa" sub="Free · Withdraw" />
                <TypeButton t="mpesa" icon={Smartphone} label="Other M-Pesa" sub="4% fee" />
                <TypeButton t="bank" icon={Building2} label="Bank Account" sub="5% fee" />
              </div>
            </div>

            {(recipientType === 'self' || recipientType === 'mpesa' || recipientType === 'dasnet') && (
              <div>
                <Label className="text-xs">{recipientType === 'self' ? 'Your M-Pesa Number' : 'Recipient Phone Number'}</Label>
                <div className="relative mt-1">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX"
                    disabled={recipientType === 'self'} />
                  {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" size={16} />}
                </div>
                {recipientType === 'dasnet' && recipientName && (
                  <div className={`mt-2 flex items-center gap-2 p-2 rounded-lg ${recipientId ? 'bg-success/10 border border-success/20' : 'bg-destructive/10 border border-destructive/20'}`}>
                    <User size={14} className={recipientId ? 'text-success' : 'text-destructive'} />
                    <span className={`text-sm font-medium ${recipientId ? 'text-success' : 'text-destructive'}`}>{recipientName}</span>
                  </div>
                )}
              </div>
            )}

            {recipientType === 'bank' && (
              <div className="space-y-2">
                <div>
                  <Label className="text-xs">Bank Name</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. KCB, Equity, Co-op" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Account Number</Label>
                  <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, ''))} placeholder="Account number" className="mt-1" />
                </div>
              </div>
            )}

            <div>
              <Label className="text-sm font-semibold text-foreground">Amount (KES)</Label>
              <Input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                max={walletBalance}
                style={{ color: 'hsl(var(--foreground))' }}
                className="mt-1.5 h-14 text-2xl font-extrabold tabular-nums bg-background border-2 border-border focus-visible:border-accent placeholder:text-muted-foreground/40 placeholder:font-normal placeholder:text-lg"
              />
              {amt > 0 && (
                <div className="mt-2 p-2.5 rounded-lg bg-muted/40 border border-border/40 text-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-medium tabular-nums text-foreground">{formatCurrency(amt)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Fee ({(feeRate * 100).toFixed(0)}%)</span><span className="font-medium tabular-nums text-foreground">{formatCurrency(fee)}</span></div>
                  <div className="flex justify-between border-t border-border/40 pt-1"><span className="font-semibold text-foreground">Total Debit</span><span className={`font-bold tabular-nums ${insufficient ? 'text-destructive' : 'text-accent'}`}>{formatCurrency(totalDebit)}</span></div>
                  {insufficient && <p className="text-destructive text-[11px]">Insufficient balance</p>}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Reason (optional)</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Payment for goods, Gift, etc." className="mt-1 min-h-[50px] text-sm" maxLength={200} />
            </div>
          </div>
        )}

        <DialogFooter>
          {showPasswordStep ? (
            <>
              <Button variant="outline" onClick={() => setShowPasswordStep(false)}>Back</Button>
              <Button variant="gold" onClick={handlePasswordVerify} disabled={verifyingPassword || sending || !password.trim()}>
                {verifyingPassword || sending ? <Loader2 className="animate-spin" size={16} /> : <>Confirm & Send</>}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="gold" onClick={handleSend} disabled={!canProceed} className="font-bold tabular-nums">
                {amt > 0 ? `Send ${formatCurrency(amt)}` : 'Send'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
