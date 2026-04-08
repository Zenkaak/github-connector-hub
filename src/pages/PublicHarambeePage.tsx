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

export default function PublicHarambeePage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const { toast } = useToast();
  const [harambee, setHarambee] = useState<any>(null);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [groupName, setGroupName] = useState('');

  // Contribution form
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
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
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

    // Fetch group name
    const { data: group } = await supabase
      .from('chama_groups')
      .select('name')
      .eq('id', data.group_id)
      .single();
    if (group) setGroupName(group.name);

    // Fetch contributions
    const { data: contribs } = await supabase
      .from('chama_harambee_contributions')
      .select('*')
      .eq('harambee_id', data.id)
      .order('created_at', { ascending: false });
    if (contribs) setContributions(contribs);

    setLoading(false);
  };

  const handleContribute = async () => {
    if (!phone.trim() || !amount || !orderNumber) return;
    
    const amt = parseInt(amount);
    if (!amt || amt < 1) {
      toast({ title: 'Invalid amount', variant: 'destructive' });
      return;
    }

    // Basic Phone Normalization for Safaricom
    let formattedPhone = phone.trim().replace(/\s+/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1);
    } else if (formattedPhone.startsWith('+')) {
      formattedPhone = formattedPhone.substring(1);
    }

    setContributing(true);
    setPaymentStatus('pending');
    setStatusMessage('Sending payment request to your phone...');

    try {
      // ✅ Calling the Edge Function
      const { data, error } = await supabase.functions.invoke('public-harambee-contribute', {
        body: {
          phone: formattedPhone,
          amount: amt,
          orderNumber,
          contributorName: name.trim() || 'Well Wisher',
        },
      });

      if (error) throw error;

      referenceRef.current = data.reference;
      setStatusMessage('Check your phone for the M-Pesa prompt. Enter your PIN to complete.');
      
      // ✅ Start Polling for Status
      startPolling(data.reference);
    } catch (error: any) {
      setPaymentStatus('failed');
      setStatusMessage(error.message || 'Could not initiate payment');
      setContributing(false);
    }
  };

  const startPolling = (reference: string) => {
    let attempts = 0;
    const maxAttempts = 40; // Approx 2 minutes of polling

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(pollRef.current!);
        setPaymentStatus('failed');
        setStatusMessage('Verification timed out. If you paid, it will reflect shortly.');
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
          setStatusMessage('Payment received! Thank you for your contribution. 🎉');
          setContributing(false);
          fetchHarambee(); // Refresh progress and list
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current!);
          setPaymentStatus('failed');
          setStatusMessage(data.message || 'Payment failed or was cancelled.');
          setContributing(false);
        }
      } catch (e) {
        // Silently continue polling on network hiccups
      }
    }, 3000);
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
          <p className="text-sm text-muted-foreground">This link may be invalid or expired.</p>
          <a href="/" className="inline-block mt-4 text-accent text-sm hover:underline">← Return to Home</a>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
            <HandCoins size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-lg leading-none">DASNET VENTURES</h1>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Harambee Portal</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Images Grid */}
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 rounded-2xl overflow-hidden">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt={`Harambee ${i + 1}`}
                className={`w-full object-cover h-32 hover:opacity-90 transition-opacity ${images.length === 1 ? 'col-span-3 h-56' : ''}`}
              />
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="p-6 space-y-4 shadow-sm border-border/50">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase tracking-wider ${harambee.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {harambee.status}
              </span>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-accent/10 text-accent font-black uppercase tracking-wider">
                {harambee.order_number}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 leading-tight">
              {harambee.beneficiary_name}
            </h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {harambee.description}
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center gap-4 text-xs font-bold text-slate-400">
            {groupName && (
              <div className="flex items-center gap-1.5">
                <Users size={14} />
                <span>Organized by {groupName}</span>
              </div>
            )}
          </div>

          {/* Progress Section */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
            <div className="flex justify-between items-end">
              <div className="space-y-0.5">
                <p className="text-[10px] font-black text-slate-400 uppercase">Raised</p>
                <p className="text-xl font-black text-slate-900">KES {(harambee.raised_amount || 0).toLocaleString()}</p>
              </div>
              <div className="text-right space-y-0.5">
                <p className="text-[10px] font-black text-slate-400 uppercase">Goal</p>
                <p className="text-sm font-bold text-slate-500">KES {harambee.target_amount?.toLocaleString()}</p>
              </div>
            </div>
            <Progress value={progress} className="h-2.5 bg-slate-200" />
            <div className="flex justify-between text-[11px] font-black uppercase tracking-tighter">
              <span className="text-accent">{Math.round(progress)}% Completed</span>
              <span className="text-slate-400">{contributions.length} Contributors</span>
            </div>
          </div>
        </Card>

        {/* Payment Form */}
        {harambee.status === 'active' && paymentStatus !== 'success' && (
          <Card className="p-6 space-y-5 shadow-md border-accent/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500 rounded-lg text-white">
                <Phone size={18} />
              </div>
              <h3 className="text-lg font-black text-slate-900 uppercase">Send Support</h3>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-500">Your Name</Label>
                <Input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Timothy Cheruiyot"
                  className="h-11 font-bold"
                  disabled={contributing}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-500">M-Pesa Number *</Label>
                <Input
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="07xxxxxxxx"
                  className="h-11 font-bold"
                  disabled={contributing}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-500">Amount (KES) *</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="1000"
                  className="h-12 text-lg font-black"
                  disabled={contributing}
                />
              </div>

              <Button
                onClick={handleContribute}
                disabled={contributing || !phone.trim() || !amount}
                className="w-full h-14 text-lg font-black shadow-lg bg-slate-900 hover:bg-slate-800 transition-all active:scale-95"
              >
                {contributing ? (
                  <><Loader2 size={20} className="animate-spin mr-2" /> PROCESSING...</>
                ) : (
                  <>CONTRIBUTE NOW</>
                )}
              </Button>
            </div>
          </Card>
        )}

        {/* Status Overlay */}
        {paymentStatus !== 'idle' && (
          <Card className={`p-6 text-center space-y-4 animate-in fade-in zoom-in duration-300 ${
            paymentStatus === 'success' ? 'bg-emerald-50 border-emerald-200' :
            paymentStatus === 'failed' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
          }`}>
            {paymentStatus === 'pending' && <Loader2 size={48} className="mx-auto text-blue-600 animate-spin" />}
            {paymentStatus === 'success' && <CheckCircle2 size={48} className="mx-auto text-emerald-600" />}
            {paymentStatus === 'failed' && <XCircle size={48} className="mx-auto text-red-600" />}
            
            <div className="space-y-1">
              <p className="font-black text-slate-900 uppercase">{paymentStatus}</p>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">{statusMessage}</p>
            </div>

            {paymentStatus === 'failed' && (
              <Button variant="outline" size="sm" onClick={() => { setPaymentStatus('idle'); setStatusMessage(''); }} className="font-bold">
                Try Again
              </Button>
            )}
          </Card>
        )}

        {/* Recent Contributions List */}
        {contributions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest px-1">Recent Support</h3>
            <div className="space-y-2">
              {contributions.slice(0, 10).map(c => (
                <div key={c.id} className="flex items-center justify-between p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                      <Users size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">{c.contributor_name || 'Anonymous'}</p>
                      <p className="text-[10px] font-bold text-slate-400">
                        {new Date(c.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-black text-emerald-600">KES {c.amount?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-8 text-center border-t border-slate-100">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
            Powered by DASNET VENTURES
          </p>
        </div>
      </div>
    </div>
  );
}
 
