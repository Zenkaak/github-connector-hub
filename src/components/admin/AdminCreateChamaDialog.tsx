import { useEffect, useState } from 'react';
import { Loader2, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}

export function AdminCreateChamaDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contribution, setContribution] = useState('');
  const [frequency, setFrequency] = useState('monthly');
  const [maxMembers, setMaxMembers] = useState('20');
  const [isPublic, setIsPublic] = useState('true');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [admin, setAdmin] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!search || search.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles').select('user_id, full_name, phone, email')
        .or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
        .limit(8);
      setResults(data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const submit = async () => {
    if (!name.trim() || !contribution || !admin?.user_id) {
      toast.error('Name, contribution, and an admin user are required'); return;
    }
    setBusy(true);
    try {
      const { data: g, error } = await supabase.from('chama_groups').insert({
        name: name.trim(),
        description: description.trim() || null,
        contribution_amount: Number(contribution),
        contribution_frequency: frequency,
        max_members: Number(maxMembers) || 20,
        is_public: isPublic === 'true',
        created_by: admin.user_id,
      } as any).select('id').single();
      if (error) throw error;

      await supabase.from('chama_members').insert({
        group_id: g.id, user_id: admin.user_id, role: 'admin', is_active: true,
      } as any);

      toast.success('Chama created');
      onOpenChange(false);
      setName(''); setDescription(''); setContribution(''); setAdmin(null); setSearch('');
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users size={18} className="text-accent" /> Create Chama Group</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Group Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><Label className="text-xs">Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px]" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">Contribution (KES)</Label><Input type="number" value={contribution} onChange={(e) => setContribution(e.target.value)} /></div>
            <div>
              <Label className="text-xs">Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Max Members</Label><Input type="number" value={maxMembers} onChange={(e) => setMaxMembers(e.target.value)} /></div>
            <div>
              <Label className="text-xs">Visibility</Label>
              <Select value={isPublic} onValueChange={setIsPublic}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Public</SelectItem>
                  <SelectItem value="false">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {admin ? (
            <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">Owner: {admin.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{admin.phone || admin.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setAdmin(null)}>Change</Button>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Assign Owner / Admin</Label>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user…" />
              {results.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto border border-border/40 rounded-lg">
                  {results.map((r) => (
                    <button key={r.user_id} onClick={() => setAdmin(r)}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm border-b border-border/20 last:border-0">
                      <p className="font-medium">{r.full_name}</p>
                      <p className="text-xs text-muted-foreground">{r.phone || r.email}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16} /> : 'Create Chama'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
