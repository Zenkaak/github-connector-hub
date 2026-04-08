import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  Loader2, 
  Info, 
  ArrowRight,
  RefreshCcw,
  Clock
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  groupId: string;
  group: any;
  members: Array<{ 
    user_id: string; 
    role: string; 
    profile?: { 
      full_name: string; 
      phone: string;
      avatar_url?: string;
    } 
  }>;
}

const FREQUENCY_HOURS: Record<string, number> = {
  'every_2_hours': 2,
  'daily': 24,
  'every_2_days': 48,
  'weekly': 168,
  'monthly': 720,
};

/**
 * ChamaArrears Component
 * Handles the calculation and real-time display of missed payments.
 * Uses a mathematical approach (Total Amount / Contribution) to handle
 * lump-sum arrears clearance.
 */
export function ChamaArrears({ groupId, group, members }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [savings, setSavings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // --- 1. DATA FETCHING ---
  const fetchSavings = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('chama_savings')
        .select('*')
        .eq('group_id', groupId);
      
      if (error) throw error;
      if (data) setSavings(data);
    } catch (err: any) {
      console.error("Fetch Savings Error:", err.message);
      toast({
        title: "Sync Error",
        description: "Could not retrieve latest savings data.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // --- 2. REALTIME SUBSCRIPTION ---
  useEffect(() => {
    fetchSavings();
    
    // Subscribe to the chama_savings table for the current group.
    // This listener ensures that when the M-Pesa Callback Edge Function
    // inserts a record, the UI updates instantly without a refresh.
    const channel = supabase
      .channel(`chama-arrears-${groupId}`)
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chama_savings', 
          filter: `group_id=eq.${groupId}` 
        }, 
        (payload) => {
          console.log("Realtime Data Sync:", payload);
          fetchSavings();
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log("Realtime Arrears Connected");
        }
      });

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [groupId]);

  // --- 3. PAYMENT HANDLER ---
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
          metadata: {
            type: 'arrears_clearance',
            missed_count: m.missedCount,
            isArrears: true,
            original_amount: m.arrearsAmount
          }
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ 
        title: 'STK Push Sent', 
        description: `Please enter your M-Pesa PIN to pay KES ${m.arrearsAmount.toLocaleString()}. The list will update automatically.` 
      });
    } catch (err: any) {
      toast({ 
        title: 'Payment Failed', 
        description: err.message, 
        variant: 'destructive' 
      });
    } finally {
      setPaying(null);
    }
  };

  // --- 4. PERIOD CALCULATIONS ---
  const getExpectedPeriods = () => {
    if (!group?.contribution_amount || group.contribution_amount === 0) return [];
    
    const freq = group?.contribution_frequency || 'monthly';
    const hours = FREQUENCY_HOURS[freq] || 720;
    const start = new Date(group.created_at);
    const now = new Date();
    const periods: Date[] = [];
    
    let current = new Date(start.getTime() + hours * 60 * 60 * 1000);

    while (current <= now) {
      periods.push(new Date(current));
      current = new Date(current.getTime() + hours * 60 * 60 * 1000);
    }
    return periods;
  };

  const expectedPeriods = getExpectedPeriods();
  const expectedCount = expectedPeriods.length;
  const contributionAmount = group?.contribution_amount || 1;

  // --- 5. ARREARS MAPPING & MATH FIX ---
  const memberArrears = members.map(m => {
    const memberSavings = savings.filter(s => s.user_id === m.user_id);
    
    // ✅ SUMMATION FIX:
    // We sum all payment amounts found in the database for this member.
    const totalPaidAmount = memberSavings.reduce((sum, s) => sum + s.amount, 0);
    
    // ✅ DIVISION FIX:
    // Instead of counting rows, we divide the total money paid by the expected amount.
    // Example: If 38 bob is paid and contribution is 1 bob, paidCount = 38.
    const paidCount = Math.floor(totalPaidAmount / contributionAmount);
    
    // ✅ OFFSET CALCULATION:
    const missedCount = Math.max(0, expectedCount - paidCount);
    const arrearsAmount = missedCount * contributionAmount;

    return {
      ...m,
      paidCount,
      missedCount,
      arrearsAmount,
      totalPaid: totalPaidAmount,
    };
  })
  .filter(m => m.missedCount > 0)
  .sort((a, b) => b.arrearsAmount - a.arrearsAmount);

  // --- 6. RENDER STATES ---
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-xl border" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            Outstanding Arrears
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info size={14} className="text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Based on {expectedCount} elapsed periods</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
          <p className="text-xs text-muted-foreground">Automatic calculations based on group start date</p>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => fetchSavings(true)}
          disabled={refreshing}
          className="h-8 w-8"
        >
          <RefreshCcw size={14} className={refreshing ? "animate-spin" : ""} />
        </Button>
      </div>

      <Card className="p-4 bg-destructive/5 border-destructive/20">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-destructive font-medium uppercase tracking-wider">Members in Arrears</p>
            <p className="text-3xl font-bold text-destructive">{memberArrears.length}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total Group Debt</p>
            <p className="text-lg font-semibold">
              KES {memberArrears.reduce((acc, curr) => acc + curr.arrearsAmount, 0).toLocaleString()}
            </p>
          </div>
        </div>
      </Card>

      {/* List Section */}
      {memberArrears.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h4 className="font-semibold text-emerald-900">All Caught Up!</h4>
          <p className="text-sm text-muted-foreground mt-1 max-w-[240px] mx-auto">
            {expectedCount === 0 
              ? "The first payment period hasn't elapsed yet. Check back soon!" 
              : "Every member has fulfilled their contribution requirements."}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {memberArrears.map((m) => (
            <Card key={m.user_id} className="overflow-hidden border-l-4 border-l-destructive">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center border">
                        <span className="text-sm font-bold uppercase">
                          {m.profile?.full_name?.substring(0, 2) || "M"}
                        </span>
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-destructive rounded-full border-2 border-background flex items-center justify-center">
                        <Clock size={10} className="text-white" />
                      </div>
                    </div>
                    <div>
                      <p className="font-bold text-sm leading-none mb-1">
                        {m.profile?.full_name || 'Anonymous Member'}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {m.paidCount} of {expectedCount} Paid
                        </span>
                        <span className="text-[10px] text-destructive font-medium">
                          {m.missedCount} Missed
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        Wallet Balance Offset: KES {m.totalPaid.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-lg font-black text-destructive leading-tight">
                      KES {m.arrearsAmount.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground mb-3">Due Arrears</p>
                    
                    {m.user_id === user?.id ? (
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="h-9 px-4 shadow-lg shadow-destructive/20 w-full animate-in fade-in slide-in-from-right-2"
                        onClick={() => handlePayArrears(m)}
                        disabled={paying === m.user_id}
                      >
                        {paying === m.user_id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <Send size={14} className="mr-2" />
                            Pay Now
                          </>
                        )}
                      </Button>
                    ) : (
                      <div className="flex items-center justify-end text-[10px] text-muted-foreground italic">
                        Awaiting Payment <ArrowRight size={10} className="ml-1" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
 
