import { useState } from 'react';
import { Loader2, UserPlus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: () => void;
}

export function AdminCreateUserDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setName(''); setEmail(''); setPhone(''); setPassword(''); };

  const submit = async () => {
    if (!name.trim() || !email.trim() || password.length < 6) {
      toast.error('Name, email, and a 6+ char password are required');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: name.trim(), phone: phone.trim() },
        },
      });
      if (error) throw error;
      const uid = data.user?.id;
      if (uid) {
        await supabase.from('profiles').upsert({
          user_id: uid, full_name: name.trim(), email: email.trim(), phone: phone.trim() || null,
        }, { onConflict: 'user_id' });
      }
      toast.success('User created. They can sign in with the password.');
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e.message || 'Failed to create user');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus size={18} className="text-accent" /> Create User</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Full Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" /></div>
          <div><Label className="text-xs">Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" /></div>
          <div><Label className="text-xs">Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" /></div>
          <div><Label className="text-xs">Temporary Password</Label><Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="gold" onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" size={16} /> : 'Create User'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
