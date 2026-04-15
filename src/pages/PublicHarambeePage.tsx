import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { HandCoins, Phone, Send, CheckCircle2, XCircle, Loader2, Users, Target, Hash, Heart, Sparkles, TrendingUp, Trophy, Medal, Award, User, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
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
  const [groupImage, setGroupImage] = useState<string | null>(null);

  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [name, setName] = useState('');
  const [contributing, setContributing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<string>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const [showAllContributors, setShowAllContributors] = useState(false);
  const [showAllRecent, setShowAllRecent] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const referenceRef = useRef<string>('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchHarambee();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [orderNumber]);

  const fetchHarambee = async () => {
    if (!orderNumber) return;
    const { data, error } = await supabase
      .from('chama_harambees')
      .select('*')
      .eq('order_number', orderNumber)
      .maybeSingle();

    if (error || !data) { setNotFound(true); setLoading(false); return; }
    setHarambee(data);

    const { data: group } = await supabase
      .from('chama_groups')
      .select('name, profile_image_url')
      .eq('id', data.group_id)
      .maybeSingle();
    if (group) {
      setGroupName(group.name);
      setGroupImage(group.profile_image_url);
    }

    const { data: contribs } = await supabase
      .from('chama_harambee_contributions')
      .select('*')
      .eq('harambee_id', data.id)
      .order('created_at', { ascending: false });
    if (contribs) setContributions(contribs);
    setLoading(false);
  };

  const leaderboard = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    contributions.forEach((c) => {
      const n = c.contributor_name || 'Anonymous';
      const existing = map.get(n);
      if (existing) {
        existing.total += c.amount;
        existing.count += 1;
      } else {
        map.set(n, { name: n, total: c.amount, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [contributions]);

  const startPolling = (reference: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/check-stk-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
          body: JSON.stringify({ reference }),
        });
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
      } catch (err) { console.error('Polling error:', err); }
    }, 5000);
  };

  const subscribeToTransaction = (reference: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    channelRef.current = supabase
      .channel('stk-status-channel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'stk_transactions', filter: `reference=eq.${reference}` },
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
      ).subscribe();
  };

  const handleContribute = async () => {
    if (!phone.trim() || !amount || !orderNumber) return;
    const amt = parseInt(amount);
    if (!amt || amt < 1) { toast({ title: 'Invalid amount', variant: 'destructive' }); return; }

    setContributing(true);
    setPaymentStatus('pending');
    setStatusMessage('Sending payment request to your phone...');

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/initiate-stk-push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
        body: JSON.stringify({
          phone: phone.trim(), amount: amt, purpose: 'harambee', harambee_id: harambee.id,
          contributor_name: name.trim() || 'Anonymous',
          metadata: { type: 'harambee_contribution', harambee_id: harambee.id, contributor_name: name.trim() || 'Anonymous', order_number: orderNumber }
        }),
      });

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

  const getMedalIcon = (index: number) => {
    if (index === 0) return <Trophy size={14} className="text-[hsl(42,92%,56%)]" />;
    if (index === 1) return <Medal size={14} className="text-[hsl(210,16%,72%)]" />;
    if (index === 2) return <Award size={14} className="text-[hsl(25,70%,50%)]" />;
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[hsl(213,30%,9%)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="animate-spin text-[hsl(42,92%,56%)] mx-auto" size={32} />
          <p className="text-[hsl(213,16%,58%)] text-sm">Loading harambee...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[hsl(213,30%,9%)] flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full bg-[hsl(213,35%,14%)] border-[hsl(213,30%,20%)]">
          <XCircle size={48} className="mx-auto text-[hsl(0,62%,50%)] mb-4" />
          <h1 className="text-xl font-bold text-[hsl(210,40%,96%)] mb-2">Harambee Not Found</h1>
          <p className="text-sm text-[hsl(213,16%,58%)]">This harambee link may be expired or invalid.</p>
          <a href="/" className="inline-block mt-4 text-[hsl(42,92%,56%)] text-sm hover:underline">← Go to DASNET VENTURES</a>
        </Card>
      </div>
    );
  }

  const visibleLeaderboard = showAllContributors ? leaderboard : leaderboard.slice(0, 10);
  const visibleRecent = showAllRecent ? contributions : contributions.slice(0, 10);

  return (
    <div className="min-h-screen bg-[hsl(213,30%,9%)]">
      {/* Ambient glow effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-[hsl(42,92%,56%,0.04)] rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-[hsl(156,72%,42%,0.03)] rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <div className="relative bg-gradient-to-b from-[hsl(213,35%,14%)] to-[hsl(213,30%,9%)] border-b border-[hsl(213,30%,20%,0.5)]">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(42,92%,56%,0.3)] to-transparent" />
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          {groupImage ? (
            <img src={groupImage} alt={groupName} className="w-10 h-10 rounded-xl object-cover border border-[hsl(42,92%,56%,0.2)]" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[hsl(42,92%,56%,0.1)] border border-[hsl(42,92%,56%,0.2)] flex items-center justify-center">
              <HandCoins size={18} className="text-[hsl(42,92%,56%)]" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-[hsl(210,40%,96%)] text-base">{groupName || 'DASNET VENTURES'}</h1>
            <p className="text-[10px] text-[hsl(42,92%,56%)] font-semibold uppercase tracking-[0.15em]">Community Harambee</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5 relative z-10">

        {/* Images */}
        {images.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div className="grid grid-cols-3 gap-2 rounded-2xl overflow-hidden">
              {images.map((img, i) => (
                <img
                  key={i}
                  src={img}
                  alt={`Harambee ${i + 1}`}
                  className={`w-full object-cover rounded-xl ${images.length === 1 ? 'col-span-3 h-48' : 'h-32'}`}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Main Info Card */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
          <Card className="overflow-hidden bg-[hsl(213,35%,14%)] border-[hsl(213,30%,20%,0.6)]">
            {/* Status Banner */}
            <div className={`px-5 py-2.5 flex items-center justify-between ${
              harambee.status === 'active'
                ? 'bg-gradient-to-r from-[hsl(156,72%,42%,0.08)] to-transparent border-b border-[hsl(156,72%,42%,0.15)]'
                : 'bg-gradient-to-r from-[hsl(0,62%,50%,0.08)] to-transparent border-b border-[hsl(0,62%,50%,0.15)]'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${harambee.status === 'active' ? 'bg-[hsl(156,72%,42%)] animate-pulse' : 'bg-[hsl(0,62%,50%)]'}`} />
                <span className={`text-[10px] font-bold uppercase tracking-[0.1em] ${
                  harambee.status === 'active' ? 'text-[hsl(156,72%,42%)]' : 'text-[hsl(0,62%,50%)]'
                }`}>
                  {harambee.status === 'active' ? 'Active Campaign' : 'Campaign Closed'}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Title - beneficiary name bold */}
              <div>
                <h2 className="text-xl font-bold text-[hsl(210,40%,96%)] leading-tight">
                  Harambee for <span className="text-[hsl(42,92%,56%)]">{harambee.beneficiary_name}</span>
                </h2>
                {harambee.description && (
                  <p className="text-sm text-[hsl(213,16%,68%)] mt-3 leading-relaxed whitespace-pre-line">{harambee.description}</p>
                )}
              </div>

              {/* Meta info */}
              <div className="flex items-center gap-4 text-[10px] text-[hsl(213,16%,58%)]">
                <div className="flex items-center gap-1.5 bg-[hsl(213,30%,17%)] px-2.5 py-1 rounded-lg">
                  <Hash size={10} className="text-[hsl(42,92%,56%)]" />
                  <span className="font-mono font-bold text-[hsl(210,40%,96%)]">{harambee.order_number}</span>
                </div>
                {groupName && (
                  <div className="flex items-center gap-1.5 bg-[hsl(213,30%,17%)] px-2.5 py-1 rounded-lg">
                    <Users size={10} className="text-[hsl(42,92%,56%)]" />
                    <span>{groupName}</span>
                  </div>
                )}
              </div>

              {/* Progress Section */}
              <div className="p-4 rounded-xl bg-gradient-to-br from-[hsl(213,30%,11%)] to-[hsl(213,30%,13%)] border border-[hsl(213,30%,20%,0.5)] space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] text-[hsl(213,16%,58%)] uppercase tracking-wider font-semibold mb-0.5">Raised</p>
                    <p className="text-2xl font-bold text-[hsl(42,92%,56%)]">
                      KES {(harambee.raised_amount || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[hsl(213,16%,58%)] uppercase tracking-wider font-semibold mb-0.5">Target</p>
                    <p className="text-lg font-bold text-[hsl(210,40%,96%)]">
                      KES {harambee.target_amount?.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <div className="w-full h-3 bg-[hsl(213,30%,17%)] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                      className="h-full rounded-full bg-gradient-to-r from-[hsl(42,92%,56%)] to-[hsl(42,92%,66%)]"
                    />
                  </div>
                </div>

                <div className="flex justify-between text-[10px]">
                  <span className="font-bold text-[hsl(42,92%,56%)]">{Math.round(progress)}% funded</span>
                  <span className="text-[hsl(213,16%,58%)] flex items-center gap-1">
                    <Users size={10} />
                    {contributions.length} contributor{contributions.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[hsl(213,16%,58%)]">
                Started {new Date(harambee.created_at).toLocaleDateString('en-KE', { dateStyle: 'long' })}
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Contribute Form */}
        {harambee.status === 'active' && paymentStatus !== 'success' && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <Card className="overflow-hidden bg-[hsl(213,35%,14%)] border-[hsl(213,30%,20%,0.6)]">
              <div className="px-5 py-3 bg-gradient-to-r from-[hsl(42,92%,56%,0.06)] to-transparent border-b border-[hsl(42,92%,56%,0.1)]">
                <h3 className="text-sm font-bold text-[hsl(210,40%,96%)] flex items-center gap-2">
                  <Heart size={14} className="text-[hsl(42,92%,56%)]" />
                  Make a Contribution
                </h3>
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-3">
                  <div>
                    <Label className="text-[10px] text-[hsl(213,16%,58%)] uppercase tracking-wider font-semibold">Your Name (optional)</Label>
                    <Input
                      placeholder="e.g. John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={contributing}
                      className="mt-1.5 h-11 rounded-xl bg-[hsl(213,30%,11%)] border-[hsl(213,30%,20%)] text-[hsl(210,40%,96%)] placeholder:text-[hsl(213,16%,40%)]"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-[hsl(213,16%,58%)] uppercase tracking-wider font-semibold">M-Pesa Phone Number</Label>
                    <Input
                      placeholder="e.g. 0712345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={contributing}
                      type="tel"
                      className="mt-1.5 h-11 rounded-xl bg-[hsl(213,30%,11%)] border-[hsl(213,30%,20%)] text-[hsl(210,40%,96%)] placeholder:text-[hsl(213,16%,40%)]"
                    />
                  </div>

                  <div>
                    <Label className="text-[10px] text-[hsl(213,16%,58%)] uppercase tracking-wider font-semibold">Amount (KES)</Label>
                    <Input
                      placeholder="e.g. 500"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={contributing}
                      type="number"
                      min={1}
                      className="mt-1.5 h-11 rounded-xl bg-[hsl(213,30%,11%)] border-[hsl(213,30%,20%)] text-[hsl(210,40%,96%)] text-lg font-semibold placeholder:text-[hsl(213,16%,40%)]"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleContribute}
                  disabled={contributing || !phone.trim() || !amount}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-[hsl(42,92%,56%)] to-[hsl(42,92%,50%)] text-[hsl(213,72%,12%)] font-bold text-sm hover:from-[hsl(42,92%,62%)] hover:to-[hsl(42,92%,56%)] transition-all shadow-[0_4px_20px_hsl(42,92%,56%,0.2)]"
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
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3.5 rounded-xl text-sm flex items-start gap-2 border ${
                      paymentStatus === 'pending' ? 'bg-[hsl(42,92%,56%,0.05)] border-[hsl(42,92%,56%,0.2)] text-[hsl(42,92%,66%)]' :
                      paymentStatus === 'success' ? 'bg-[hsl(156,72%,42%,0.05)] border-[hsl(156,72%,42%,0.2)] text-[hsl(156,72%,52%)]' :
                      'bg-[hsl(0,62%,50%,0.05)] border-[hsl(0,62%,50%,0.2)] text-[hsl(0,62%,60%)]'
                    }`}
                  >
                    {paymentStatus === 'pending' && <Loader2 size={16} className="animate-spin mt-0.5" />}
                    {paymentStatus === 'success' && <CheckCircle2 size={16} className="mt-0.5" />}
                    {paymentStatus === 'failed' && <XCircle size={16} className="mt-0.5" />}
                    <span className="text-xs">{statusMessage}</span>
                  </motion.div>
                )}
              </div>
            </Card>
          </motion.div>
        )}

        {/* Success Card */}
        {paymentStatus === 'success' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
            <Card className="p-8 text-center space-y-3 bg-[hsl(213,35%,14%)] border-[hsl(156,72%,42%,0.2)]">
              <div className="w-16 h-16 rounded-2xl bg-[hsl(156,72%,42%,0.1)] flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} className="text-[hsl(156,72%,42%)]" />
              </div>
              <h3 className="font-bold text-[hsl(210,40%,96%)] text-lg">Thank You! 🎉</h3>
              <p className="text-sm text-[hsl(213,16%,58%)]">Your contribution has been received and recorded.</p>
            </Card>
          </motion.div>
        )}

        {/* Leaderboard - show first 10, then View More */}
        {leaderboard.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.25 }}>
            <Card className="overflow-hidden bg-[hsl(213,35%,14%)] border-[hsl(213,30%,20%,0.6)]">
              <div className="px-5 py-3 border-b border-[hsl(213,30%,20%,0.5)] bg-gradient-to-r from-[hsl(42,92%,56%,0.06)] to-transparent flex items-center justify-between">
                <h3 className="text-sm font-bold text-[hsl(210,40%,96%)] flex items-center gap-2">
                  <Trophy size={13} className="text-[hsl(42,92%,56%)]" />
                  Top Contributors
                </h3>
                <Badge className="bg-[hsl(42,92%,56%,0.1)] text-[hsl(42,92%,56%)] border-[hsl(42,92%,56%,0.2)] text-[9px] font-bold">
                  {leaderboard.length}
                </Badge>
              </div>
              <div className="divide-y divide-[hsl(213,30%,20%,0.3)]">
                {visibleLeaderboard.map((entry, idx) => (
                  <motion.div
                    key={entry.name + idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="px-5 py-3 flex items-center justify-between hover:bg-[hsl(213,30%,17%,0.3)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        idx === 0 ? 'bg-[hsl(42,92%,56%,0.15)] text-[hsl(42,92%,56%)]' :
                        idx === 1 ? 'bg-[hsl(210,16%,72%,0.15)] text-[hsl(210,16%,82%)]' :
                        idx === 2 ? 'bg-[hsl(25,70%,50%,0.15)] text-[hsl(25,70%,60%)]' :
                        'bg-[hsl(213,30%,20%)] text-[hsl(213,16%,58%)]'
                      }`}>
                        {idx < 3 ? getMedalIcon(idx) : idx + 1}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[hsl(210,40%,96%)]">{entry.name}</p>
                        <p className="text-[9px] text-[hsl(213,16%,58%)]">
                          {entry.count} contribution{entry.count !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${idx === 0 ? 'text-[hsl(42,92%,56%)]' : 'text-[hsl(210,40%,96%)]'}`}>
                      KES {entry.total.toLocaleString()}
                    </span>
                  </motion.div>
                ))}
              </div>
              {leaderboard.length > 10 && (
                <div className="px-5 py-3 border-t border-[hsl(213,30%,20%,0.3)]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllContributors(!showAllContributors)}
                    className="w-full text-[hsl(42,92%,56%)] hover:bg-[hsl(42,92%,56%,0.06)] text-xs font-bold"
                  >
                    {showAllContributors ? 'Show Less' : `View All ${leaderboard.length} Contributors`}
                    <ChevronDown size={14} className={`ml-1 transition-transform ${showAllContributors ? 'rotate-180' : ''}`} />
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Recent Contributions - show first 10, then View More */}
        {contributions.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
            <Card className="overflow-hidden bg-[hsl(213,35%,14%)] border-[hsl(213,30%,20%,0.6)]">
              <div className="px-5 py-3 border-b border-[hsl(213,30%,20%,0.5)] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[hsl(210,40%,96%)] flex items-center gap-2">
                  <Sparkles size={13} className="text-[hsl(42,92%,56%)]" />
                  Recent Contributions
                </h3>
                <Badge className="bg-[hsl(42,92%,56%,0.1)] text-[hsl(42,92%,56%)] border-[hsl(42,92%,56%,0.2)] text-[9px] font-bold">
                  {contributions.length}
                </Badge>
              </div>
              <div className="divide-y divide-[hsl(213,30%,20%,0.3)]">
                {visibleRecent.map((c, idx) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    className="px-5 py-3 flex justify-between items-center hover:bg-[hsl(213,30%,17%,0.3)] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[hsl(42,92%,56%,0.1)] flex items-center justify-center text-[10px] font-bold text-[hsl(42,92%,56%)]">
                        {(c.contributor_name || 'M')?.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[hsl(210,40%,96%)]">
                          {c.contributor_name || 'Anonymous'}
                        </p>
                        <p className="text-[9px] text-[hsl(213,16%,58%)]">
                          {new Date(c.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[hsl(42,92%,56%)]">
                      KES {c.amount?.toLocaleString()}
                    </span>
                  </motion.div>
                ))}
              </div>
              {contributions.length > 10 && (
                <div className="px-5 py-3 border-t border-[hsl(213,30%,20%,0.3)]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAllRecent(!showAllRecent)}
                    className="w-full text-[hsl(42,92%,56%)] hover:bg-[hsl(42,92%,56%,0.06)] text-xs font-bold"
                  >
                    {showAllRecent ? 'Show Less' : `View All ${contributions.length} Contributions`}
                    <ChevronDown size={14} className={`ml-1 transition-transform ${showAllRecent ? 'rotate-180' : ''}`} />
                  </Button>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Footer */}
        <div className="text-center py-6 space-y-1">
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[hsl(42,92%,56%,0.1)] flex items-center justify-center">
              <HandCoins size={10} className="text-[hsl(42,92%,56%)]" />
            </div>
            <span className="text-[10px] font-bold text-[hsl(42,92%,56%)] uppercase tracking-[0.15em]">DASNET VENTURES</span>
          </div>
          <p className="text-[9px] text-[hsl(213,16%,40%)]">Secure community fundraising platform</p>
        </div>
      </div>
    </div>
  );
}
