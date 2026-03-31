import { useState, useEffect } from 'react';
import { Wallet, AlertTriangle, TrendingUp, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ChamaSavingsProps {
  groupId: string;
  group: any;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string; phone: string } }>;
  myRole: string;
  onRefreshGroup: () => void;
}

const FREQUENCY_LABELS: Record<string, string> = {
  every_2_hours: 'Every 2 Hours',
  daily: 'Daily',
  every_2_days: 'Every 2 Days',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

const FREQUENCY_HOURS: Record<string, number> = {
  every_2_hours: 2,
  daily: 24,
  every_2_days: 48,
  weekly: 168,
  monthly: 720,
};

export function ChamaSavings({
  groupId,
  group,
  members,
  myRole,
  onRefreshGroup,
}: ChamaSavingsProps) {

  const { user } = useAuth();
  const { toast } = useToast();

  const [savings, setSavings] = useState<any[]>([]);
  const [joiningFees, setJoiningFees] = useState<any[]>([]);
  const [platformFees, setPlatformFees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositing, setDepositing] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [frequency, setFrequency] = useState(group?.contribution_frequency || 'monthly');
  const [savingsAmount, setSavingsAmount] = useState(group?.contribution_amount?.toString() || '0');

  const isChairperson = myRole === 'chairperson';

  const fetchSavings = async () => {

    const [savingsRes, feesRes, platformRes] = await Promise.all([
      supabase.from('chama_savings').select('*').eq('group_id', groupId),
      supabase.from('chama_joining_fees').select('*').eq('group_id', groupId),
      supabase.from('chama_platform_fees').select('*').eq('group_id', groupId),
    ]);

    if (savingsRes.data) setSavings(savingsRes.data);
    if (feesRes.data) setJoiningFees(feesRes.data);
    if (platformRes.data) setPlatformFees(platformRes.data);

    setLoading(false);
  };

  useEffect(() => {
    fetchSavings();
  }, [groupId]);

  // SAFE TOTALS
  const totalSavings = savings.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalJoiningFees = joiningFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const totalPlatformFees = platformFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);

  const hasActivation = platformFees.some((f) => f.fee_type === 'activation');

  // PERIOD CALCULATION
  const getCurrentPeriodStart = () => {

    const freq = group?.savings_frequency || 'monthly';
    const hours = FREQUENCY_HOURS[freq] || 720;

    const now = new Date();
    const start = new Date(group?.created_at || now);

    const elapsed = now.getTime() - start.getTime();
    const periodMs = hours * 60 * 60 * 1000;

    const periodsElapsed = Math.floor(elapsed / periodMs);

    return new Date(start.getTime() + periodsElapsed * periodMs);
  };

  const periodStart = getCurrentPeriodStart();

  const currentPeriodSavings = savings.filter(
    (s) => new Date(s.created_at) >= periodStart
  );

  const paidUserIds = new Set(currentPeriodSavings.map((s) => s.user_id));

  const unpaidMembers = members.filter((m) => !paidUserIds.has(m.user_id));

  // MEMBER TOTALS
  const memberTotals = members.map((m) => ({
    ...m,
    total: savings
      .filter((s) => s.user_id === m.user_id)
      .reduce((sum, s) => sum + Number(s.amount || 0), 0),
    hasPaidCurrent: paidUserIds.has(m.user_id),
  }));

  // MPESA PAYMENT
  const handleDeposit = async () => {

    if (!user || !group?.savings_amount) return;

    setDepositing(true);

    try {

      const phone =
        members.find((m) => m.user_id === user.id)?.profile?.phone || '';

      let formattedPhone = phone.replace(/\+/g, '').replace(/\s/g, '');

      if (formattedPhone.startsWith('254'))
        formattedPhone = '0' + formattedPhone.slice(3);

      const { data, error } = await supabase.functions.invoke(
        'initiate-stk-push',
        {
          body: {
            phone: formattedPhone,
            amount: group.savings_amount,
            userId: user.id,
            purpose: 'chama_savings',
            groupId,
          },
        }
      );

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'STK Push Sent',
        description: 'Check your phone to complete payment.',
      });

      setDepositOpen(false);

      if (data?.reference) {
        pollPaymentStatus(data.reference);
      }

    } catch (err: any) {

      toast({
        title: 'Payment Failed',
        description: err.message,
        variant: 'destructive',
      });

    } finally {
      setDepositing(false);
    }
  };

  // FIXED PAYMENT POLLING
  const pollPaymentStatus = (reference: string) => {

    let attempts = 0;
    const maxAttempts = 20;

    const interval = setInterval(async () => {

      attempts++;

      const { data } = await supabase
        .from('stk_transactions')
        .select('*')
        .eq('reference', reference)
        .single();

      if (data?.status === 'success') {

        clearInterval(interval);

        const { data: existing } = await supabase
          .from('chama_savings')
          .select('id')
          .eq('group_id', groupId)
          .eq('user_id', user?.id)
          .limit(1);

        if (!existing || existing.length === 0) {

          await supabase.from('chama_savings').insert({
            group_id: groupId,
            user_id: user?.id,
            amount: group?.savings_amount || 0,
            payment_method: 'mpesa',
            status: 'completed',
          } as any);
        }

        toast({
          title: 'Payment Confirmed ✅',
          description: 'Savings recorded successfully.',
        });

        fetchSavings();
        onRefreshGroup();
      }

      if (data?.status === 'failed' || attempts >= maxAttempts) {

        clearInterval(interval);

        if (data?.status === 'failed') {
          toast({
            title: 'Payment Failed',
            description: 'M-Pesa payment not completed.',
            variant: 'destructive',
          });
        }
      }

    }, 3000);
  };

  // SETTINGS
  const handleSaveSettings = async () => {

    try {

      const { error } = await supabase
        .from('chama_groups')
        .update({
          contribution_frequency: frequency,
          contribution_amount: parseInt(savingsAmount),
        } as any)
        .eq('id', groupId);

      if (error) throw error;

      toast({ title: 'Settings Saved' });

      setSettingsOpen(false);
      onRefreshGroup();

    } catch (err: any) {

      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  const freqLabel =
    FREQUENCY_LABELS[group?.savings_frequency] ||
    group?.savings_frequency ||
    'Not Set';

  return (
    <div className="space-y-4">

      {/* SUMMARY */}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">

        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Savings Wallet</p>
          <p className="text-xl font-bold text-primary">
            KES {totalSavings.toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Joining Fees</p>
          <p className="text-xl font-bold">
            KES {totalJoiningFees.toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Platform Fees</p>
          <p className="text-xl font-bold">
            KES {totalPlatformFees.toLocaleString()}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Frequency</p>
          <p className="font-bold">{freqLabel}</p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Amount</p>
          <p className="font-bold">
            KES {group?.savings_amount?.toLocaleString() || '0'}
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Unpaid</p>
          <p className="font-bold text-destructive">
            {unpaidMembers.length}
          </p>
        </Card>

      </div>

      {/* ACTION */}

      {group?.savings_amount > 0 && (
        <Button onClick={() => setDepositOpen(true)}>
          <Wallet size={16} /> Deposit KES {group.savings_amount}
        </Button>
      )}

      {/* MEMBERS */}

      <Card>

        {memberTotals.map((m) => (

          <div
            key={m.user_id}
            className="flex justify-between p-4 border-b"
          >

            <div>
              <p className="font-medium">
                {m.profile?.full_name || 'Unknown'}
              </p>

              <p className="text-xs text-muted-foreground">
                Total: KES {m.total.toLocaleString()}
              </p>
            </div>

            {m.hasPaidCurrent ? (
              <span className="text-green-600 text-xs">Paid</span>
            ) : (
              <span className="text-red-500 text-xs flex items-center gap-1">
                <AlertTriangle size={12} /> Unpaid
              </span>
            )}

          </div>

        ))}

      </Card>

      {/* PAYMENT MODAL */}

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent>

          <DialogHeader>
            <DialogTitle>Pay Savings via M-Pesa</DialogTitle>
          </DialogHeader>

          <Button
            onClick={handleDeposit}
            disabled={depositing}
            className="w-full"
          >
            {depositing
              ? 'Processing...'
              : `Pay KES ${group?.savings_amount}`}
          </Button>

        </DialogContent>
      </Dialog>

    </div>
  );
        } 
