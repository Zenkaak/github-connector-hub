import { useState } from 'react';
import { Megaphone, Loader2, Users, Crown, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AdminSectionHeader } from './AdminSectionHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Target = 'chairpersons' | 'all_users';

export function AdminBroadcastModule() {
  const [target, setTarget] = useState<Target>('chairpersons');
  const [message, setMessage] = useState('');
  const [sms, setSms] = useState(true);
  const [notif, setNotif] = useState(true);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (message.trim().length < 2) { toast.error('Message is too short'); return; }
    if (!sms && !notif) { toast.error('Pick at least one channel'); return; }
    if (!confirm(`Send this broadcast to ${target === 'chairpersons' ? 'all chairpersons' : 'ALL USERS'}?`)) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-broadcast', {
        body: { target, message: message.trim(), channels: { sms, notification: notif } },
      });
      if (error) throw error;
      toast.success(`Sent to ${data?.recipients ?? 0} recipients (SMS: ${data?.sentSms ?? 0})`);
      setMessage('');
    } catch (e: any) {
      toast.error(e.message || 'Broadcast failed');
    } finally {
      setSending(false);
    }
  };

  const previewName = 'John';
  const previewChama = 'UMOJA SACCO';
  const previewText = target === 'chairpersons'
    ? `Dear ${previewName}, ${previewChama}: ${message || '<your message>'}`
    : `Dear ${previewName}, ${message || '<your message>'}`;

  return (
    <div className="space-y-5">
      <AdminSectionHeader
        title="Broadcast"
        description="Send announcements to chairpersons or all users"
        icon={Megaphone}
      />

      <Card className="p-5 space-y-5">
        <div>
          <Label className="text-sm font-semibold mb-2 block">Audience</Label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { v: 'chairpersons', label: 'Chairpersons', icon: Crown, hint: 'All active chairpersons' },
              { v: 'all_users', label: 'All Users', icon: Users, hint: 'Every active account' },
            ] as { v: Target; label: string; icon: any; hint: string }[]).map((opt) => (
              <button
                key={opt.v}
                onClick={() => setTarget(opt.v)}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border text-left transition-colors',
                  target === opt.v
                    ? 'border-accent bg-accent/10'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <opt.icon size={18} className={target === opt.v ? 'text-accent mt-0.5' : 'text-muted-foreground mt-0.5'} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground">{opt.hint}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-sm font-semibold mb-2 block">Message</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={400}
            placeholder="Type your announcement…"
          />
          <p className="text-[11px] text-muted-foreground mt-1 text-right">{message.length}/400</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border flex-1 cursor-pointer">
            <div>
              <p className="text-sm font-medium">Send SMS</p>
              <p className="text-[11px] text-muted-foreground">Personalised text message</p>
            </div>
            <Switch checked={sms} onCheckedChange={setSms} />
          </label>
          <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border flex-1 cursor-pointer">
            <div>
              <p className="text-sm font-medium">In-app notification</p>
              <p className="text-[11px] text-muted-foreground">Appears in user's inbox</p>
            </div>
            <Switch checked={notif} onCheckedChange={setNotif} />
          </label>
        </div>

        <div className="rounded-xl bg-muted/40 border border-border p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Preview</p>
          <p className="text-sm text-foreground whitespace-pre-line break-words">{previewText}</p>
        </div>

        <Button onClick={send} disabled={sending || !message.trim()} className="w-full gap-2" size="lg">
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {sending ? 'Sending…' : `Broadcast to ${target === 'chairpersons' ? 'Chairpersons' : 'All Users'}`}
        </Button>
      </Card>
    </div>
  );
}
