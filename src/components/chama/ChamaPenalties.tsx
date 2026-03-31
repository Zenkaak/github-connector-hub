import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, Shield, CheckCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Penalty {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  is_paid: boolean;
  created_at: string;
}

interface Props {
  groupId: string;
  group: any;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string; phone: string } }>;
  myRole: string;
}

export function ChamaPenalties({ groupId, group, members, myRole }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);
  const [enforcing, setEnforcing] = useState(false);
  const [payDialog, setPayDialog] = useState<{ open: boolean; penalty: Penalty | null }>({ open: false, penalty: null });
  const [payPhone, setPayPhone] = useState('');
  const [paying, setPaying] = useState(false);

  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);

  const getMemberName = (userId: string) => members.find(m => m.user_id === userId)?.profile?.full_name || 'Unknown';

  const fetchPenalties = async () => {
    const { data } = await supabase
      .from('chama_penalties')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (data) setPenalties(data as Penalty[]);
    setLoading(false);
  };

  useEffect(() => { fetchPenalties(); }, [groupId]);

  const handleEnforcePenalties = async () => {
    if (!group.late_penalty_enabled || !group.late_penalty_amount) {
      toast({ title: 'Penalties not configured', description: 'Enable late penalties in Settings first.', variant: 'destructive' });
      return;
    }
    setEnforcing(true);
    try {
      const now = new Date();
      const frequency = group.savings_frequency || 'monthly';
      let periodStart: Date;

      switch (frequency) {
        case 'daily': periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break;
        case 'weekly': { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); periodStart = d; break; }
        default: periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      const periodDate = periodStart.toISOString().split('T')[0];

      const { data: savings } = await supabase
        .from('chama_savings')
        .select('user_id')
        .eq('group_id', groupId)
        .gte('created_at', periodDate);

      const paidUserIds = new Set(savings?.map(s => s.user_id) || []);

      const { data: existingPenalties } = await supabase
        .from('chama_penalties')
        .select('user_id')
        .eq('group_id', groupId)
        .gte('created_at', periodDate)
        .eq('reason', 'Late contribution penalty');

      const penalizedUserIds = new Set((existingPenalties as any[])?.map(p => p.user_id) || []);

      const delinquent = members.filter(m => !paidUserIds.has(m.user_id) && !penalizedUserIds.has(m.user_id));

      if (delinquent.length === 0) {
        toast({ title: 'No penalties needed', description: 'All members are up to date or already penalized.' });
        setEnforcing(false);
        return;
      }

      const penaltyAmount = group.late_penalty_type === 'percentage'
        ? Math.round((group.savings_amount || 0) * (group.late_penalty_amount / 100))
        : group.late_penalty_amount;

      const newPenalties = delinquent.map(m => ({
        group_id: groupId,
        user_id: m.user_id,
        amount: penaltyAmount,
        reason: 'Late contribution penalty',
        period_date: periodDate,
      }));

      const { error } = await supabase.from('chama_penalties').insert(newPenalties as any);
      if (error) throw error;

      const notifications = delinquent.map(m => ({
        user_id: m.user_id,
        title: '⚠️ Late Penalty Applied',
        message: `A late contribution penalty of KES ${penaltyAmount.toLocaleString()} has been applied for the period ${periodDate}. Please make your savings contribution.`,
      }));
      await supabase.from('notifications').insert(notifications);

      toast({ title: `${delinquent.length} penalties applied`, description: `KES ${penaltyAmount} each for late contributions` });
      fetchPenalties();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setEnforcing(false); }
  };

  const handleMarkPaid = async (penaltyId: string) => {
    try {
      await supabase.from('chama_penalties').update({ status: 'paid' } as any).eq('id', penaltyId);
      toast({ title: 'Penalty marked as paid' });
      fetchPenalties();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handlePayPenalty = async () => {
    if (!payDialog.penalty || !payPhone || !user) return;
    setPaying(true);
    try {
      const phone = payPhone.trim();
      if (!phone || phone.length < 10) throw new Error('Enter a valid phone number');
      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone,
          amount: payDialog.penalty.amount,
          userId: user.id,
          purpose: 'chama_penalty',
          groupId,
          penaltyId: payDialog.penalty.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: 'STK Push Sent', description: 'Check your phone to complete payment.' });
      setPayDialog({ open: false, penalty: null });
      setPayPhone('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setPaying(false);
    }
  };

  const totalUnpaid = penalties.filter(p => !p.is_paid).reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = penalties.filter(p => p.is_paid).reduce((sum, p) => sum + p.amount, 0);
  const myPenalties = penalties.filter(p => p.user_id === user?.id);
  const myUnpaid = myPenalties.filter(p => !p.is_paid);

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Penalties
          </h2>
          <div className="flex gap-3 mt-0.5">
            {totalUnpaid > 0 && (
              <p className="text-xs text-destructive">Unpaid: KES {totalUnpaid.toLocaleString()}</p>
            )}
            {totalPaid > 0 && (
              <p className="text-xs text-emerald-500">Paid: KES {totalPaid.toLocaleString()}</p>
            )}
          </div>
        </div>
        {isLeader && group.late_penalty_enabled && (
          <Button size="sm" variant="destructive" className="gap-1.5" onClick={handleEnforcePenalties} disabled={enforcing}>
            {enforcing ? <><Loader2 size={14} className="animate-spin" /> Checking...</> : <><Shield size={14} /> Enforce Penalties</>}
          </Button>
        )}
      </div>

      {/* My unpaid penalties alert */}
      {myUnpaid.length > 0 && (
        <Card className="p-4 border-destructive/30 bg-destructive/5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-destructive">You have {myUnpaid.length} unpaid penalt{myUnpaid.length === 1 ? 'y' : 'ies'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Total: KES {myUnpaid.reduce((s, p) => s + p.amount, 0).toLocaleString()}</p>
            </div>
          </div>
        </Card>
      )}

      {!group.late_penalty_enabled && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <p className="text-sm text-amber-600 flex items-center gap-2">
            <AlertTriangle size={14} /> Late penalties are not enabled. The Chairperson can enable them in Settings.
          </p>
        </Card>
      )}

      {penalties.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle size={32} className="mx-auto text-emerald-500/30 mb-3" />
          <p className="text-sm font-medium">No Penalties</p>
          <p className="text-xs text-muted-foreground mt-1">You currently have no penalties. Keep it up!</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {/* Leaders see all penalties, members see only theirs */}
          {(isLeader ? penalties : myPenalties).map(p => (
            <Card key={p.id} className={`p-4 ${p.status === 'unpaid' ? 'border-destructive/20' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    p.status === 'paid' ? 'bg-emerald-500/10' : 'bg-destructive/10'
                  }`}>
                    {p.status === 'paid' ? <CheckCircle size={14} className="text-emerald-500" /> : <AlertTriangle size={14} className="text-destructive" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{isLeader ? getMemberName(p.user_id) : p.reason}</p>
                    <p className="text-xs text-muted-foreground">{p.reason} • {format(new Date(p.created_at), 'MMM d, yyyy')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${p.status === 'paid' ? 'text-emerald-500' : 'text-destructive'}`}>
                    KES {p.amount.toLocaleString()}
                  </span>
                  {/* Pay Now button for ANY member with unpaid penalty (including leaders) */}
                  {p.status === 'unpaid' && p.user_id === user?.id && (
                    <Button size="sm" variant="gold" className="text-xs h-7 gap-1" onClick={() => {
                      const myPhone = members.find(m => m.user_id === user?.id)?.profile?.phone || '';
                      setPayPhone(myPhone);
                      setPayDialog({ open: true, penalty: p });
                    }}>
                      <Send size={12} /> Pay Now
                    </Button>
                  )}
                  {isLeader && p.status === 'unpaid' && p.user_id !== user?.id && (
                    <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => handleMarkPaid(p.id)}>
                      Mark Paid
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Pay Penalty Dialog */}
      <Dialog open={payDialog.open} onOpenChange={(open) => !open && setPayDialog({ open: false, penalty: null })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Pay Penalty</DialogTitle></DialogHeader>
          {payDialog.penalty && (
            <div className="space-y-4">
              <Card className="p-3 bg-destructive/5 border-destructive/20">
                <p className="text-sm font-medium text-destructive">{payDialog.penalty.reason}</p>
                <p className="text-2xl font-bold mt-1">KES {payDialog.penalty.amount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Period: {payDialog.penalty.period_date}</p>
              </Card>
              <div>
                <Label>M-Pesa Phone Number</Label>
                <Input value={payPhone} onChange={e => setPayPhone(e.target.value)} placeholder="0712345678" className="mt-1" />
              </div>
              <Button onClick={handlePayPenalty} disabled={paying || !payPhone} className="w-full gap-2">
                {paying ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <><Send size={14} /> Pay KES {payDialog.penalty.amount.toLocaleString()}</>}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
