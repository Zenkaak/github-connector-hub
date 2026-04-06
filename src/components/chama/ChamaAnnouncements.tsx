import { useState, useEffect } from 'react';
import { Megaphone, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Props {
  groupId: string;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string } }>;
  myRole: string;
}

export function ChamaAnnouncements({ groupId, members, myRole }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from('chama_announcements')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    if (data) setAnnouncements(data);
    setLoading(false);
  };

  useEffect(() => { fetchAnnouncements(); }, [groupId]);

  const handleSend = async () => {
    if (!user || !title.trim() || !message.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from('chama_announcements').insert({
        group_id: groupId,
        user_id: user.id,
        title: title.trim(),
        message: message.trim(),
      });
      if (error) throw error;

      // Notify all members
      await supabase.from('notifications').insert(
        members.map(m => ({
          user_id: m.user_id,
          title: `📢 ${title.trim()}`,
          message: message.trim(),
        }))
      );

      toast({ title: 'Announcement Sent', description: 'All members have been notified.' });
      setDialogOpen(false);
      setTitle('');
      setMessage('');
      fetchAnnouncements();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const getSenderName = (userId: string) => {
    return members.find(m => m.user_id === userId)?.profile?.full_name || 'Unknown';
  };

  return (
    <div className="space-y-4">
      {isLeader && (
        <div className="flex justify-end">
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Megaphone size={16} /> New Announcement
          </Button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : announcements.length === 0 ? (
        <Card className="p-8 text-center">
          <Megaphone size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No announcements yet</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Megaphone size={14} className="text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">{a.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{a.message}</p>
                  <p className="text-[11px] text-muted-foreground mt-2">
                    By {getSenderName(a.user_id)} · {new Date(a.created_at).toLocaleString('en-KE')}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Send Announcement</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Meeting this Saturday" maxLength={100} className="mt-1" />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Write your announcement..." rows={4} maxLength={1000} className="mt-1" />
            </div>
            <Button onClick={handleSend} disabled={sending || !title.trim() || !message.trim()} className="w-full gap-2">
              <Send size={16} /> {sending ? 'Sending...' : 'Send to All Members'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
