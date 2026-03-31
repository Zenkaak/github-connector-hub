import { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, FileText, X, Download, Loader2, HeadphonesIcon, MessageCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface SupportMessage {
  id: string;
  user_id: string;
  sender_type: string;
  message: string;
  file_url?: string | null;
  is_read?: boolean;
  created_at: string;
  group_id: string;
}

interface Props {
  groupId: string;
  members: Array<{ user_id: string; role?: string; profile?: { full_name: string; phone: string } }>;
  myRole: string;
}

export function ChamaSupportChat({ groupId, members, myRole }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);
  const chairperson = members.find(m => (m as any).role === 'chairperson');

  // For leaders: list members who have sent messages
  const [memberThreads, setMemberThreads] = useState<Array<{ user_id: string; name: string; unread: number; lastMessage: string }>>([]);

  const getMemberName = (userId: string) => {
    return members.find(m => m.user_id === userId)?.profile?.full_name || 'Unknown';
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('chama_support_messages')
      .select('*')
      .eq('group_id', groupId)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(200);
    if (data) setMessages(data as SupportMessage[]);

    // Mark as read
    if (data && data.length > 0) {
      await supabase
        .from('chama_support_messages')
        .update({ is_read: true } as any)
        .eq('group_id', groupId)
        .eq('user_id' as any, user.id)
        .eq('user_id' as any, otherUserId);
    }
  };

  const fetchThreads = async () => {
    if (!user) return;
    // Get all support messages where I'm sender or receiver
    const { data } = await supabase
      .from('chama_support_messages')
      .select('*')
      .eq('group_id', groupId)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (!data) return;

    const threadMap = new Map<string, { lastMessage: string; unread: number; lastTime: string }>();
    for (const msg of data as SupportMessage[]) {
      const otherUser = (msg as any).user_id === user.id ? (msg as any).user_id : (msg as any).user_id;
      if (!threadMap.has(otherUser)) {
        threadMap.set(otherUser, {
          lastMessage: msg.message,
          unread: 0,
          lastTime: msg.created_at,
        });
      }
      if ((msg as any).user_id === user.id && !msg.is_read) {
        const t = threadMap.get(otherUser)!;
        t.unread++;
      }
    }

    const threads = Array.from(threadMap.entries()).map(([uid, data]) => ({
      user_id: uid,
      name: getMemberName(uid),
      unread: data.unread,
      lastMessage: data.lastMessage,
    }));

    setMemberThreads(threads);
  };

  useEffect(() => {
    if (isLeader) {
      fetchThreads();
    } else if (chairperson) {
      setSelectedMember(chairperson.user_id);
      fetchMessages(chairperson.user_id);
    }
  }, [groupId, user]);

  useEffect(() => {
    if (selectedMember) {
      fetchMessages(selectedMember);
    }
  }, [selectedMember]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`chama-support-${groupId}-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chama_support_messages',
        filter: `group_id=eq.${groupId}`,
      }, (payload) => {
        const msg = payload.new as SupportMessage;
        if ((msg as any).user_id === user.id || (msg as any).user_id === user.id) {
          if (selectedMember && ((msg as any).user_id === selectedMember || (msg as any).user_id === selectedMember)) {
            setMessages(prev => [...prev, msg]);
          }
          if (isLeader) fetchThreads();
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [groupId, user, selectedMember]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 10MB', variant: 'destructive' });
      return;
    }
    setPendingFile(file);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPendingPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPendingPreview(null);
    }
  };

  const clearFile = () => {
    setPendingFile(null);
    setPendingPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const uploadFile = async (file: File) => {
    const ext = file.name.split('.').pop();
    const path = `support/${groupId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('chama-files').upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from('chama-files').getPublicUrl(path);
    return { url: data.publicUrl, name: file.name };
  };

  const handleSend = async () => {
    if ((!newMessage.trim() && !pendingFile) || !user || !selectedMember) return;
    setSending(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let msgType = 'text';

      if (pendingFile) {
        setUploading(true);
        const uploaded = await uploadFile(pendingFile);
        fileUrl = uploaded.url;
        fileName = uploaded.name;
        msgType = pendingFile.type.startsWith('image/') ? 'image' : 'file';
        setUploading(false);
      }

      const messageText = newMessage.trim() || (fileName ? `📎 ${fileName}` : '');

      const { error } = await supabase.from('chama_support_messages').insert({
        group_id: groupId,
        sender_id: user.id,
        receiver_id: selectedMember,
        message: messageText,
        file_url: fileUrl,
        file_name: fileName,
        message_type: msgType,
      } as any);
      if (error) throw error;

      // Notify receiver
      await supabase.from('notifications').insert({
        user_id: selectedMember,
        title: '💬 Private Support Message',
        message: `${getMemberName(user.id)}: ${messageText.slice(0, 100)}`,
      });

      setNewMessage('');
      clearFile();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSending(false);
      setUploading(false);
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

  const isImage = (msg: SupportMessage) => (msg as any).message_type === 'image' || msg.file_url?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

  // Leader view: show thread list if no member selected
  if (isLeader && !selectedMember) {
    return (
      <div className="space-y-3">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-bold flex items-center gap-2">
            <HeadphonesIcon size={16} className="text-accent" /> Member Support Requests
          </h3>
          <p className="text-xs text-muted-foreground mt-1">Private conversations with members. Documents shared here are only visible to you and the member.</p>
        </div>

        {memberThreads.length === 0 ? (
          <div className="p-8 text-center">
            <MessageCircle size={32} className="mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No support messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Members can reach you privately here</p>
          </div>
        ) : (
          memberThreads.map(t => (
            <button
              key={t.user_id}
              onClick={() => setSelectedMember(t.user_id)}
              className="w-full text-left p-4 hover:bg-muted/50 transition-colors border-b border-border/30 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {t.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm text-foreground">{t.name}</p>
                  {t.unread > 0 && (
                    <span className="w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                      {t.unread}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{t.lastMessage}</p>
              </div>
            </button>
          ))
        )}

        {/* Quick select any member to start conversation */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">Or start a conversation with:</p>
          <div className="flex flex-wrap gap-1.5">
            {members.filter(m => m.user_id !== user?.id && !memberThreads.find(t => t.user_id === m.user_id)).slice(0, 10).map(m => (
              <Button key={m.user_id} variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelectedMember(m.user_id)}>
                {m.profile?.full_name?.split(' ')[0] || 'Member'}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-3 border-b border-border flex items-center gap-3">
        {isLeader && (
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setSelectedMember(null); setMessages([]); }}>
            ← Back
          </Button>
        )}
        <div className="flex items-center gap-2 flex-1">
          <HeadphonesIcon size={16} className="text-accent" />
          <div>
            <p className="text-sm font-medium">
              {selectedMember ? getMemberName(selectedMember) : 'Support'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {isLeader ? 'Private conversation' : 'Private chat with Chairperson'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <HeadphonesIcon size={32} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {isLeader ? 'No messages with this member yet' : 'Need help? Send a message to the Chairperson'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Documents shared here are private — only you and the {isLeader ? 'member' : 'Chairperson'} can see them.
            </p>
          </div>
        ) : (
          messages.map(msg => {
            const isMe = (msg as any).user_id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                  isMe ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'
                }`}>
                  {/* Image */}
                  {msg.file_url && isImage(msg) && (
                    <a href={msg.file_url} target="_blank" rel="noopener noreferrer" className="block mb-1.5">
                      <img src={msg.file_url} alt={(msg as any).file_name || 'Image'} className="rounded-lg max-h-48 w-auto" />
                    </a>
                  )}

                  {/* File */}
                  {msg.file_url && !isImage(msg) && (
                    <a
                      href={msg.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border/50 mb-1.5 hover:bg-background/80 transition-colors"
                    >
                      <FileText size={16} className="text-accent shrink-0" />
                      <span className="text-xs truncate">{(msg as any).file_name || 'File'}</span>
                      <Download size={12} className="text-muted-foreground shrink-0 ml-auto" />
                    </a>
                  )}

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

      {/* Pending file */}
      {pendingFile && (
        <div className="border-t border-border px-3 py-2 flex items-center gap-2 bg-muted/30">
          {pendingPreview ? (
            <img src={pendingPreview} alt="" className="w-10 h-10 rounded object-cover" />
          ) : (
            <div className="w-10 h-10 rounded bg-accent/10 flex items-center justify-center">
              <FileText size={16} className="text-accent" />
            </div>
          )}
          <span className="text-xs text-foreground truncate flex-1">{pendingFile.name}</span>
          <button onClick={clearFile} className="text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input */}
      <div className="border-t p-3 flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-muted-foreground hover:text-accent"
          onClick={() => fileInputRef.current?.click()}
          disabled={sending}
        >
          <Paperclip size={18} />
        </Button>

        {isLeader && selectedMember && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-accent" disabled={sending}>
                <FileText size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Request Document</p>
              {[
                { label: 'National ID', emoji: '🪪' },
                { label: 'Payslip', emoji: '💰' },
                { label: 'Bank Statement', emoji: '🏦' },
                { label: 'KRA PIN Certificate', emoji: '📄' },
                { label: 'Business Permit', emoji: '🏢' },
                { label: 'Passport Photo', emoji: '📸' },
              ].map(doc => (
                <DropdownMenuItem
                  key={doc.label}
                  onClick={async () => {
                    if (!user || !selectedMember) return;
                    const reqMsg = `📋 Document Request: Please upload your ${doc.label} ${doc.emoji}`;
                    try {
                      await supabase.from('chama_support_messages').insert({
                        group_id: groupId,
                        sender_id: user.id,
                        receiver_id: selectedMember,
                        message: reqMsg,
                        message_type: 'doc_request',
                      } as any);
                      await supabase.from('notifications').insert({
                        user_id: selectedMember,
                        title: `📋 Document Requested`,
                        message: `${getMemberName(user.id)} has requested your ${doc.label}. Please upload it in the Support chat.`,
                      });
                      toast({ title: 'Document requested', description: `${doc.label} request sent to ${getMemberName(selectedMember)}` });
                    } catch (err: any) {
                      toast({ title: 'Error', description: err.message, variant: 'destructive' });
                    }
                  }}
                >
                  <span className="mr-2">{doc.emoji}</span> {doc.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder={uploading ? 'Uploading...' : 'Type a message...'}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          maxLength={1000}
          disabled={uploading}
        />
        <Button size="icon" onClick={handleSend} disabled={sending || (!newMessage.trim() && !pendingFile)}>
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}
