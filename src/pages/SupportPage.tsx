import { useEffect, useState, useRef } from 'react';
import { Send, MessageSquare, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SupportMessage {
  id: string;
  user_id: string;
  sender_type: 'user' | 'admin';
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function SupportPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) fetchMessages();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages((data as SupportMessage[]) || []);

      // Mark admin messages as read
      await supabase
        .from('support_messages')
        .update({ is_read: true })
        .eq('user_id', user?.id)
        .eq('sender_type', 'admin')
        .eq('is_read', false);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        user_id: user.id,
        sender_type: 'user',
        sender_id: user.id,
        message: newMessage.trim(),
      });
      if (error) throw error;

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          user_id: user.id,
          sender_type: 'user',
          sender_id: user.id,
          message: newMessage.trim(),
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ]);
      setNewMessage('');
      toast.success('Message sent to support');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    const time = d.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 0) return `Today ${time}`;
    if (diffDays === 1) return `Yesterday ${time}`;
    return d.toLocaleDateString('en-KE', { month: 'short', day: 'numeric' }) + ` ${time}`;
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 max-w-[800px] mx-auto flex flex-col" style={{ height: 'calc(100vh - 140px)' }}>
        {/* Header */}
        <div className="mb-4">
          <h1 className="font-display text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare size={20} className="text-accent" />
            Support
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Send a message to our support team</p>
        </div>

        {/* Messages Area */}
        <Card className="flex-1 border-border/50 flex flex-col overflow-hidden">
          <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="animate-spin text-muted-foreground" size={24} />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <MessageSquare className="text-muted-foreground" size={24} />
                </div>
                <h3 className="font-semibold text-sm mb-1">No messages yet</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Send a message below and our team will respond as soon as possible.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={cn('flex', msg.sender_type === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-2xl px-4 py-2.5',
                      msg.sender_type === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    )}
                  >
                    <p className="text-sm">{msg.message}</p>
                    <p
                      className={cn(
                        'text-[10px] mt-1',
                        msg.sender_type === 'user' ? 'text-primary-foreground/50' : 'text-muted-foreground'
                      )}
                    >
                      {msg.sender_type === 'admin' ? 'Support • ' : ''}
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={bottomRef} />
          </CardContent>

          {/* Input Area */}
          <div className="p-3 border-t border-border/50">
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="resize-none min-h-[44px] max-h-[100px] text-sm"
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                variant="gold"
                size="icon"
                className="shrink-0 h-11 w-11"
                onClick={handleSend}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
