import { useState, useEffect, useRef } from 'react';
import { HandCoins, Plus, Send, Hash, Globe, Eye, Share2, ImagePlus, X, Loader2, Copy, Check, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  groupId: string;
  group: any;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string; phone: string } }>;
  myRole: string;
}

const safeNumber = (val: any) => Number(val || 0);
const formatKES = (val: any) => `KES ${safeNumber(val).toLocaleString("en-KE")}`;
const getProgress = (collected: any, target: any) => {
  const c = safeNumber(collected);
  const t = safeNumber(target);
  if (t <= 0) return 0;
  return Math.min(100, (c / t) * 100);
};

export function ChamaHarambee({ groupId, group, members, myRole }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [harambees, setHarambees] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedHarambee, setSelectedHarambee] = useState<any>(null);

  const [contributeOpen, setContributeOpen] = useState(false);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributePhone, setContributePhone] = useState('');

  const [creating, setCreating] = useState(false);
  const [contributing, setContributing] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [beneficiary, setBeneficiary] = useState('');
  const [reason, setReason] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [deadline, setDeadline] = useState('');

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);

  const getPublicLink = (orderNumber: string) => `${window.location.origin}/harambee/${orderNumber}`;

  const fetchHarambees = async () => {
    const { data } = await supabase
      .from('chama_harambees')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (data) setHarambees(data);
    setLoading(false);
  };

  const fetchContributions = async (harambeeId: string) => {
    const { data } = await supabase
      .from('chama_harambee_contributions')
      .select('*')
      .eq('harambee_id', harambeeId)
      .order('created_at', { ascending: false });
    if (data) setContributions(data);
  };

  useEffect(() => {
    fetchHarambees();

    const channel = supabase
      .channel(`harambee_realtime_${groupId}`)
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'chama_harambees',
          filter: `group_id=eq.${groupId}` 
        }, 
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setHarambees(current => 
              current.map(h => h.id === payload.new.id ? payload.new : h)
            );
            if (selectedHarambee?.id === payload.new.id) {
              setSelectedHarambee(payload.new);
            }
          } else {
            fetchHarambees();
          }
        }
      )
      .on(
        'postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'chama_harambee_contributions' 
        }, 
        (payload) => {
          if (selectedHarambee && payload.new.harambee_id === selectedHarambee.id) {
            fetchContributions(selectedHarambee.id);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, selectedHarambee?.id]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = 3 - imageFiles.length;
    const selected = files.slice(0, remaining);
    selected.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => { setImagePreviews(prev => [...prev, ev.target?.result as string]); };
      reader.readAsDataURL(file);
    });
    setImageFiles(prev => [...prev, ...selected]);
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (imageFiles.length === 0) return [];
    const urls: string[] = [];
    for (const file of imageFiles) {
      const ext = file.name.split('.').pop();
      const path = `${groupId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('harambee-images').upload(path, file);
      if (!error) {
        const { data } = supabase.storage.from('harambee-images').getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    return urls;
  };

  const handleCopyLink = async (h: any) => {
    const link = getPublicLink(h.order_number);
    await navigator.clipboard.writeText(link);
    setCopiedId(h.id);
    toast({ title: "Link Copied", description: link });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShare = async (h: any) => {
    const link = getPublicLink(h.order_number);
    const text = `🤝 Harambee for ${h.beneficiary_name}\n\n${h.description || ''}\n\n💰 Target: ${formatKES(h.target_amount)}\n📊 Collected: ${formatKES(h.raised_amount)}\n\n🔖 Order: ${h.order_number}\n\nContribute 👇\n${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Harambee: ${h.beneficiary_name}`, text, url: link }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Details copied to clipboard" });
    }
  };

  const handleCreate = async () => {
    if (!user) return;
    if (!beneficiary.trim() || !reason.trim()) return;
    const target = Number(targetAmount);
    if (target < 100) return toast({ title: "Invalid Target", description: "Minimum target is KES 100", variant: "destructive" });

    setCreating(true);
    try {
      const orderNumber = `HRB-${Date.now().toString(36).toUpperCase()}`;
      const images = await uploadImages();

      const { error } = await supabase.from('chama_harambees').insert({
        group_id: groupId,
        created_by: user.id,
        title: beneficiary.trim(),
        beneficiary_name: beneficiary.trim(),
        description: reason.trim(),
        target_amount: target,
        order_number: orderNumber,
        is_public: isPublic,
        image_urls: images,
        deadline: deadline || null,
      });

      if (error) throw error;

      await supabase.from('notifications').insert(
        members.filter(m => m.user_id !== user.id).map(m => ({
          user_id: m.user_id,
          title: `🤝 Harambee: ${beneficiary}`,
          message: `A harambee has been created. Target: ${formatKES(target)}`,
        }))
      );

      toast({ title: "Harambee Created", description: `Order #${orderNumber}` });
      setCreateOpen(false);
      setBeneficiary(''); setReason(''); setTargetAmount(''); setDeadline('');
      setImageFiles([]); setImagePreviews([]);
      fetchHarambees();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleContribute = async () => {
    if (!user) return;
    
    // Safety check: Explicitly pull the latest selectedHarambee ID
    const currentHarambeeId = selectedHarambee?.id;
    const currentOrderNumber = selectedHarambee?.order_number;

    if (!currentHarambeeId) {
      return toast({ 
        title: "Selection Required", 
        description: "Please select a specific Harambee cause to contribute.", 
        variant: "destructive" 
      });
    }

    const amount = Number(contributeAmount);
    if (!amount || amount <= 0) return toast({ title: "Invalid amount", description: "Please enter a valid amount", variant: "destructive" });
    
    const phone = contributePhone.trim();
    if (!/^07\d{8}$|^254\d{9}$/.test(phone)) return toast({ title: "Invalid phone", description: "Please use a valid Safaricom number", variant: "destructive" });

    setContributing(true);
    try {
      // FIX: Passing harambee_id and other context to the STK Edge Function
      const { data, error } = await supabase.functions.invoke("initiate-stk-push", {
        body: { 
          phone, 
          amount, 
          userId: user.id, 
          purpose: "harambee", 
          groupId: groupId, 
          harambee_id: currentHarambeeId, // Ensure this is not null
          orderNumber: currentOrderNumber 
        },
      });
      
      if (error) throw error;
      
      toast({ title: "STK Push Sent", description: "Please check your phone for the M-Pesa PIN prompt" });
      setContributeOpen(false);
      setContributeAmount('');
    } catch (error: any) {
      toast({ title: "Payment Error", description: error.message, variant: "destructive" });
    } finally {
      setContributing(false);
    }
  };

  return (
    <div className="space-y-4">
      {isLeader && (
        <Button onClick={() => setCreateOpen(true)} className="w-full gap-2 font-bold shadow-md">
          <Plus size={18} /> Create Harambee
        </Button>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading harambees...</div>
      ) : harambees.length === 0 ? (
        <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border/40">
          <HandCoins size={40} className="mx-auto mb-3 text-muted-foreground/30" />
          <p className="font-bold text-muted-foreground text-sm">No Harambees Yet</p>
          <p className="text-xs text-muted-foreground/60">Causes requiring fundraising will appear here.</p>
        </div>
      ) : (
        harambees.map(h => {
          const progress = getProgress(h.raised_amount, h.target_amount);
          return (
            <Card key={h.id} className="p-4 border-border/40 overflow-hidden">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="font-black text-foreground text-sm uppercase tracking-tight">{h.beneficiary_name || h.title}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{h.description}</p>
                  <p className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded w-fit">{h.order_number}</p>
                </div>
                <span className={cn("text-[10px] font-black uppercase px-2 py-1 rounded-full", h.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground")}>
                  {h.status}
                </span>
              </div>

              <div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border/30">
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="font-black text-foreground">Raised: {formatKES(h.raised_amount)}</span>
                  <span className="text-muted-foreground font-bold">Goal: {formatKES(h.target_amount)}</span>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-right text-[10px] mt-1 font-bold text-primary">{Math.round(progress)}% Complete</p>
              </div>

              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="outline" className="flex-1 font-bold h-9" onClick={() => handleCopyLink(h)}>
                  {copiedId === h.id ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 font-bold h-9" onClick={() => handleShare(h)}>
                  <Share2 size={14} />
                </Button>
                <Button size="sm" variant="secondary" className="flex-1 font-bold h-9" onClick={() => { setSelectedHarambee(h); setDetailOpen(true); fetchContributions(h.id); }}>
                  <Eye size={14} className="mr-1" /> View
                </Button>
                {h.status === 'active' && (
                  <Button size="sm" className="flex-[1.5] font-black h-9" onClick={() => { setSelectedHarambee(h); setContributeOpen(true); }}>
                    Contribute
                  </Button>
                )}
              </div>
            </Card>
          );
        })
      )}

      {/* Create Harambee Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-xl font-black"><HandCoins /> NEW HARAMBEE</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Beneficiary Name</Label>
              <Input value={beneficiary} onChange={e => setBeneficiary(e.target.value)} placeholder="e.g. John Doe Hospital Fund" className="mt-1 h-11 font-bold" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Reason / Description</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Provide context for contributors..." className="mt-1 font-medium" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Target Amount (KES)</Label>
              <Input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="0.00" className="mt-1 h-11 font-black text-lg" />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold">Public Harambee</Label>
                <p className="text-[10px] text-muted-foreground">Allow non-members to contribute via link</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full h-12 text-md font-black shadow-lg">
              {creating ? <Loader2 className="animate-spin" /> : 'LAUNCH HARAMBEE'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Contribution Detail Modal */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-black uppercase tracking-tight">Harambee Status</DialogTitle></DialogHeader>
          {selectedHarambee && (
            <div className="space-y-5">
              <div className="bg-[hsl(var(--navy-800))] p-4 rounded-xl">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Beneficiary</p>
                <p className="text-lg font-black text-foreground">{selectedHarambee.beneficiary_name}</p>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Raised</p>
                    <p className="text-xl font-black text-emerald-400">{formatKES(selectedHarambee.raised_amount)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase">Goal</p>
                    <p className="text-xl font-black text-foreground">{formatKES(selectedHarambee.target_amount)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase text-muted-foreground flex justify-between">
                  <span>Recent Contributors</span>
                  <span>{contributions.length} People</span>
                </h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {contributions.length === 0 ? (
                    <p className="text-xs text-center py-6 text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border/40 italic">No contributions yet. Be the first!</p>
                  ) : (
                    contributions.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-3 rounded-xl bg-muted/30 border border-border/30">
                        <span className="text-xs font-bold text-foreground">{c.contributor_name || 'Anonymous'}</span>
                        <span className="text-xs font-black text-primary">{formatKES(c.amount)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contribute Payment Modal */}
      <Dialog open={contributeOpen} onOpenChange={setContributeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="text-xl font-black uppercase">CONTRIBUTE</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center gap-3">
              <div className="bg-primary p-2 rounded-lg text-primary-foreground"><HandCoins size={20}/></div>
              <div>
                <p className="text-[10px] font-black text-primary uppercase">Supporting</p>
                <p className="text-sm font-bold text-foreground">{selectedHarambee?.beneficiary_name}</p>
              </div>
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">Amount (KES)</Label>
              <Input type="number" value={contributeAmount} onChange={e => setContributeAmount(e.target.value)} placeholder="Enter amount" className="mt-1 h-12 text-xl font-black" />
            </div>
            <div>
              <Label className="text-[10px] font-black uppercase text-muted-foreground">M-Pesa Number</Label>
              <Input value={contributePhone} onChange={e => setContributePhone(e.target.value)} placeholder="07xxxxxxxx" className="mt-1 h-12 font-bold" />
            </div>
            <Button onClick={handleContribute} disabled={contributing} className="w-full h-14 text-lg font-black shadow-xl bg-emerald-600 hover:bg-emerald-700">
              {contributing ? <Loader2 className="animate-spin mr-2" /> : 'SEND CONTRIBUTION'}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground font-medium italic">An M-Pesa prompt will be sent to your phone</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
