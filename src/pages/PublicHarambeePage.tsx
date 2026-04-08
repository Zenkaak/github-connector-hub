import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { HandCoins, Send, CheckCircle2, XCircle, Loader2, Users, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const referenceRef = useRef<string>('');

  useEffect(() => {
    fetchHarambee();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderNumber]);

  const fetchHarambee = async () => {
    if (!orderNumber) return;

    const { data, error } = await supabase
      .from('chama_harambees')
      .select('*')
      .eq('order_number', orderNumber)
      .single();

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
      .single();

    if (group) setGroupName(group.name);

    const { data: contribs } = await supabase
      .from('chama_harambee_contributions')
      .select('*')
      .eq('harambee_id', data.id)
      .order('created_at', { ascending: false });

    if (contribs) setContributions(contribs);

    setLoading(false);
  };

  const handleContribute = async () => {
    if (!phone.trim() || !amount || !harambee?.id) {
      toast({ title: 'Missing required data', variant: 'destructive' });
      return;
    }

    const amt = parseInt(amount);
    if (!amt || amt < 1) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }

    setContributing(true);
    setPaymentStatus('pending');
    setStatusMessage('Sending payment request to your phone...');

    try {
      console.log("HARAmBEE ID BEING SENT:", harambee.id);

      const { data, error } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone: phone.trim(),
          amount: amt,
          userId: 'public-user',
          purpose: 'harambee',
          harambee_id: harambee.id,
          contributorName: name.trim() || undefined,
        },
      });

      if (error) throw error;

      referenceRef.current = data.reference;

      setStatusMessage('Check your phone and enter your M-Pesa PIN.');
      startPolling(data.reference);

    } catch (error: any) {
      setPaymentStatus('failed');
      setStatusMessage(error.message || 'Could not initiate payment');
      setContributing(false);
    }
  };

  const startPolling = (reference: string) => {
    let attempts = 0;
    const maxAttempts = 60;

    pollRef.current = setInterval(async () => {
      attempts++;

      if (attempts >= maxAttempts) {
        clearInterval(pollRef.current!);
        setPaymentStatus('failed');
        setStatusMessage('Payment verification timed out.');
        setContributing(false);
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('check-stk-status', {
          body: { reference },
        });

        if (error) throw error;

        if (data.status === 'success') {
          clearInterval(pollRef.current!);
          setPaymentStatus('success');
          setStatusMessage('Payment successful 🎉');
          setContributing(false);
          fetchHarambee();
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current!);
          setPaymentStatus('failed');
          setStatusMessage(data.message || 'Payment failed');
          setContributing(false);
        }
      } catch {
        // ignore transient errors
      }
    }, 3000);
  };

  const progress = harambee?.target_amount > 0
    ? Math.min(100, ((harambee?.raised_amount || 0) / harambee.target_amount) * 100)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6 text-center">Harambee not found</Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-lg mx-auto p-4 space-y-5">

      <Card className="p-5 space-y-3">
        <h2 className="text-xl font-bold">
          Harambee for {harambee.beneficiary_name}
        </h2>

        <div className="flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Hash size={12} />
            {harambee.order_number}
          </div>

          {groupName && (
            <div className="flex items-center gap-1">
              <Users size={12} />
              {groupName}
            </div>
          )}
        </div>

        <Progress value={progress} />
        <p className="text-sm">
          KES {(harambee.raised_amount || 0).toLocaleString()} / {harambee.target_amount?.toLocaleString()}
        </p>
      </Card>

      {harambee.status === 'active' && paymentStatus !== 'success' && (
        <Card className="p-5 space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <Send size={16} /> Contribute
          </h3>

          <div>
            <Label>Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>

          <div>
            <Label>Amount</Label>
            <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>

          <Button onClick={handleContribute} disabled={contributing}>
            {contributing ? <Loader2 className="animate-spin" /> : 'Contribute'}
          </Button>
        </Card>
      )}

      {paymentStatus !== 'idle' && (
        <Card className="p-5 text-center space-y-3">
          {paymentStatus === 'pending' && <Loader2 className="animate-spin mx-auto" />}
          {paymentStatus === 'success' && <CheckCircle2 className="mx-auto text-green-500" />}
          {paymentStatus === 'failed' && <XCircle className="mx-auto text-red-500" />}
          <p>{statusMessage}</p>
        </Card>
      )}

    </div>
  );
                 }
