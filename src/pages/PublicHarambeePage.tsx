import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { HandCoins, Phone, Send, CheckCircle2, XCircle, Loader2, Users, Target, Hash, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RealtimeChannel } from '@supabase/supabase-js';

export default function PublicHarambeePage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { toast } = useToast();

  const [harambee, setHarambee] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [groupName, setGroupName] = useState('');

  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [contributing, setContributing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const channelRef = useRef<RealtimeChannel | null>(null);
  const referenceRef = useRef<string>('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchHarambee();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [orderNumber]);

  const fetchHarambee = async () => {
    if (!orderNumber) return;

    const { data, error } = await supabase
      .from('chama_harambees')
      .select('*')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (error || !data) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setHarambee(data);

    const { data: group } = await supabase
      .from('chama_groups')
      .select('name')
      .eq('id', data.group_id)
      .maybeSingle();

    if (group) setGroupName(group.name);

    const { data: contribs } = await supabase
      .from('chama_harambee_contributions')
      .select('*')
      .eq('harambee_id', data.id)
      .order('created_at', { ascending: false });

    if (contribs) setContributions(contribs);

    setLoading(false);
  };

  const startPolling = (reference: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/check-stk-status`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiKey,
            },
            body: JSON.stringify({ reference }),
          }
        );
        const data = await res.json();

        if (data.status === 'success') {
          setPaymentStatus('success');
          setStatusMessage('Payment received! Thank you for your contribution. 🎉');
          setContributing(false);
          fetchHarambee();
          if (pollingRef.current) clearInterval(pollingRef.current);
        } else if (data.status === 'failed') {
          setPaymentStatus('failed');
          setStatusMessage(data.message || 'Payment failed. Please try again.');
          setContributing(false);
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000);
  };

  const subscribeToTransaction = (reference: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel('stk-status-channel')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'stk_transactions',
          filter: `reference=eq.${reference}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (!row) return;

          if (row.status === 'success' || row.status === 'Completed') {
            setPaymentStatus('success');
            setStatusMessage('Payment received! Thank you for your contribution. 🎉');
            setContributing(false);
            fetchHarambee();
            if (pollingRef.current) clearInterval(pollingRef.current);
          }

          if (row.status === 'failed' || row.status === 'Cancelled') {
            setPaymentStatus('failed');
            setStatusMessage(row.result_desc || 'Payment failed. Please try again.');
            setContributing(false);
            if (pollingRef.current) clearInterval(pollingRef.current);
          }
        }
      )
      .subscribe();
  };

  const handleContribute = async () => {
    if (!phone.trim() || !amount || !orderNumber) return;

    const amt = parseInt(amount);
    if (!amt || amt < 1) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }

    setContributing(true);
    setPaymentStatus('pending');
    setStatusMessage('Sending payment request to your phone...');

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/initiate-stk-push`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiKey,
          },
          body: JSON.stringify({
            phone: phone.trim(),
            amount: amt,
            purpose: 'harambee',
            harambee_id: harambee.id,
            metadata: {
              type: 'harambee_contribution',
              harambee_id: harambee.id,
              contributor_name: name.trim() || 'Anonymous',
              order_number: orderNumber
            }
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to initiate payment');
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      referenceRef.current = data.reference;

      setStatusMessage('Check your phone for the M-Pesa prompt. Enter your PIN to complete.');
      subscribeToTransaction(data.reference);
      startPolling(data.reference);

    } catch (error: any) {
      setPaymentStatus('failed');
      setStatusMessage(error.message);
      setContributing(false);
    }
  };

  const progress = harambee?.target_amount > 0
    ? Math.min(100, ((harambee?.raised_amount || 0) / harambee.target_amount) * 100)
    : 0;

  const images: string[] = (harambee as any)?.image_urls || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <XCircle size={48} className="mx-auto text-destructive mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Harambee Not Found</h1>
          <p className="text-sm text-muted-foreground">This harambee link may be expired or invalid.</p>
          <a href="/" className="inline-block mt-4 text-accent text-sm hover:underline">← Go to DASNET VENTURES</a>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <HandCoins size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-lg">DASNET VENTURES Harambee</h1>
            <p className="text-xs text-muted-foreground">Community Fundraising</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 rounded-xl overflow-hidden">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Harambee ${i + 1}`}
                className={`w-full object-cover rounded-lg ${images.length === 1 ? 'col-span-3 h-48' : 'h-32'}`}
              />
            ))}
          </div>
        )}

        <Card className="p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${harambee.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                {harambee.status === 'active' ? '🟢 Active' : '🔴 Closed'}
              </span>
              {harambee.is_cross_chama && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium">
                  Cross-Chama
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground mt-2">
              Harambee for {harambee.beneficiary_name}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{harambee.description}</p>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Hash size={12} />
              <span className="font-mono font-bold">{harambee.order_number}</span>
            </div>
            {groupName && (
              <div className="flex items-center gap-1.5">
                <Users size={12} />
                <span>{groupName}</span>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-muted/40 border border-border/40 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Collected</span>
              <span className="font-bold text-foreground">
                KES {(harambee.raised_amount || 0).toLocaleString()} / {harambee.target_amount?.toLocaleString()}
              </span>
            </div>
            <Progress value={progress} className="h-3" />
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>{Math.round(progress)}% reached</span>
              <span>{contributions.length} contribution{contributions.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Started {new Date(harambee.created_at).toLocaleDateString('en-KE', { dateStyle: 'long' })}
          </p>
        </Card>

        {harambee.status === 'active' && paymentStatus !== 'success' && (
          <Card className="p-5 space-y-4">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <Send size={16} className="text-accent" /> Contribute
            </h3>

            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Your Name (optional)</Label>
                <Input
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={contributing}
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">M-Pesa Phone Number</Label>
                <Input
                  placeholder="e.g. 0712345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={contributing}
                  type="tel"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">Amount (KES)</Label>
                <Input
                  placeholder="e.g. 500"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  disabled={contributing}
                  type="number"
                  min={1}
                />
              </div>
            </div>

            <Button
              onClick={handleContribute}
              disabled={contributing || !phone.trim() || !amount}
              className="w-full"
            >
              {contributing ? (
                <span className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" /> Processing...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Phone size={16} /> Contribute via M-Pesa
                </span>
              )}
            </Button>

            {paymentStatus !== 'idle' && (
              <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
                paymentStatus === 'pending' ? 'bg-yellow-500/10 text-yellow-600' :
                paymentStatus === 'success' ? 'bg-emerald-500/10 text-emerald-600' :
                'bg-destructive/10 text-destructive'
              }`}>
                {paymentStatus === 'pending' && <Loader2 size={16} className="animate-spin mt-0.5" />}
                {paymentStatus === 'success' && <CheckCircle2 size={16} className="mt-0.5" />}
                {paymentStatus === 'failed' && <XCircle size={16} className="mt-0.5" />}
                <span>{statusMessage}</span>
              </div>
            )}
          </Card>
        )}

        {paymentStatus === 'success' && (
          <Card className="p-6 text-center space-y-2">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
            <h3 className="font-bold text-foreground">Thank You!</h3>
            <p className="text-sm text-muted-foreground">Your contribution has been received.</p>
          </Card>
        )}

        {contributions.length > 0 && (
          <Card className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users size={14} /> Recent Contributions ({contributions.length})
            </h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {contributions.map((c) => (
                <div key={c.id} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {c.contributor_name || 'Member'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-accent">
                    KES {c.amount?.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        <p className="text-center text-[10px] text-muted-foreground py-4">
          Powered by DASNET VENTURES
        </p>
      </div>
    </div>
  );
}
 
