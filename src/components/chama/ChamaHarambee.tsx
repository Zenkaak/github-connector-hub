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

  useEffect(() => { fetchHarambees(); }, [groupId]);

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
    if (!user || !selectedHarambee) return;
    const amount = Number(contributeAmount);
    if (!amount || amount <= 0) return toast({ title: "Invalid amount", variant: "destructive" });
    if (amount > 150000) return toast({ title: "M-Pesa Limit", description: "Max allowed is 150,000", variant: "destructive" });
    const phone = contributePhone.trim();
    if (!/^07\d{8}$/.test(phone)) return toast({ title: "Invalid phone", variant: "destructive" });

    setContributing(true);
    try {
      const { data, error } = await supabase.functions.invoke("initiate-stk-push", {
        body: { phone, amount, userId: user.id, purpose: "harambee", groupId: selectedHarambee.id, orderNumber: selectedHarambee.order_number },
      });
      if (error) throw error;
      toast({ title: "STK Push Sent", description: "Check your phone" });
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
      {/* Create Button for leaders */}
      {isLeader && (
        <Button onClick={() => setCreateOpen(true)} className="w-full gap-2">
          <Plus size={16} /> Create Harambee
        </Button>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Loading harambees...</div>
      ) : harambees.length === 0 ? (
        <div className="text-center py-12">
          <HandCoins size={32} className="mx-auto mb-3 text-muted-foreground" />
          <p className="font-semibold text-sm mb-1">No Harambees Yet</p>
          <p className="text-xs text-muted-foreground">
            {isLeader ? 'Create a harambee to start fundraising for a cause.' : 'No harambees have been created yet.'}
          </p>
        </div>
      ) : (
        harambees.map(h => {
          const progress = getProgress(h.raised_amount, h.target_amount);
          return (
            <Card key={h.id} className="p-4">
              <div className="flex justify-between">
                <div>
                  <h4 className="font-semibold text-sm">{h.beneficiary_name || h.title}</h4>
                  <p className="text-xs text-muted-foreground">{h.description}</p>
                  <p className="text-xs font-mono">{h.order_number}</p>
                </div>
                <span className={cn("text-xs px-2 py-1 rounded-full h-fit", h.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                  {h.status}
                </span>
              </div>
              <div className="mt-2">
                <div className="flex justify-between text-xs">
                  <span>{formatKES(h.raised_amount)}</span>
                  <span>{formatKES(h.target_amount)}</span>
                </div>
                <Progress value={progress} className="h-2 mt-1" />
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => handleCopyLink(h)}>
                  {copiedId === h.id ? <Check size={14} /> : <Copy size={14} />}
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleShare(h)}>
                  <Share2 size={14} />
                </Button>
                <Button size="sm" onClick={() => { setSelectedHarambee(h); setDetailOpen(true); fetchContributions(h.id); }}>
                  <Eye size={14} className="mr-1" /> View
                </Button>
                {h.status === 'active' && (
                  <Button size="sm" variant="gold" onClick={() => { setSelectedHarambee(h); setContributeOpen(true); }}>
                    Contribute
                  </Button>
                )}
              </div>
            </Card>
          );
        })
      )}

      {/* Create Harambee Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><HandCoins size={18} /> Create Harambee</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Beneficiary Name *</Label>
              <Input value={beneficiary} onChange={e => setBeneficiary(e.target.value)} placeholder="Who is this for?" className="mt-1" />
            </div>
            <div>
              <Label>Reason / Description *</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Describe the purpose..." className="mt-1" />
            </div>
            <div>
              <Label>Target Amount (KES) *</Label>
              <Input type="number" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} placeholder="e.g. 50000" className="mt-1" />
            </div>
            <div>
              <Label>Deadline (Optional)</Label>
              <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              <Label>Make public (visible outside group)</Label>
            </div>
            <div>
              <Label>Images (max 3)</Label>
              <div className="flex gap-2 mt-1">
                {imagePreviews.map((p, i) => (
                  <div key={i} className="relative w-16 h-16">
                    <img src={p} alt="" className="w-full h-full rounded-lg object-cover" />
                    <button onClick={() => removeImage(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                      <X size={10} />
                    </button>
                  </div>
                ))}
                {imageFiles.length < 3 && (
                  <>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center hover:border-primary transition-colors">
                      <ImagePlus size={20} className="text-muted-foreground" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating || !beneficiary.trim() || !reason.trim() || !targetAmount} className="w-full">
              {creating ? <><Loader2 size={14} className="animate-spin mr-2" /> Creating...</> : 'Create Harambee'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Harambee Details</DialogTitle></DialogHeader>
          {selectedHarambee && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-lg font-bold">{selectedHarambee.beneficiary_name || selectedHarambee.title}</p>
                <p className="text-xs text-muted-foreground">{selectedHarambee.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Raised</p>
                  <p className="font-bold text-primary">{formatKES(selectedHarambee.raised_amount)}</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/40">
                  <p className="text-xs text-muted-foreground">Target</p>
                  <p className="font-bold">{formatKES(selectedHarambee.target_amount)}</p>
                </div>
              </div>
              <Progress value={getProgress(selectedHarambee.raised_amount, selectedHarambee.target_amount)} className="h-2" />
              <div>
                <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Contributions ({contributions.length})</h4>
                {contributions.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No contributions yet</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {contributions.map(c => (
                      <div key={c.id} className="flex justify-between p-2 rounded-lg bg-muted/30 text-xs">
                        <span>{c.contributor_name || members.find(m => m.user_id === c.user_id)?.profile?.full_name || 'Anonymous'}</span>
                        <span className="font-bold">{formatKES(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contribute Dialog */}
      <Dialog open={contributeOpen} onOpenChange={setContributeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contribute to Harambee</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {selectedHarambee && (
              <div className="p-3 rounded-lg bg-muted/40 text-center">
                <p className="text-xs text-muted-foreground">Contributing to</p>
                <p className="font-semibold">{selectedHarambee.beneficiary_name || selectedHarambee.title}</p>
              </div>
            )}
            <div>
              <Label>Amount (KES)</Label>
              <Input type="number" value={contributeAmount} onChange={e => setContributeAmount(e.target.value)} placeholder="Enter amount" className="mt-1" />
            </div>
            <div>
              <Label>M-Pesa Phone</Label>
              <Input value={contributePhone} onChange={e => setContributePhone(e.target.value)} placeholder="0712345678" className="mt-1" />
            </div>
            <Button onClick={handleContribute} disabled={contributing} className="w-full">
              {contributing ? <><Loader2 size={14} className="animate-spin mr-2" /> Processing...</> : 'Pay via M-Pesa'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
