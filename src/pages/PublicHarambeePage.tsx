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
if (!phone.trim() || !amount || !harambee?.id) return;  
const amt = parseInt(amount);  
if (!amt || amt < 1) {  
toast({ title: 'Invalid amount', variant: 'destructive' });  
return;  
}  
  
setContributing(true);  
setPaymentStatus('pending');  
setStatusMessage('Sending payment request to your phone...');  
  
try {  
const { data, error } = await supabase.functions.invoke('initiate-stk-push', {  
  body: {  
    phone: phone.trim(),  
    amount: amt,  
    userId: 'public-user',  
    purpose: 'harambee',  
    // We pass both variations to ensure the Edge Function catches it regardless of naming convention
    harambee_id: harambee.id,  
    harambeeId: harambee.id, 
    contributorName: name.trim() || 'Anonymous',  
  },  
});  
  
if (error) throw error;  
  
referenceRef.current = data.reference;  
setStatusMessage('Check your phone for the M-Pesa prompt. Enter your PIN to complete.');  
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
setStatusMessage('Payment verification timed out. If you paid, it will be recorded shortly.');  
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
  fetchHarambee();      
} else if (data.status === 'failed') {      
  clearInterval(pollRef.current!);      
  setPaymentStatus('failed');      
  setStatusMessage(data.message || 'Payment failed. Please try again.');      
  setContributing(false);      
}  
  
} catch {  
// Keep polling  
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
}  if (notFound) {  
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
}  return (  
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
</div>  <div className="max-w-lg mx-auto px-4 py-6 space-y-5">      
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
      <Send size={16} className="text-accent" /> Contribute via M-Pesa      
    </h3>      
  
    <div>      
      <Label>Your Name (optional)</Label>      
      <Input      
        value={name}      
        onChange={e => setName(e.target.value)}      
        placeholder="e.g. Jane Wanjiku"      
        maxLength={100}      
        className="mt-1"      
        disabled={contributing}      
      />      
    </div>      
  
    <div>      
      <Label>M-Pesa Phone Number *</Label>      
      <Input      
        value={phone}      
        onChange={e => setPhone(e.target.value)}      
        placeholder="0712345678"      
        maxLength={15}      
        className="mt-1"      
        disabled={contributing}      
      />      
    </div>      
  
    <div>      
      <Label>Amount (KES) *</Label>      
      <Input      
        type="number"      
        value={amount}      
        onChange={e => setAmount(e.target.value)}      
        placeholder="Enter amount"      
        min={1}      
        className="mt-1"      
        disabled={contributing}      
      />      
    </div>      
  
    <Button      
      onClick={handleContribute}      
      disabled={contributing || !phone.trim() || !amount}      
      className="w-full gap-2"      
    >      
      {contributing ? (      
        <><Loader2 size={16} className="animate-spin" /> Processing...</>      
      ) : (      
        <><HandCoins size={16} /> Contribute KES {amount ? parseInt(amount).toLocaleString() : '0'}</>      
      )}      
    </Button>      
  </Card>      
)}      
  
{paymentStatus !== 'idle' && (      
  <Card className={`p-5 text-center space-y-3 ${      
    paymentStatus === 'success' ? 'border-emerald-500/30' :      
    paymentStatus === 'failed' ? 'border-destructive/30' : 'border-accent/30'      
  }`}>      
    {paymentStatus === 'pending' && (      
      <Loader2 size={40} className="mx-auto text-accent animate-spin" />      
    )}      
    {paymentStatus === 'success' && (      
      <CheckCircle2 size={40} className="mx-auto text-emerald-500" />      
    )}      
    {paymentStatus === 'failed' && (      
      <XCircle size={40} className="mx-auto text-destructive" />      
    )}      
    <p className="text-sm text-foreground font-medium">{statusMessage}</p>      
    {paymentStatus === 'failed' && (      
      <Button      
        variant="outline"      
        size="sm"      
        onClick={() => {      
          setPaymentStatus('idle');      
          setStatusMessage('');      
        }}      
      >      
        Try Again      
      </Button>      
    )}      
  </Card>      
)}      
  
{contributions.length > 0 && (      
  <Card className="p-5">      
    <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">      
      Recent Contributions ({contributions.length})      
    </h3>      
    <div className="space-y-2">      
      {contributions.slice(0, 20).map(c => (      
        <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/30">      
          <div>      
            <p className="text-xs font-medium text-foreground">Contributor</p>      
            <p className="text-[10px] text-muted-foreground">      
              {new Date(c.created_at).toLocaleDateString('en-KE', { dateStyle: 'medium' })}      
            </p>      
          </div>      
          <span className="text-sm font-bold text-accent">KES {c.amount?.toLocaleString()}</span>      
        </div>      
      ))}      
    </div>      
  </Card>      
)}      
  
<div className="text-center py-4">      
  <p className="text-[11px] text-muted-foreground">      
    Powered by <a href="/" className="text-accent hover:underline font-medium">DASNET VENTURES</a>      
  </p>      
</div>  
  
  </div>      
</div>  );  
}
 
