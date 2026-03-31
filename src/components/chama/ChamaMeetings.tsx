import { useState, useEffect } from 'react';
import { Calendar, Plus, Users, MapPin, FileText, Clock, CheckCircle, X, Loader2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Props {
  groupId: string;
  group: any;
  members: Array<{ user_id: string; role: string; profile?: { full_name: string; phone: string } }>;
  myRole: string;
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  meeting_date: string;
  venue: string | null;
  agenda: string | null;
  minutes: string | null;
  status: string;
  created_at: string;
}

export function ChamaMeetings({ groupId, group, members, myRole }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [savingMinutes, setSavingMinutes] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [venue, setVenue] = useState('');
  const [agenda, setAgenda] = useState('');
  const [editMinutes, setEditMinutes] = useState('');

  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);

  const fetchMeetings = async () => {
    const { data } = await supabase
      .from('chama_meetings')
      .select('*')
      .eq('group_id', groupId)
      .order('meeting_date', { ascending: false });
    if (data) setMeetings(data as Meeting[]);
    setLoading(false);
  };

  const fetchAttendance = async (meetingId: string) => {
    const { data } = await supabase
      .from('chama_meeting_attendance')
      .select('*')
      .eq('meeting_id', meetingId);
    const map: Record<string, boolean> = {};
    members.forEach(m => { map[m.user_id] = false; });
    data?.forEach((a: any) => { map[a.user_id] = a.attended; });
    setAttendance(map);
  };

  useEffect(() => { fetchMeetings(); }, [groupId]);

  const handleCreate = async () => {
    if (!title.trim() || !meetingDate || !user) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('chama_meetings').insert({
        group_id: groupId,
        created_by: user.id,
        title: title.trim(),
        description: description.trim() || null,
        meeting_date: new Date(meetingDate).toISOString(),
        venue: venue.trim() || null,
        agenda: agenda.trim() || null,
      } as any);
      if (error) throw error;

      // Notify all members
      const notifications = members.filter(m => m.user_id !== user.id).map(m => ({
        user_id: m.user_id,
        title: '📅 Meeting Scheduled',
        message: `"${title.trim()}" on ${format(new Date(meetingDate), 'PPP p')}${venue ? ` at ${venue}` : ''}`,
      }));
      if (notifications.length > 0) {
        await supabase.from('notifications').insert(notifications);
      }

      toast({ title: 'Meeting scheduled!' });
      setCreateOpen(false);
      setTitle(''); setDescription(''); setMeetingDate(''); setVenue(''); setAgenda('');
      fetchMeetings();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setCreating(false); }
  };

  const openDetail = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setEditMinutes(meeting.minutes || '');
    setDetailOpen(true);
    fetchAttendance(meeting.id);
  };

  const handleSaveMinutes = async () => {
    if (!selectedMeeting) return;
    setSavingMinutes(true);
    try {
      await supabase.from('chama_meetings')
        .update({ minutes: editMinutes.trim(), status: 'completed' } as any)
        .eq('id', selectedMeeting.id);
      toast({ title: 'Minutes saved!' });
      setSelectedMeeting({ ...selectedMeeting, minutes: editMinutes.trim(), status: 'completed' });
      fetchMeetings();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingMinutes(false); }
  };

  const handleSaveAttendance = async () => {
    if (!selectedMeeting) return;
    setSavingAttendance(true);
    try {
      // Upsert attendance for all members
      const rows = Object.entries(attendance).map(([userId, attended]) => ({
        meeting_id: selectedMeeting.id,
        user_id: userId,
        attended,
      }));

      for (const row of rows) {
        await supabase.from('chama_meeting_attendance')
          .upsert(row as any, { onConflict: 'meeting_id,user_id' });
      }

      // Apply meeting absence penalty if enabled
      if (group.meeting_absence_penalty && group.meeting_absence_penalty > 0) {
        const absentMembers = Object.entries(attendance)
          .filter(([_, attended]) => !attended)
          .map(([userId]) => userId);

        if (absentMembers.length > 0) {
          const penalties = absentMembers.map(userId => ({
            group_id: groupId,
            user_id: userId,
            amount: group.meeting_absence_penalty,
            reason: `Meeting absence penalty: "${selectedMeeting.title}"`,
            period_date: new Date().toISOString().split('T')[0],
          }));
          await supabase.from('chama_penalties').insert(penalties as any);

          // Notify absent members
          const notifications = absentMembers.map(userId => ({
            user_id: userId,
            title: '⚠️ Meeting Absence Penalty',
            message: `You were marked absent from "${selectedMeeting.title}". A penalty of KES ${group.meeting_absence_penalty} has been applied.`,
          }));
          await supabase.from('notifications').insert(notifications);
        }
      }

      toast({ title: 'Attendance saved!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally { setSavingAttendance(false); }
  };

  const getMemberName = (userId: string) => members.find(m => m.user_id === userId)?.profile?.full_name || 'Unknown';

  const isPast = (date: string) => new Date(date) < new Date();

  if (loading) return <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Meetings ({meetings.length})
        </h2>
        {isLeader && (
          <Button size="sm" className="gap-1.5" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Schedule
          </Button>
        )}
      </div>

      {meetings.length === 0 ? (
        <Card className="p-8 text-center">
          <Calendar size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No meetings scheduled yet</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {meetings.map(m => (
            <Card
              key={m.id}
              className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => openDetail(m)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    m.status === 'completed' ? 'bg-emerald-500/10' : isPast(m.meeting_date) ? 'bg-amber-500/10' : 'bg-primary/10'
                  }`}>
                    {m.status === 'completed' ? (
                      <CheckCircle size={18} className="text-emerald-500" />
                    ) : (
                      <Calendar size={18} className={isPast(m.meeting_date) ? 'text-amber-500' : 'text-primary'} />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{m.title}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {format(new Date(m.meeting_date), 'PPP p')}
                      </span>
                      {m.venue && (
                        <span className="flex items-center gap-1">
                          <MapPin size={10} /> {m.venue}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  m.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                  isPast(m.meeting_date) ? 'bg-amber-500/10 text-amber-500' :
                  'bg-primary/10 text-primary'
                }`}>
                  {m.status === 'completed' ? 'Completed' : isPast(m.meeting_date) ? 'Pending Minutes' : 'Upcoming'}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Schedule Meeting</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div>
              <Label>Title *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Monthly Group Meeting" maxLength={200} className="mt-1" />
            </div>
            <div>
              <Label>Date & Time *</Label>
              <Input type="datetime-local" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Venue</Label>
              <Input value={venue} onChange={e => setVenue(e.target.value)} placeholder="e.g. Community Hall" maxLength={200} className="mt-1" />
            </div>
            <div>
              <Label>Agenda</Label>
              <Textarea value={agenda} onChange={e => setAgenda(e.target.value)} placeholder="Meeting agenda items..." maxLength={2000} className="mt-1" rows={3} />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Additional details..." maxLength={1000} className="mt-1" rows={2} />
            </div>
            <Button onClick={handleCreate} disabled={creating || !title.trim() || !meetingDate} className="w-full">
              {creating ? 'Scheduling...' : 'Schedule Meeting'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selectedMeeting?.title}</DialogTitle></DialogHeader>
          {selectedMeeting && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Date & Time</p>
                  <p className="font-medium">{format(new Date(selectedMeeting.meeting_date), 'PPP p')}</p>
                </div>
                {selectedMeeting.venue && (
                  <div>
                    <p className="text-xs text-muted-foreground">Venue</p>
                    <p className="font-medium">{selectedMeeting.venue}</p>
                  </div>
                )}
              </div>

              {selectedMeeting.agenda && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Agenda</p>
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-3">{selectedMeeting.agenda}</p>
                </div>
              )}

              {/* Attendance */}
              {isLeader && isPast(selectedMeeting.meeting_date) && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Attendance</p>
                  <div className="space-y-1.5">
                    {members.map(m => (
                      <label key={m.user_id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 cursor-pointer">
                        <Checkbox
                          checked={attendance[m.user_id] || false}
                          onCheckedChange={(checked) => setAttendance(prev => ({ ...prev, [m.user_id]: !!checked }))}
                        />
                        <span className="text-sm">{m.profile?.full_name || 'Unknown'}</span>
                      </label>
                    ))}
                  </div>
                  <Button size="sm" onClick={handleSaveAttendance} disabled={savingAttendance} className="mt-2 w-full">
                    {savingAttendance ? 'Saving...' : 'Save Attendance'}
                  </Button>
                </div>
              )}

              {/* View-only attendance for members */}
              {!isLeader && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-semibold uppercase tracking-wider">Attendance</p>
                  <div className="space-y-1">
                    {members.map(m => (
                      <div key={m.user_id} className="flex items-center gap-2 p-2 text-sm">
                        {attendance[m.user_id] ? (
                          <CheckCircle size={14} className="text-emerald-500" />
                        ) : (
                          <X size={14} className="text-destructive" />
                        )}
                        <span>{m.profile?.full_name || 'Unknown'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Minutes */}
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-semibold uppercase tracking-wider">Minutes</p>
                {isLeader ? (
                  <>
                    <Textarea
                      value={editMinutes}
                      onChange={e => setEditMinutes(e.target.value)}
                      placeholder="Record meeting minutes here..."
                      maxLength={5000}
                      rows={5}
                    />
                    <Button size="sm" onClick={handleSaveMinutes} disabled={savingMinutes} className="mt-2 w-full">
                      {savingMinutes ? 'Saving...' : 'Save Minutes'}
                    </Button>
                  </>
                ) : (
                  <p className="text-sm whitespace-pre-wrap bg-muted/30 rounded-lg p-3">
                    {selectedMeeting.minutes || 'No minutes recorded yet.'}
                  </p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
