import { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ChatMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
}

interface ChamaChatProps {
  groupId: string;
  members: Array<{ user_id: string; role?: string; profile?: { full_name: string } }>;
  myRole?: string;
}

export function ChamaChat({ groupId, members }: ChamaChatProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getMemberName = (userId: string) => {
    const m = members.find(m => m.user_id === userId);
    return m?.profile?.full_name || 'Unknown';
  };

  const getRoleEmoji = (userId: string) => {
    const m = members.find(m => m.user_id === userId);
    const role = (m as any)?.role;
    if (role === 'chairperson') return '👑 ';
    if (role === 'treasurer') return '💰 ';
    if (role === 'secretary') return '📝 ';
    return '';
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('chama_messages')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (data) {
      setMessages(data.map(m => ({ ...m, sender_name: getMemberName(m.sender_id) })));
    }
  };

  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`chama-chat-${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chama_messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const newMsg = payload.new as any;
        setMessages(prev => [...prev, { ...newMsg, sender_name: getMemberName(newMsg.sender_id) }]);
        
        if (newMsg.sender_id !== user?.id) {
          playSound();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, members]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Reuse shared notification sound
  const playSound = () => {
    import('@/lib/notification-sound').then(m => m.playNotificationSound());
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from('chama_messages').insert({
        group_id: groupId,
        sender_id: user.id,
        message: newMessage.trim(),
      });
      if (error) throw error;

      const otherMembers = members.filter(m => m.user_id !== user.id);
      if (otherMembers.length > 0) {
        await supabase.from('notifications').insert(
          otherMembers.map(m => ({
            user_id: m.user_id,
            title: 'New Chama Message',
            message: `${getMemberName(user.id)}: ${newMessage.trim().slice(0, 100)}`,
          }))
        );
      }

      setNewMessage('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-[500px]">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'}`}>
                  {!isMe && <p className="text-[11px] font-semibold mb-0.5 opacity-70">{getRoleEmoji(msg.sender_id)}{msg.sender_name}</p>}
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <p className={`text-[10px] mt-1 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="border-t p-3 flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          maxLength={1000}
        />
        <Button size="icon" onClick={handleSend} disabled={sending || !newMessage.trim()}>
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}
