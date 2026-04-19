import { useState, useEffect } from 'react';
import { 
  Wallet, 
  AlertTriangle, 
  TrendingUp, 
  Shield, 
  Clock, 
  CheckCircle2, 
  Settings2, 
  Info,
  ChevronRight,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PaybillBox } from '@/components/PaybillBox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Smartphone, CreditCard } from 'lucide-react';

interface ChamaSavingsProps {
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
  const [customAmount, setCustomAmount] = useState(group?.contribution_amount?.toString() || '0');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [frequency, setFrequency] = useState(group?.contribution_frequency || 'monthly');
  const [savingsAmount, setSavingsAmount] = useState(group?.contribution_amount?.toString() || '0');

  const isChairperson = myRole === 'chairperson';

  // -------------------------------------------------------------------------
  // 1. DATA FETCHING
  // -------------------------------------------------------------------------
  const fetchSavings = async () => {
    try {
      const [savingsRes, feesRes, platformRes] = await Promise.all([
        supabase.from('chama_savings').select('*').eq('group_id', groupId),
        supabase.from('chama_joining_fees').select('*').eq('group_id', groupId),
        supabase.from('chama_platform_fees').select('*').eq('group_id', groupId),
      ]);

      if (savingsRes.data) setSavings(savingsRes.data);
      if (feesRes.data) setJoiningFees(feesRes.data);
      if (platformRes.data) setPlatformFees(platformRes.data);
    } catch (err) {
      console.error("Critical error fetching chama data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavings();
    
    // Subscribe to changes for instant UI updates when M-Pesa callbacks land
    const channel = supabase
      .channel(`savings-realtime-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chama_savings', filter: `group_id=eq.${groupId}` }, () => {
        fetchSavings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  // -------------------------------------------------------------------------
  // 2. AGGREGATE CALCULATIONS
  // -------------------------------------------------------------------------
  const totalSavings = savings.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const totalJoiningFees = joiningFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);
  const totalPlatformFees = platformFees.reduce((sum, f) => sum + Number(f.amount || 0), 0);

  // Determine current period for "Unpaid" list logic
  const getCurrentPeriodStart = () => {
    const freq = group?.contribution_frequency || 'monthly';
    const hours = FREQUENCY_HOURS[freq] || 720;
    const now = new Date();
    const start = new Date(group?.created_at || now);
    const elapsed = now.getTime() - start.getTime();
    const periodMs = hours * 60 * 60 * 1000;
    const periodsElapsed = Math.floor(elapsed / periodMs);
    return new Date(start.getTime() + periodsElapsed * periodMs);
  };

  const periodStart = getCurrentPeriodStart();
  const currentPeriodSavings = savings.filter(s => new Date(s.created_at) >= periodStart);
  const paidUserIds = new Set(currentPeriodSavings.map(s => s.user_id));

  // -------------------------------------------------------------------------
  // 3. MEMBER STATUS & "PAID AHEAD" MATH
  // -------------------------------------------------------------------------
  const memberTotals = members.map((m) => {
    const userTotal = savings
      .filter((s) => s.user_id === m.user_id)
      .reduce((sum, s) => sum + Number(s.amount || 0), 0);
    
    // Logic: Calculate required amount from group inception to current moment
    const freq = group?.contribution_frequency || 'monthly';
    const hours = FREQUENCY_HOURS[freq] || 720;
    const groupStart = new Date(group?.created_at || new Date());
    const now = new Date();
    const elapsedMs = now.getTime() - groupStart.getTime();
    const periodMs = hours * 60 * 60 * 1000;
    
    // Total periods that have passed since the group started
    const totalPeriodsPassed = Math.floor(elapsedMs / periodMs) + 1;
    const requiredAmountToDate = totalPeriodsPassed * (group?.contribution_amount || 0);
    
    const surplus = userTotal - requiredAmountToDate;
    const periodsAhead = surplus > 0 ? Math.floor(surplus / (group?.contribution_amount || 1)) : 0;

    return {
      ...m,
      total: userTotal,
      hasPaidCurrent: paidUserIds.has(m.user_id) || surplus >= 0,
      periodsAhead
    };
  });

  const unpaidMembers = memberTotals.filter(m => !m.hasPaidCurrent);

  // -------------------------------------------------------------------------
  // 4. M-PESA DEPOSIT LOGIC
  // -------------------------------------------------------------------------
  const handleDeposit = async () => {
    const amountToCharge = parseInt(customAmount);
    if (!user || isNaN(amountToCharge) || amountToCharge <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a positive number.", variant: "destructive" });
      return;
    }

    setDepositing(true);
    try {
      const phone = members.find((m) => m.user_id === user.id)?.profile?.phone || '';
      let formattedPhone = phone.replace(/\+/g, '').replace(/\s/g, '');
      if (formattedPhone.startsWith('254')) formattedPhone = '0' + formattedPhone.slice(3);

      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone: formattedPhone,
          amount: amountToCharge,
          userId: user.id,
          purpose: 'chama_savings',
          groupId: groupId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: 'STK Push Sent',
        description: `Processing KES ${amountToCharge.toLocaleString()}. Please check your phone.`,
      });

      setDepositOpen(false);
      if (data?.reference) pollPaymentStatus(data.reference);
    } catch (err: any) {
      toast({ title: 'Payment Failed', description: err.message, variant: 'destructive' });
    } finally {
      setDepositing(false);
    }
  };

  const pollPaymentStatus = (reference: string) => {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const { data } = await supabase.from('stk_transactions').select('status').eq('reference', reference).maybeSingle();
      if (data?.status === 'success') {
        clearInterval(interval);
        toast({ title: 'Success ✅', description: 'Your savings have been updated.' });
        fetchSavings();
        onRefreshGroup();
      } else if (data?.status === 'failed' || attempts > 20) {
        clearInterval(interval);
      }
    }, 3000);
  };

  // -------------------------------------------------------------------------
  // 5. ADMINISTRATIVE SETTINGS
  // -------------------------------------------------------------------------
  const handleSaveSettings = async () => {
    try {
      const { error } = await supabase
        .from('chama_groups')
        .update({
          contribution_frequency: frequency,
          contribution_amount: parseInt(savingsAmount),
        })
        .eq('id', groupId);

      if (error) throw error;
      toast({ title: 'Configuration Updated' });
      setSettingsOpen(false);
      onRefreshGroup();
    } catch (err: any) {
      toast({ title: 'Update Failed', description: err.message, variant: 'destructive' });
    }
  };

  const freqLabel = FREQUENCY_LABELS[group?.contribution_frequency] || 'Flexible';

  // -------------------------------------------------------------------------
  // 6. COMPONENT RENDER
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Group Savings</h2>
          <p className="text-muted-foreground text-sm">Manage contributions and track member standing.</p>
        </div>
        <div className="flex items-center gap-2">
          {isChairperson && (
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 size={16} className="mr-2" /> Settings
            </Button>
          )}
          <Button onClick={() => setDepositOpen(true)} className="shadow-lg shadow-primary/20">
            <Plus size={16} className="mr-2" /> Make a Deposit
          </Button>
        </div>
      </div>

      {/* STATS OVERVIEW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Wallet size={40} />
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Fund</p>
          <p className="text-2xl font-black text-emerald-400">KES {totalSavings.toLocaleString()}</p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Standing</p>
          <div className="flex items-center gap-2">
            <p className="text-2xl font-black text-destructive">{unpaidMembers.length}</p>
            <span className="text-[10px] text-muted-foreground">Unpaid this period</span>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Frequency</p>
          <p className="text-lg font-bold">{freqLabel}</p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Req. Amount</p>
          <p className="text-lg font-bold">KES {group?.contribution_amount?.toLocaleString()}</p>
        </Card>
      </div>

      {/* MEMBER LIST */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-sm font-bold flex items-center gap-2">
            Member Contribution Ledger
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger><Info size={14} className="text-muted-foreground" /></TooltipTrigger>
                <TooltipContent><p className="text-xs">Based on total group history since start date.</p></TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
        </div>

        <Card className="divide-y divide-border overflow-hidden">
          {memberTotals.map((m) => (
            <div key={m.user_id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center font-bold text-xs border">
                  {m.profile?.full_name?.substring(0, 2).toUpperCase() || "M"}
                </div>
                <div>
                  <p className="text-sm font-bold leading-none mb-1">{m.profile?.full_name || 'Member'}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-muted-foreground">Total: KES {m.total.toLocaleString()}</p>
                    {m.periodsAhead > 0 && (
                      <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        <Clock size={10} />
                        <span>{m.periodsAhead} {freqLabel.split(' ')[0]}s ahead</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {m.hasPaidCurrent ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    <CheckCircle2 size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Current</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-destructive bg-destructive/10 px-2.5 py-1 rounded-full border border-destructive/20">
                    <AlertTriangle size={12} />
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Arrears</span>
                  </div>
                )}
                <ChevronRight size={14} className="text-muted-foreground opacity-20" />
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* DEPOSIT DIALOG */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deposit to Chama Fund</DialogTitle>
            <DialogDescription>
              Enter the amount you wish to contribute. Any extra amount will automatically count toward your future periods.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="custom-amount">Contribution Amount (KES)</Label>
              <Input
                id="custom-amount"
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="text-xl font-bold h-12"
              />
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Info size={10} /> Min required for this period: KES {group?.contribution_amount?.toLocaleString()}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleDeposit} disabled={depositing} className="w-full h-11">
              {depositing ? "Awaiting M-Pesa..." : `Confirm Payment: KES ${Number(customAmount).toLocaleString()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SETTINGS DIALOG */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Group Contribution Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Contribution Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Requirement Per Period (KES)</Label>
              <Input 
                type="number" 
                value={savingsAmount} 
                onChange={(e) => setSavingsAmount(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveSettings}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
