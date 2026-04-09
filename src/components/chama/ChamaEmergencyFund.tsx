import { useState, useEffect } from 'react';
import { Shield, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ChamaEmergencyFundProps {
  groupId: string;
  members: Array<{
    user_id: string;
    role: string;
    profile?: { full_name: string; phone: string };
  }>;
}

export function ChamaEmergencyFund({ groupId, members }: ChamaEmergencyFundProps) {
  const { user } = useAuth();
  const [fund, setFund] = useState<{ balance: number } | null>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    const fetchData = async () => {
      const [fundRes, contribRes] = await Promise.all([
        supabase.from('chama_emergency_fund').select('balance').eq('group_id', groupId).maybeSingle(),
        supabase.from('chama_emergency_contributions').select('*').eq('group_id', groupId).eq('month', currentMonth),
      ]);
      if (fundRes.data) setFund(fundRes.data);
      if (contribRes.data) setContributions(contribRes.data);
      setLoading(false);
    };
    fetchData();
  }, [groupId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  const paidUserIds = new Set(contributions.filter(c => c.status === 'paid').map(c => c.user_id));
  const pendingUserIds = new Set(contributions.filter(c => c.status === 'pending').map(c => c.user_id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Emergency Fund</h2>
        <p className="text-muted-foreground text-sm">Monthly contributions auto-deducted from savings deposits.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Shield size={40} />
          </div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Fund Balance</p>
          <p className="text-2xl font-black text-emerald-400">KES {(fund?.balance || 0).toLocaleString()}</p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">This Month</p>
          <p className="text-2xl font-black">{paidUserIds.size}<span className="text-sm font-normal text-muted-foreground">/{members.length} paid</span></p>
        </Card>
      </div>

      <Card className="divide-y divide-border overflow-hidden">
        <div className="p-3 bg-muted/30">
          <h3 className="text-sm font-bold">Member Status — {currentMonth}</h3>
        </div>
        {members.map((m) => {
          const isPaid = paidUserIds.has(m.user_id);
          const isPending = pendingUserIds.has(m.user_id);
          const isMe = m.user_id === user?.id;

          return (
            <div key={m.user_id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center font-bold text-xs border">
                  {m.profile?.full_name?.substring(0, 2).toUpperCase() || 'M'}
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {m.profile?.full_name || 'Member'}
                    {isMe && <span className="text-xs text-muted-foreground ml-1">(You)</span>}
                  </p>
                </div>
              </div>
              {isPaid ? (
                <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  <CheckCircle2 size={12} />
                  <span className="text-[10px] font-bold uppercase">Paid</span>
                </div>
              ) : isPending ? (
                <div className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                  <AlertTriangle size={12} />
                  <span className="text-[10px] font-bold uppercase">Pending</span>
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground">Not charged</span>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
