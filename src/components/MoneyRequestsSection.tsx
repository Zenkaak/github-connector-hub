import { useState, useEffect } from 'react';
import { HandCoins, Loader2, XCircle, CheckCircle, Clock, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MoneyRequest {
  id: string;
  requester_id: string;
  target_id: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface MoneyRequestsSectionProps {
  walletBalance: number;
  onRefresh: () => void;
}

export function MoneyRequestsSection({ walletBalance, onRefresh }: MoneyRequestsSectionProps) {
  const { user, profile } = useAuth();
  const [requests, setRequests] = useState<MoneyRequest[]>([]);
  const [requesterNames, setRequesterNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [payDialog, setPayDialog] = useState<MoneyRequest | null>(null);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  const formatCurrency = (amt: number) =>
    new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0 }).format(amt);

  const fetchRequests = async () => {
    if (!user) return;
    try {
      // Fetch requests where I'm the target (incoming) or requester (outgoing)
      const { data } = await supabase
        .from('money_requests')
        .select('*')
        .or(`target_id.eq.${user.id},requester_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data && data.length > 0) {
        setRequests(data);
        // Fetch requester names
        const userIds = [...new Set(data.map(r => r.requester_id === user.id ? r.target_id : r.requester_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', userIds);
        if (profiles) {
          const nameMap: Record<string, string> = {};
          profiles.forEach(p => { nameMap[p.user_id] = p.full_name; });
          setRequesterNames(nameMap);
        }
      }
    } catch (err) {
      console.error('Error fetching requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  const handleDecline = async (req: MoneyRequest) => {
    setProcessing(req.id);
    try {
      const { error } = await supabase
        .from('money_requests')
        .update({ status: 'declined', updated_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: req.requester_id,
        title: '❌ Request Declined',
        message: `Your money request of ${formatCurrency(req.amount)} was declined.`,
      });

      toast.success('Request declined');
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline');
    } finally {
      setProcessing(null);
    }
  };

  const handlePayConfirm = async () => {
    if (!payDialog || !password.trim() || !user?.email) return;
    setVerifying(true);
    try {
      // Verify password
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      });
      if (authErr) {
        toast.error('Incorrect password');
        return;
      }

      // Execute transfer via RPC
      const requesterName = requesterNames[payDialog.requester_id] || 'Unknown';
      const { data, error } = await supabase.rpc('transfer_wallet_funds', {
        _sender_id: user.id,
        _receiver_id: payDialog.requester_id,
        _amount: payDialog.amount,
        _reason: 'Money request payment',
        _sender_name: profile?.full_name || null,
        _receiver_name: requesterName,
      });

      if (error) throw error;
      const result = data as any;
      if (!result?.success) {
        toast.error(result?.error || 'Transfer failed');
        return;
      }

      // Update request status
      await supabase
        .from('money_requests')
        .update({ status: 'paid', updated_at: new Date().toISOString() })
        .eq('id', payDialog.id);

      // Notifications
      await Promise.all([
        supabase.from('notifications').insert({
          user_id: payDialog.requester_id,
          title: '💰 Request Paid',
          message: `${profile?.full_name || 'Someone'} paid your money request of ${formatCurrency(payDialog.amount)}.`,
        }),
        supabase.from('notifications').insert({
          user_id: user.id,
          title: '💸 Request Payment Sent',
          message: `You paid ${formatCurrency(payDialog.amount)} to ${requesterName} for their money request.`,
        }),
      ]);

      toast.success(`${formatCurrency(payDialog.amount)} sent successfully!`);
      setPayDialog(null);
      setPassword('');
      fetchRequests();
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setVerifying(false);
    }
  };

  if (loading || requests.length === 0) return null;

  return (
    <>
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HandCoins size={16} className="text-accent" />
            Money Requests
          </CardTitle>
          <CardDescription>Incoming and outgoing money requests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {requests.map((req) => {
            const isIncoming = req.target_id === user?.id;
            const otherName = requesterNames[isIncoming ? req.requester_id : req.target_id] || 'Unknown';
            const isPending = req.status === 'pending';

            return (
              <div
                key={req.id}
                className={cn(
                  'p-3 rounded-xl border',
                  req.status === 'paid' ? 'bg-success/5 border-success/20' :
                  req.status === 'declined' ? 'bg-destructive/5 border-destructive/20' :
                  'bg-muted/40 border-border/40'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      req.status === 'paid' ? 'bg-success/10' :
                      req.status === 'declined' ? 'bg-destructive/10' :
                      'bg-accent/10'
                    )}>
                      {req.status === 'paid' ? <CheckCircle size={14} className="text-success" /> :
                       req.status === 'declined' ? <XCircle size={14} className="text-destructive" /> :
                       <Clock size={14} className="text-accent" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {isIncoming ? `${otherName} requests from you` : `You requested from ${otherName}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(req.created_at).toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-sm text-foreground">{formatCurrency(req.amount)}</p>
                    {!isPending && (
                      <span className={cn('text-[10px] font-bold uppercase',
                        req.status === 'paid' && 'text-success',
                        req.status === 'declined' && 'text-destructive',
                      )}>{req.status}</span>
                    )}
                  </div>
                </div>

                {/* Action buttons for incoming pending requests */}
                {isIncoming && isPending && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-1"
                      disabled={processing === req.id}
                      onClick={() => handleDecline(req)}
                    >
                      {processing === req.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
                      Decline
                    </Button>
                    <Button
                      variant="gold"
                      size="sm"
                      className="flex-1 gap-1"
                      disabled={processing === req.id}
                      onClick={() => {
                        if (req.amount > walletBalance) {
                          toast.error('Insufficient balance');
                          return;
                        }
                        setPassword('');
                        setPayDialog(req);
                      }}
                    >
                      <CheckCircle size={12} />
                      Pay {formatCurrency(req.amount)}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Pay confirmation dialog */}
      <Dialog open={!!payDialog} onOpenChange={() => { setPayDialog(null); setPassword(''); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock size={18} /> Authorize Payment
            </DialogTitle>
          </DialogHeader>
          {payDialog && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/40 border border-border/40 text-center space-y-1">
                <p className="text-xs text-muted-foreground">Paying</p>
                <p className="text-3xl font-bold font-display text-primary">{formatCurrency(payDialog.amount)}</p>
                <p className="text-sm text-muted-foreground">
                  to <span className="font-semibold text-foreground">{requesterNames[payDialog.requester_id] || 'Unknown'}</span>
                </p>
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
                  onKeyDown={(e) => { if (e.key === 'Enter') handlePayConfirm(); }}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayDialog(null); setPassword(''); }}>Cancel</Button>
            <Button
              variant="gold"
              onClick={handlePayConfirm}
              disabled={verifying || !password.trim()}
            >
              {verifying ? <Loader2 className="animate-spin" size={16} /> : <>Confirm & Pay</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
