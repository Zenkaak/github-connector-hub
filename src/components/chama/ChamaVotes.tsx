import { useState, useEffect } from 'react';
import { Vote, Plus, ThumbsUp, ThumbsDown, Clock, CheckCircle2, XCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  groupId: string;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string } }>;
  myRole: string;
}

export function ChamaVotes({ groupId, members, myRole }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [votes, setVotes] = useState<any[]>([]);
  const [responses, setResponses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [voting, setVoting] = useState<string | null>(null);

  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);

  const fetchVotes = async () => {
    const [{ data: votesData }, { data: responsesData }] = await Promise.all([
      supabase.from('chama_votes').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
      supabase.from('chama_vote_responses').select('*'),
    ]);
    if (votesData) setVotes(votesData);
    if (responsesData) setResponses(responsesData);
    setLoading(false);
  };

  useEffect(() => { fetchVotes(); }, [groupId]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('chama-votes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chama_votes', filter: `group_id=eq.${groupId}` }, () => fetchVotes())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chama_vote_responses' }, () => fetchVotes())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [groupId]);

  const handleCreate = async () => {
    if (!user || !title.trim()) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('chama_votes').insert({
        group_id: groupId,
        created_by: user.id,
        title: title.trim(),
        description: description.trim() || null,
        options: ['accept', 'decline'],
        status: 'active',
      });
      if (error) throw error;

      // Notify all members
      await supabase.from('notifications').insert(
        members.map(m => ({
          user_id: m.user_id,
          title: '🗳️ New Vote: ' + title.trim(),
          message: `A new vote has been created in your chama group. Please cast your vote. ${description.trim() || ''}`,
        }))
      );

      // Post to announcements
      await supabase.from('chama_announcements').insert({
        group_id: groupId,
        user_id: user.id,
        title: '🗳️ Vote: ' + title.trim(),
        message: `A vote has been created: "${title.trim()}". ${description.trim() || ''}\n\nPlease go to the Votes tab to cast your decision.`,
      });

      // Post to chat
      await supabase.from('chama_messages').insert({
        group_id: groupId,
        user_id: user.id,
        message: `🗳️ NEW VOTE: "${title.trim()}" — Go to the Votes tab to accept or decline.`,
      });

      toast({ title: 'Vote Created', description: 'All members have been notified.' });
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      fetchVotes();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleVote = async (voteId: string, decision: 'accept' | 'decline') => {
    if (!user) return;
    setVoting(voteId);
    try {
      const { error } = await supabase.from('chama_vote_responses').insert({
        vote_id: voteId,
        user_id: user.id,
        selected_option: decision,
      });
      if (error) throw error;
      toast({ title: decision === 'accept' ? 'Vote Accepted' : 'Vote Declined' });
      fetchVotes();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setVoting(null);
    }
  };

  const handleCloseVote = async (voteId: string) => {
    try {
      const { error } = await supabase.from('chama_votes').update({ status: 'closed', updated_at: new Date().toISOString() }).eq('id', voteId);
      if (error) throw error;

      const voteItem = votes.find(v => v.id === voteId);
      const voteResponses = responses.filter(r => r.vote_id === voteId);
      const accepts = voteResponses.filter(r => r.selected_option === 'accept').length;
      const declines = voteResponses.filter(r => r.selected_option === 'decline').length;

      await supabase.from('notifications').insert(
        members.map(m => ({
          user_id: m.user_id,
          title: '🗳️ Vote Closed: ' + (voteItem?.title || ''),
          message: `Results: ${accepts} Accepted, ${declines} Declined, ${members.length - voteResponses.length} Did not vote.`,
        }))
      );

      toast({ title: 'Vote Closed' });
      fetchVotes();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const getCreatorName = (id: string) => members.find(m => m.user_id === id)?.profile?.full_name || 'Unknown';

  if (loading) return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}</div>;

  return (
    <div className="space-y-4">
      {isLeader && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)} className="gap-2"><Plus size={16} /> Create Vote</Button>
        </div>
      )}

      {votes.length === 0 ? (
        <Card className="p-8 text-center">
          <Vote size={40} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No votes yet</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {votes.map(vote => {
            const voteResponses = responses.filter(r => r.vote_id === vote.id);
            const accepts = voteResponses.filter(r => r.selected_option === 'accept').length;
            const declines = voteResponses.filter(r => r.selected_option === 'decline').length;
            const total = members.length;
            const voted = voteResponses.length;
            const myResponse = voteResponses.find(r => r.user_id === user?.id);
            const isActive = vote.status === 'active';
            const acceptPct = total > 0 ? (accepts / total) * 100 : 0;
            const declinePct = total > 0 ? (declines / total) * 100 : 0;

            return (
              <Card key={vote.id} className={cn('p-4', !isActive && 'opacity-75')}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm">{vote.title}</h4>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium',
                        isActive ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                      )}>
                        {isActive ? 'Active' : 'Closed'}
                      </span>
                    </div>
                    {vote.description && <p className="text-xs text-muted-foreground mt-1">{vote.description}</p>}
                    <p className="text-[11px] text-muted-foreground mt-1">
                      By {getCreatorName(vote.created_by)} · {new Date(vote.created_at).toLocaleString('en-KE')}
                    </p>
                  </div>
                  {isLeader && isActive && (
                    <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => handleCloseVote(vote.id)}>
                      Close Vote
                    </Button>
                  )}
                </div>

                {/* Results bar */}
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <ThumbsUp size={12} className="text-emerald-500" />
                    <span className="w-16">Accept ({accepts})</span>
                    <div className="flex-1"><Progress value={acceptPct} className="h-2" /></div>
                    <span className="w-10 text-right">{Math.round(acceptPct)}%</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <ThumbsDown size={12} className="text-destructive" />
                    <span className="w-16">Decline ({declines})</span>
                    <div className="flex-1"><Progress value={declinePct} className="h-2" /></div>
                    <span className="w-10 text-right">{Math.round(declinePct)}%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Users size={10} /> {voted}/{total} members voted
                  </p>
                </div>

                {/* Vote buttons */}
                {isActive && !myResponse && (
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" className="gap-1.5 flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={voting === vote.id} onClick={() => handleVote(vote.id, 'accept')}>
                      <ThumbsUp size={14} /> Accept
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1.5 flex-1" disabled={voting === vote.id} onClick={() => handleVote(vote.id, 'decline')}>
                      <ThumbsDown size={14} /> Decline
                    </Button>
                  </div>
                )}
                {myResponse && (
                  <p className="text-[11px] mt-2 flex items-center gap-1">
                    {myResponse.selected_option === 'accept' ? (
                      <><CheckCircle2 size={12} className="text-emerald-500" /> You accepted</>
                    ) : (
                      <><XCircle size={12} className="text-destructive" /> You declined</>
                    )}
                  </p>
                )}

                {/* Show who voted (leaders only) */}
                {isLeader && voteResponses.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-[11px] text-muted-foreground cursor-pointer">View individual responses</summary>
                    <div className="mt-1 space-y-1">
                      {voteResponses.map(r => (
                        <div key={r.id} className="flex items-center justify-between text-[11px]">
                          <span>{members.find(m => m.user_id === r.user_id)?.profile?.full_name || 'Unknown'}</span>
                          <span className={r.selected_option === 'accept' ? 'text-emerald-500' : 'text-destructive'}>
                            {r.selected_option === 'accept' ? '✓ Accepted' : '✗ Declined'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Vote</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Question / Title</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Should we increase contributions?" maxLength={200} className="mt-1" />
            </div>
            <div>
              <Label>Description (Optional)</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Additional context..." rows={3} maxLength={1000} className="mt-1" />
            </div>
            <Button onClick={handleCreate} disabled={creating || !title.trim()} className="w-full gap-2">
              <Vote size={16} /> {creating ? 'Creating...' : 'Create & Notify All Members'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
