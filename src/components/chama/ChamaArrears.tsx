import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, Send, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Props {
  groupId: string;
  group: any;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string; phone: string } }>;
}

const FREQUENCY_HOURS: Record<string, number> = {
  'every_2_hours': 2,
  'daily': 24,
  'every_2_days': 48,
  'weekly': 168,
  'monthly': 720, // ~30 days
};

export function ChamaArrears({ groupId, group, members }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savings, setSavings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);

  const fetchSavings = async () => {
    const { data } = await supabase
      .from('chama_savings')
      .select('*')
      .eq('group_id', groupId);
    if (data) setSavings(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSavings();
    
    // The Realtime channel ensures that as soon as the Edge Function 
    // inserts the new savings records upon successful callback, 
    // fetchSavings() is called and the "Pay Now" button disappears.
    const channel = supabase
      .channel('arrears-updates')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chama_savings', 
          filter: `group_id=eq.${groupId}` 
        }, 
        () => {
          console.log("New savings detected, refreshing arrears...");
          fetchSavings();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const handlePayArrears = async (m: any) => {
    if (!user || m.user_id !== user.id) return;
    setPaying(m.user_id);
    try {
      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone: m.profile?.phone,
          amount: m.arrearsAmount,
          userId: user.id,
          purpose: 'chama_savings',
          groupId,
          // metadata informs the Edge Function to backfill missed months
          metadata: {
            type: 'arrears_clearance',
            missed_count: m.missedCount,
            isArrears: true
          }
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ 
        title: 'STK Push Sent', 
        description: `Initiated payment for KES ${m.arrearsAmount.toLocaleString()}. The list will update automatically upon completion.` 
      });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setPaying(null);
    }
  };

  const getExpectedPeriods = () => {
    if (!group?.contribution_amount || group.contribution_amount === 0) return [];
    const freq = group?.contribution_frequency || 'monthly';
    const hours = FREQUENCY_HOURS[freq] || 720;
    const start = new Date(group.created_at);
    const now = new Date();
    const periods: Date[] = [];
    let current = new Date(start);

    current = new Date(current.getTime() + hours * 60 * 60 * 1000);

    while (current <= now) {
      periods.push(new Date(current));
      current = new Date(current.getTime() + hours * 60 * 60 * 1000);
    }
    return periods;
  };

  const expectedPeriods = getExpectedPeriods();
  const expectedCount = expectedPeriods.length;

  const memberArrears = members.map(m => {
    const memberSavings = savings.filter(s => s.user_id === m.user_id);
    const paidCount = memberSavings.length;
    const missedCount = Math.max(0, expectedCount - paidCount);
    const arrearsAmount = missedCount * (group?.contribution_amount || 0);
    return {
      ...m,
      paidCount,
      missedCount,
      arrearsAmount,
      totalPaid: memberSavings.reduce((s, sv) => s + sv.amount, 0),
    };
  }).filter(m => m.missedCount > 0).sort((a, b) => b.arrearsAmount - a.arrearsAmount);

  if (loading) return <div className="h-32 bg-muted animate-pulse rounded-xl" />;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-xs text-muted-foreground">Members in Arrears</p>
        <p className="text-2xl font-bold text-destructive">{memberArrears.length}</p>
        {expectedCount === 0 && (
          <p className="text-xs text-muted-foreground mt-1">No payment period has elapsed yet.</p>
        )}
      </Card>

      {memberArrears.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500" />
          {expectedCount === 0
            ? 'No payment is due yet. Arrears will appear after the first period elapses.'
            : '🎉 No members in arrears. Everyone is up to date!'}
        </Card>
      ) : (
        <div className="space-y-2">
          {memberArrears.map(m => (
            <Card key={m.user_id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{m.profile?.full_name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">{m.profile?.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-bold text-destructive">KES {m.arrearsAmount.toLocaleString()}</p>
                    <p className="text-[11px] text-muted-foreground">{m.missedCount} missed payment{m.missedCount > 1 ? 's' : ''}</p>
                  </div>
                  {m.user_id === user?.id && (
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      className="h-8 gap-1 text-xs"
                      onClick={() => handlePayArrears(m)}
                      disabled={paying === m.user_id}
                    >
                      {paying === m.user_id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                      Pay Now
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
