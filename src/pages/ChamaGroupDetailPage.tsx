import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Crown, Search, UserPlus, ArrowLeft, BookOpen, Coins, MessageSquare, Wallet, FileText, AlertTriangle, TrendingUp, Calendar, PiggyBank, Settings, Megaphone, Landmark, LogOut, UserCheck, Receipt, Vote, HandCoins, HeadphonesIcon, Camera, Loader2, CalendarDays, Download, Shield, MoreHorizontal, RefreshCw, Share2, Home, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ChamaChat } from '@/components/chama/ChamaChat';
import { ChamaSavings } from '@/components/chama/ChamaSavings';
import { ChamaWithdrawals } from '@/components/chama/ChamaWithdrawals';
import { ChamaTerms } from '@/components/chama/ChamaTerms';
import { ChamaArrears } from '@/components/chama/ChamaArrears';
import { ChamaSettings } from '@/components/chama/ChamaSettings';
import { ChamaAnnouncements } from '@/components/chama/ChamaAnnouncements';
import { ChamaLoans } from '@/components/chama/ChamaLoans';
import { ChamaLeaveRequest } from '@/components/chama/ChamaLeaveRequest';
import { ChamaJoinRequests } from '@/components/chama/ChamaJoinRequests';
import { ChamaTransactions } from '@/components/chama/ChamaTransactions';
import { ChamaVotes } from '@/components/chama/ChamaVotes';
import { ChamaHarambee } from '@/components/chama/ChamaHarambee';
import { ChamaSupportChat } from '@/components/chama/ChamaSupportChat';
import { ChamaMeetings } from '@/components/chama/ChamaMeetings';
import { ChamaReports } from '@/components/chama/ChamaReports';
import { ChamaPenalties } from '@/components/chama/ChamaPenalties';
import { ChamaEmergencyFund } from '@/components/chama/ChamaEmergencyFund';
import { ChamaMerryGoRound } from '@/components/chama/ChamaMerryGoRound';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  user_id: string;
  role: string;
  joined_at?: string;
  created_at: string;
  is_active?: boolean;
  profile?: { full_name: string; phone: string; email: string; county?: string; sub_county?: string; ward?: string };
}

export default function ChamaGroupDetailPage() {
  const { groupId, section } = useParams<{ groupId: string; section?: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const currentSection = section || 'home';
  const goToSection = (s?: string) =>
    navigate(s && s !== 'home' ? `/dashboard/chama/${groupId}/${s}` : `/dashboard/chama/${groupId}`);

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string>('member');
  // Section is URL-driven; no local activeTab state needed.
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalJoiningFees, setTotalJoiningFees] = useState(0);
  const [mySavings, setMySavings] = useState(0);
  const [savingsCount, setSavingsCount] = useState(0);
  const [totalPlatformFees, setTotalPlatformFees] = useState(0);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [searchPhone, setSearchPhone] = useState('');
  const [searchResult, setSearchResult] = useState<{ user_id: string; full_name: string; phone: string } | null>(null);
  const [searching, setSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('member');
  const [adding, setAdding] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<string | null>(null);
  const [removeMemberName, setRemoveMemberName] = useState('');
  const [removeReason, setRemoveReason] = useState('');
  const [removing, setRemoving] = useState(false);
  const [viewMember, setViewMember] = useState<Member | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const profilePicRef = useRef<HTMLInputElement>(null);

  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);
  const isChair = myRole === 'chairperson';

  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/dashboard/chama/${groupId}` : '';
  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: group?.name || 'Chama Group', text: `Join "${group?.name}" on DASNET`, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        toast({ title: 'Link copied', description: 'Share link copied to clipboard.' });
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch {}
  };

  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupId || !isChair) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file', description: 'Please select an image file', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'File too large', description: 'Max 5MB', variant: 'destructive' });
      return;
    }
    setUploadingPic(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `chama-profiles/${groupId}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from('chama-files').upload(filePath, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = supabase.storage.from('chama-files').getPublicUrl(filePath);
      const publicUrl = urlData.publicUrl + '?t=' + Date.now();
      const { error: updateErr } = await supabase.from('chama_groups').update({ profile_image_url: publicUrl } as any).eq('id', groupId);
      if (updateErr) throw updateErr;
      setGroup((prev: any) => ({ ...prev, profile_image_url: publicUrl }));
      toast({ title: 'Profile picture updated!' });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploadingPic(false);
      if (profilePicRef.current) profilePicRef.current.value = '';
    }
  };

  const fetchGroupData = async () => {
    if (!groupId || !user) return;
    try {
      const { data: groupData } = await supabase.from('chama_groups').select('*').eq('id', groupId).single();
      if (!groupData) { navigate('/dashboard/chama'); return; }
      setGroup(groupData);

      const { data: membersData } = await supabase.from('chama_members').select('*').eq('group_id', groupId).order('created_at', { ascending: true });
      if (membersData) {
        const userIds = membersData.map(m => m.user_id);
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, phone, email, county, sub_county, ward').in('user_id', userIds);
        const enriched = membersData.map(m => ({ ...m, profile: profiles?.find(p => p.user_id === m.user_id) }));
        setAllMembers(enriched);
        const active = enriched.filter(m => (m as any).is_active !== false);
        setMembers(active);
        const me = membersData.find(m => m.user_id === user.id);
        if (me) setMyRole(me.role);
      }

      const [savingsRes, feesRes, platformFeesRes] = await Promise.all([
        supabase.from('chama_savings').select('amount, user_id').eq('group_id', groupId),
        supabase.from('chama_joining_fees').select('amount').eq('group_id', groupId),
        supabase.from('chama_platform_fees').select('amount').eq('group_id', groupId),
      ]);
      if (savingsRes.data) {
        setTotalSavings(savingsRes.data.reduce((s, r) => s + r.amount, 0));
        setMySavings(savingsRes.data.filter(s => s.user_id === user.id).reduce((s, r) => s + r.amount, 0));
        setSavingsCount(savingsRes.data.length);
      }
      if (feesRes.data) {
        setTotalJoiningFees(feesRes.data.reduce((s, r) => s + r.amount, 0));
      }
      if (platformFeesRes.data) {
        setTotalPlatformFees(platformFeesRes.data.reduce((s, r) => s + r.amount, 0));
      }
    } catch (error) {
      console.error('Error fetching group:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroupData(); }, [groupId, user]);

  const handleSearchUser = async () => {
    if (!searchPhone.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      let phone = searchPhone.trim().replace(/\s/g, '');
      const phonesToTry = [phone];
      if (phone.startsWith('0')) { phonesToTry.push('+254' + phone.slice(1)); phonesToTry.push('254' + phone.slice(1)); }
      else if (phone.startsWith('254')) { phonesToTry.push('+' + phone); phonesToTry.push('0' + phone.slice(3)); }
      else if (phone.startsWith('+254')) { phonesToTry.push(phone.slice(1)); phonesToTry.push('0' + phone.slice(4)); }

      const { data } = await supabase.from('profiles').select('user_id, full_name, phone').in('phone', phonesToTry).limit(1).maybeSingle();
      if (data) {
        if (members.find(m => m.user_id === data.user_id)) {
          toast({ title: 'Already a Member', description: `${data.full_name} is already in this group.`, variant: 'destructive' });
        } else {
          setSearchResult(data);
        }
      } else {
        toast({ title: 'Not Found', description: 'No registered user found with that phone number.', variant: 'destructive' });
      }
    } catch {} finally { setSearching(false); }
  };

  const handleAddMember = async () => {
    if (!searchResult || !groupId || !user) return;
    setAdding(true);
    try {
      const { error } = await supabase.from('chama_members').insert({ group_id: groupId, user_id: searchResult.user_id, role: selectedRole as any, added_by: user.id });
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: searchResult.user_id,
        title: 'Added to Chama Group',
        message: `You have been added to "${group?.name}" as ${selectedRole}.`,
      });
      toast({ title: 'Member Added', description: `${searchResult.full_name} has been added.` });
      setAddDialogOpen(false); setSearchPhone(''); setSearchResult(null); setSelectedRole('member');
      fetchGroupData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setAdding(false); }
  };

  const openRemoveDialog = (memberId: string, memberName: string) => {
    setRemoveMemberId(memberId);
    setRemoveMemberName(memberName);
    setRemoveReason('');
    setRemoveDialogOpen(true);
  };

  const handleDeactivateMember = async () => {
    if (!removeMemberId || !removeReason.trim() || !user || !groupId) return;
    setRemoving(true);
    try {
      const removedMember = members.find(m => m.id === removeMemberId);
      if (!removedMember?.user_id) throw new Error('Member not found');

      // Submit removal request to admin (matches actual schema)
      const { error } = await supabase.from('chama_member_removal_requests').insert({
        group_id: groupId,
        member_id: removedMember.user_id,
        requested_by: user.id,
        reason: removeReason.trim(),
      });
      if (error) throw error;

      toast({ title: 'Removal Request Submitted', description: `Your request to remove ${removeMemberName} has been sent to admin for review.` });
      setRemoveDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setRemoving(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase.from('chama_members').update({ role: newRole as any }).eq('id', memberId);
      if (error) throw error;
      toast({ title: 'Role Updated' });
      fetchGroupData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const roleLabels: Record<string, string> = { chairperson: 'Chairperson', secretary: 'Secretary', treasurer: 'Treasurer', member: 'Member' };
  const roleIcons: Record<string, typeof Crown> = { chairperson: Crown, secretary: BookOpen, treasurer: Coins, member: Users };
  const roleColors: Record<string, string> = { chairperson: 'bg-accent/10 text-accent', secretary: 'bg-blue-500/10 text-blue-500', treasurer: 'bg-emerald-500/10 text-emerald-500', member: 'bg-muted text-muted-foreground' };

  const sendBroadcast = async () => {
    if (!broadcastMsg.trim() || !groupId) return;
    setBroadcasting(true);
    try {
      const { data, error } = await supabase.functions.invoke('chama-broadcast', {
        body: { group_id: groupId, message: broadcastMsg.trim() },
      });
      if (error) throw error;
      const sent = (data as any)?.sent || 0;
      const failed = (data as any)?.failed || 0;
      toast({ title: 'Broadcast sent', description: `${sent} delivered${failed ? `, ${failed} failed` : ''}.` });
      setBroadcastOpen(false); setBroadcastMsg('');
    } catch (e: any) {
      toast({ title: 'Broadcast failed', description: e.message, variant: 'destructive' });
    } finally { setBroadcasting(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!group) return null;

  const myRoleLabel = roleLabels[myRole] || 'Member';
  const MyRoleIcon = roleIcons[myRole] || Users;

  // Bottom nav uses dedicated routes, separate from the in-hero quick actions.
  const bottomNavItems = [
    { id: 'home',          icon: Home,         label: 'Home',     action: () => goToSection(),                isActive: currentSection === 'home' },
    { id: 'members',       icon: Users,        label: 'Members',  action: () => goToSection('members'),       isActive: currentSection === 'members' },
    { id: 'mgr',           icon: RefreshCw,    label: 'Merry-go',   action: () => goToSection('mgr'),         isActive: currentSection === 'mgr' },
    { id: 'withdrawals',   icon: Wallet,       label: 'Withdraw',   action: () => goToSection('withdrawals'), isActive: currentSection === 'withdrawals' },
    { id: 'settings',      icon: Settings,     label: 'Settings',   action: () => goToSection('settings'),    isActive: currentSection === 'settings' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 pb-24">
      {/* ── Sticky compact header ── */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/dashboard/chama')}
            className="-ml-2 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors text-[13px] font-medium"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">All chamas</span>
          </button>
          <div className="flex-1 min-w-0 text-center">
            <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground/70 leading-none">Chama</p>
            <p className="text-[13px] font-display font-bold text-foreground truncate leading-tight mt-0.5">{group?.name}</p>
          </div>
          <button
            onClick={handleShare}
            title="Share chama link"
            aria-label="Share chama link"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            {shareCopied ? <Check size={16} /> : <Share2 size={16} />}
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-6 lg:p-8 max-w-6xl mx-auto">

        {/* ── HOME: Banking-grade hero ── */}
        {currentSection === 'home' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">

          {/* Hero card — dark navy with subtle aurora */}
          <div className="relative overflow-hidden rounded-3xl bg-[#0d1f3d] text-white shadow-[0_20px_60px_-25px_rgba(13,31,61,0.55)]">
            <div aria-hidden className="absolute -top-32 -right-24 w-[420px] h-[420px] rounded-full bg-accent/25 blur-[120px] pointer-events-none" />
            <div aria-hidden className="absolute -bottom-40 -left-32 w-[420px] h-[420px] rounded-full bg-emerald-400/15 blur-[120px] pointer-events-none" />
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,255,255,0.08),_transparent_60%)] pointer-events-none" />

            <div className="relative p-5 sm:p-7">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="relative group shrink-0">
                    {group.profile_image_url ? (
                      <img src={group.profile_image_url} alt={group.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 ring-accent/50 shadow-xl" />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-accent/40 to-white/5 flex items-center justify-center ring-2 ring-accent/50 shadow-xl">
                        <PiggyBank size={26} className="text-accent" />
                      </div>
                    )}
                    {isChair && (
                      <>
                        <input ref={profilePicRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} />
                        <button onClick={() => profilePicRef.current?.click()} disabled={uploadingPic} className="absolute inset-0 rounded-2xl bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          {uploadingPic ? <Loader2 size={16} className="text-white animate-spin" /> : <Camera size={16} className="text-white" />}
                        </button>
                      </>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-white/45">Group balance</p>
                    <h1 className="text-base sm:text-lg font-display font-semibold text-white/90 truncate mt-0.5">{group.name}</h1>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isChair && (
                    <button onClick={() => goToSection('settings')} title="Edit chama" aria-label="Edit chama settings" className="h-9 w-9 inline-flex items-center justify-center rounded-xl bg-white/[0.07] border border-white/10 text-white/75 hover:bg-white/15 transition-colors">
                      <Settings size={15} />
                    </button>
                  )}
                  {isLeader && (
                    <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                      <DialogTrigger asChild>
                        <button title="Add member" aria-label="Add member" className="h-9 px-3 inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_8px_24px_-8px_hsl(42_92%_56%_/_0.6)] font-semibold text-xs transition-colors">
                          <UserPlus size={14} />
                          <span>Add</span>
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Add Member</DialogTitle></DialogHeader>
                        <div className="space-y-4 mt-2">
                          <div>
                            <Label>Search by Phone</Label>
                            <div className="flex gap-2 mt-1">
                              <Input value={searchPhone} onChange={e => setSearchPhone(e.target.value)} placeholder="0712345678" maxLength={15} />
                              <Button onClick={handleSearchUser} disabled={searching || !searchPhone.trim()} variant="secondary"><Search size={16} /></Button>
                            </div>
                          </div>
                          {searchResult && (
                            <Card className="p-4 bg-muted/50">
                              <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                                  {searchResult.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm">{searchResult.full_name}</p>
                                  <p className="text-xs text-muted-foreground">{searchResult.phone}</p>
                                </div>
                              </div>
                              <div className="mb-3">
                                <Label>Role</Label>
                                <Select value={selectedRole} onValueChange={setSelectedRole}>
                                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="treasurer">Treasurer</SelectItem>
                                    <SelectItem value="secretary">Secretary</SelectItem>
                                    <SelectItem value="chairperson">Chairperson</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button onClick={handleAddMember} disabled={adding} className="w-full">
                                {adding ? 'Adding...' : `Add ${searchResult.full_name}`}
                              </Button>
                            </Card>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>

              {/* Hero balance */}
              <div className="mt-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] uppercase tracking-wider text-white/45 font-semibold">KES</span>
                  <span className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl tracking-tight text-white tabular-nums">
                    {totalSavings.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300/90 bg-emerald-400/10 border border-emerald-300/20 rounded-full px-2 py-0.5">
                    <TrendingUp size={11} /> Group pool
                  </span>
                  <span className="text-[11px] text-white/45">
                    My share: <span className="font-semibold text-accent">KES {mySavings.toLocaleString()}</span>
                  </span>
                </div>
              </div>

              {/* Identity chips */}
              <div className="flex items-center gap-1.5 mt-4 overflow-x-auto no-scrollbar -mx-0.5 px-0.5">
                <span className="text-[10.5px] px-2.5 py-1 rounded-full font-semibold bg-accent/15 text-accent border border-accent/30 inline-flex items-center gap-1 whitespace-nowrap">
                  <MyRoleIcon size={11} /> {myRoleLabel}
                </span>
                <span className="text-[10.5px] px-2.5 py-1 rounded-full font-semibold bg-white/[0.06] text-white/80 border border-white/10 inline-flex items-center gap-1 whitespace-nowrap">
                  <Users size={11} /> {members.length}{group.max_members ? `/${group.max_members}` : ''} members
                </span>
                {group.contribution_amount > 0 && (
                  <span className="text-[10.5px] px-2.5 py-1 rounded-full font-semibold bg-white/[0.06] text-white/80 border border-white/10 inline-flex items-center gap-1 whitespace-nowrap">
                    <Coins size={11} /> KES {group.contribution_amount.toLocaleString()}/{group.contribution_frequency}
                  </span>
                )}
                <span className="text-[10.5px] px-2.5 py-1 rounded-full font-semibold bg-white/[0.06] text-white/80 border border-white/10 inline-flex items-center gap-1 whitespace-nowrap">
                  <Calendar size={11} /> {savingsCount} deposits
                </span>
              </div>
            </div>
          </div>

          {/* Dense info ribbon — single row, no boxes */}
          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap rounded-2xl border border-border/60 bg-card px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Coins size={13} />
              </div>
              <div className="leading-tight">
                <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">Joining fees</p>
                <p className="text-[12.5px] font-display font-bold tabular-nums">KES {totalJoiningFees.toLocaleString()}</p>
              </div>
            </div>
            <div className="hidden sm:block w-px h-7 bg-border/60" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center">
                <Shield size={13} />
              </div>
              <div className="leading-tight">
                <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">Platform fees</p>
                <p className="text-[12.5px] font-display font-bold tabular-nums">KES {totalPlatformFees.toLocaleString()}</p>
              </div>
            </div>
            <div className="hidden sm:block w-px h-7 bg-border/60" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Users size={13} />
              </div>
              <div className="leading-tight">
                <p className="text-[9.5px] uppercase tracking-wider text-muted-foreground font-semibold">Active members</p>
                <p className="text-[12.5px] font-display font-bold tabular-nums">{members.length}</p>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className={cn("grid gap-2", isChair ? "grid-cols-5" : "grid-cols-4")}>
            {[
              { id: 'savings',     icon: Wallet,        label: 'Contribute', tone: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
              { id: 'loans',       icon: Landmark,      label: 'Loan',       tone: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
              { id: 'withdrawals', icon: HandCoins,     label: 'Withdraw',   tone: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
              { id: 'chat',        icon: MessageSquare, label: 'Chat',       tone: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
              ...(isChair ? [{ id: 'broadcast', icon: Megaphone, label: 'Broadcast', tone: 'bg-pink-500/15 text-pink-600 dark:text-pink-400', onClick: () => setBroadcastOpen(true) }] : []),
            ].map((a: any) => (
              <button
                key={a.id}
                onClick={a.onClick ? a.onClick : () => goToSection(a.id)}
                className="group flex flex-col items-center gap-1.5 rounded-2xl border bg-card px-2 py-3 transition-all border-border/60 hover:border-accent/40 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", a.tone)}>
                  <a.icon size={17} strokeWidth={2.2} />
                </div>
                <span className="text-[11px] font-semibold">{a.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
        )}


        {(() => {
          // Section catalogue — every chama function lives at its own URL/route.
          const allSections: Array<{ id: string; label: string; desc: string; icon: any; tone: string; bg: string; group: string }> = [
            // MONEY — core financial operations first, oversight last
            { id: 'savings',       label: 'Savings',        desc: 'Contribute and track member savings',          icon: Wallet,         tone: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/15', group: 'Money' },
            { id: 'loans',         label: 'Loans',          desc: 'Apply, approve and repay group loans',         icon: Landmark,       tone: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/15',    group: 'Money' },
            { id: 'mgr',           label: 'Merry-Go-Round', desc: 'Rotating payouts to members',                  icon: RefreshCw,      tone: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-500/15',  group: 'Money' },
            { id: 'withdrawals',   label: 'Withdrawals',    desc: 'Request and approve cash-outs',                icon: HandCoins,      tone: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/15',   group: 'Money' },
            { id: 'emergency',     label: 'Emergency Fund', desc: 'Pooled support for member emergencies',        icon: Shield,         tone: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/15',     group: 'Money' },
            { id: 'transactions',  label: 'Transactions',   desc: 'Full ledger of all chama activity',            icon: Receipt,        tone: 'text-cyan-600 dark:text-cyan-400',       bg: 'bg-cyan-500/15',    group: 'Money' },
            { id: 'arrears',       label: 'Arrears',        desc: 'Members behind on contributions',              icon: AlertTriangle,  tone: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-500/15',  group: 'Money' },
            { id: 'penalties',     label: 'Penalties',      desc: 'Fines and disciplinary charges',               icon: Shield,         tone: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-500/15',     group: 'Money' },

            // PEOPLE — communication and coordination
            { id: 'members',       label: 'Members',        desc: 'Manage roles and member profiles',             icon: Users,          tone: 'text-primary',                           bg: 'bg-primary/15',     group: 'People' },
            { id: 'chat',          label: 'Group Chat',     desc: 'Talk with all members in real time',           icon: MessageSquare,  tone: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-500/15',  group: 'People' },
            { id: 'announcements', label: 'Notices',        desc: 'Official announcements from leadership',       icon: Megaphone,      tone: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-500/15',  group: 'People' },
            { id: 'meetings',      label: 'Meetings',       desc: 'Schedule and review group meetings',           icon: CalendarDays,   tone: 'text-teal-600 dark:text-teal-400',       bg: 'bg-teal-500/15',    group: 'People' },
            { id: 'votes',         label: 'Votes',          desc: 'Group decisions and polls',                    icon: Vote,           tone: 'text-fuchsia-600 dark:text-fuchsia-400', bg: 'bg-fuchsia-500/15', group: 'People' },
            { id: 'support',       label: 'Support',        desc: 'Get help from the DASNET team',                icon: HeadphonesIcon, tone: 'text-sky-600 dark:text-sky-400',         bg: 'bg-sky-500/15',     group: 'People' },

            // MANAGE — governance & administration, destructive last
            { id: 'reports',       label: 'Reports',        desc: 'Statements and downloadable reports',          icon: Download,       tone: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/15', group: 'Manage' },
            { id: 'terms',         label: 'Terms',          desc: 'Constitution and group rules',                 icon: FileText,       tone: 'text-slate-600 dark:text-slate-300',     bg: 'bg-slate-500/15',   group: 'Manage' },
            ...(isLeader ? [{ id: 'requests',  label: 'Join Requests', desc: 'Review and approve new members',           icon: UserCheck, tone: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/15', group: 'Manage' }] : []),
            ...(isChair  ? [{ id: 'settings',  label: 'Settings',      desc: 'Configure rules, fees and chama profile',  icon: Settings,  tone: 'text-primary',                       bg: 'bg-primary/15',   group: 'Manage' }] : []),
            { id: 'leave',         label: 'Leave Group',    desc: 'Submit a request to exit this chama',          icon: LogOut,         tone: 'text-destructive',                       bg: 'bg-destructive/15', group: 'Manage' },
          ];
          const active = allSections.find(s => s.id === currentSection);

          if (currentSection === 'home') {
            // Items already exposed via Quick Actions row above — hide here to avoid duplication.
            const quickActionIds = new Set(['savings', 'loans', 'withdrawals', 'chat']);
            const grouped = ['Money', 'People', 'Manage'].map(g => ({
              group: g,
              items: allSections.filter(s => s.group === g && !quickActionIds.has(s.id)),
            })).filter(g => g.items.length > 0);
            return (
              <div className="mt-6 space-y-4">
                {grouped.map(({ group, items }, gi) => (
                  <div key={group}>
                    <div className="flex items-center gap-2 mb-2.5 px-1">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{group}</p>
                      <div className="flex-1 h-px bg-border/60" />
                      <span className="text-[10px] font-semibold text-muted-foreground/70">{items.length}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {items.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => goToSection(s.id)}
                          className={cn(
                            "group relative flex flex-col items-center gap-1.5 rounded-xl border border-border/60 bg-card px-1.5 py-3 text-center transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-accent/40 active:scale-95 overflow-hidden"
                          )}
                        >
                          <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", s.bg)} />
                          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ring-1 ring-border/40', s.bg, s.tone)}>
                            <s.icon size={18} strokeWidth={2.2} />
                          </div>
                          <span className="text-[10.5px] font-semibold leading-tight line-clamp-2 px-0.5 text-foreground">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          }

          // Individual section page: compact header + content
          const ActiveIcon = active?.icon || MoreHorizontal;
          return (
            <div className="mt-2">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-3 flex-wrap" aria-label="Breadcrumb">
                <button onClick={() => navigate('/dashboard/chama')} className="hover:text-foreground transition-colors">Chamas</button>
                <span className="opacity-50">/</span>
                <button onClick={() => goToSection()} className="hover:text-foreground transition-colors truncate max-w-[140px]">{group?.name || 'Chama'}</button>
                <span className="opacity-50">/</span>
                <span className="font-semibold text-foreground truncate">{active?.label || 'Section'}</span>
              </nav>

              {/* Page hero */}
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-muted/40 p-4 sm:p-5 mb-5 shadow-sm">
                <div className={cn('pointer-events-none absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-40', active?.bg)} />
                <div className="relative flex items-start gap-3">
                  <div className={cn('w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 ring-1 ring-border/50', active?.bg, active?.tone)}>
                    <ActiveIcon size={22} strokeWidth={2.2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="font-display font-bold text-lg sm:text-xl leading-tight truncate">{active?.label || 'Section'}</h1>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-snug">{active?.desc}</p>
                  </div>
                  <button
                    onClick={() => goToSection()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border/60 bg-background/60 hover:bg-muted transition-colors shrink-0"
                  >
                    <ArrowLeft size={14} /> <span className="hidden sm:inline">Back</span>
                  </button>
                </div>
              </div>

              {currentSection === 'members' && (
                <>
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Members ({members.length})</h2>
                  </div>
                  {(() => {
                    const leaders = members.filter(m => ['chairperson', 'secretary', 'treasurer'].includes(m.role));
                    const regularMembers = members.filter(m => !['chairperson', 'secretary', 'treasurer'].includes(m.role));
                    return (
                      <>
                        {leaders.length > 0 && (
                          <div className="mb-3">
                            <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">👑 Leaders</p>
                            <div className="space-y-2">
                              {leaders.map(member => {
                                const RoleIcon = roleIcons[member.role] || Users;
                                const isMe = member.user_id === user?.id;
                                return (
                                  <Card key={member.id} className={cn("p-4 border-primary/20", isChair && !isMe && "cursor-pointer hover:border-accent/30 transition-colors")} onClick={() => { if (isChair && !isMe) setViewMember(member); }}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                          {member.profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-sm">
                                            {member.profile?.full_name || 'Unknown'}
                                            {isMe && <span className="text-xs text-muted-foreground ml-1">(You)</span>}
                                          </p>
                                          <p className="text-xs text-muted-foreground">{member.profile?.phone}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {isChair && !isMe ? (
                                          <>
                                            <Select value={member.role} onValueChange={val => handleUpdateRole(member.id, val)}>
                                              <SelectTrigger className="h-8 text-xs w-[120px]" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="member">Member</SelectItem>
                                                <SelectItem value="treasurer">Treasurer</SelectItem>
                                                <SelectItem value="secretary">Secretary</SelectItem>
                                                <SelectItem value="chairperson">Chairperson</SelectItem>
                                              </SelectContent>
                                            </Select>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); openRemoveDialog(member.id, member.profile?.full_name || 'member'); }}>
                                              <LogOut size={14} />
                                            </Button>
                                          </>
                                        ) : (
                                          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${roleColors[member.role]}`}>
                                            <RoleIcon size={12} /> {roleLabels[member.role]}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </Card>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Members ({regularMembers.length})</p>
                          <div className="space-y-2">
                            {regularMembers.map(member => {
                              const RoleIcon = roleIcons[member.role] || Users;
                              const isMe = member.user_id === user?.id;
                              return (
                                <Card key={member.id} className={cn("p-4", isChair && !isMe && "cursor-pointer hover:border-accent/30 transition-colors")} onClick={() => { if (isChair && !isMe) setViewMember(member); }}>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                                        {member.profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm">
                                          {member.profile?.full_name || 'Unknown'}
                                          {isMe && <span className="text-xs text-muted-foreground ml-1">(You)</span>}
                                        </p>
                                        <p className="text-xs text-muted-foreground">{member.profile?.phone}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isChair && !isMe ? (
                                        <>
                                          <Select value={member.role} onValueChange={val => handleUpdateRole(member.id, val)}>
                                            <SelectTrigger className="h-8 text-xs w-[120px]" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="member">Member</SelectItem>
                                              <SelectItem value="treasurer">Treasurer</SelectItem>
                                              <SelectItem value="secretary">Secretary</SelectItem>
                                              <SelectItem value="chairperson">Chairperson</SelectItem>
                                            </SelectContent>
                                          </Select>
                                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); openRemoveDialog(member.id, member.profile?.full_name || 'member'); }}>
                                            <LogOut size={14} />
                                          </Button>
                                        </>
                                      ) : (
                                        <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${roleColors[member.role]}`}>
                                          <RoleIcon size={12} /> {roleLabels[member.role]}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </Card>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </>
              )}

              {currentSection === 'chat'         && <Card className="overflow-hidden"><ChamaChat groupId={groupId!} members={members} myRole={myRole} /></Card>}
              {currentSection === 'savings'      && <ChamaSavings groupId={groupId!} group={group} members={members} myRole={myRole} onRefreshGroup={fetchGroupData} />}
              {currentSection === 'withdrawals'  && <ChamaWithdrawals groupId={groupId!} members={members} myRole={myRole} savings={totalSavings} />}
              {currentSection === 'terms'        && <ChamaTerms groupId={groupId!} group={group} members={members} myRole={myRole} onRefreshGroup={fetchGroupData} />}
              {currentSection === 'transactions' && <ChamaTransactions groupId={groupId!} members={members} />}
              {currentSection === 'votes'        && <ChamaVotes groupId={groupId!} members={members} myRole={myRole} />}
              {currentSection === 'mgr'          && <ChamaMerryGoRound groupId={groupId!} group={group} members={members} myRole={myRole} />}
              {currentSection === 'support'      && <Card className="overflow-hidden"><ChamaSupportChat groupId={groupId!} members={members} myRole={myRole} /></Card>}
              {currentSection === 'meetings'     && <ChamaMeetings groupId={groupId!} group={group} members={members} myRole={myRole} />}
              {currentSection === 'reports'      && <ChamaReports groupId={groupId!} group={group} members={members} />}
              {currentSection === 'penalties'    && <ChamaPenalties groupId={groupId!} group={group} members={members} myRole={myRole} />}
              {currentSection === 'emergency'    && <ChamaEmergencyFund groupId={groupId!} members={members} />}
              {currentSection === 'arrears'      && <ChamaArrears groupId={groupId!} group={group} members={members} />}
              {currentSection === 'announcements'&& <ChamaAnnouncements groupId={groupId!} members={members} myRole={myRole} />}
              {currentSection === 'loans'        && <ChamaLoans groupId={groupId!} group={group} members={members} myRole={myRole} />}
              {currentSection === 'leave'        && <ChamaLeaveRequest groupId={groupId!} group={group} members={members} myRole={myRole} mySavings={mySavings} onRefreshGroup={fetchGroupData} />}
              {currentSection === 'requests' && isLeader && <ChamaJoinRequests groupId={groupId!} group={group} members={members} myRole={myRole} onRefreshGroup={fetchGroupData} />}
              {currentSection === 'settings' && isChair  && <ChamaSettings groupId={groupId!} group={group} members={members} onRefreshGroup={fetchGroupData} />}

              {!active && (
                <Card className="p-10 text-center">
                  <p className="text-sm text-muted-foreground">Section not found.</p>
                  <Button variant="link" onClick={() => goToSection()}>Back to Chama home</Button>
                </Card>
              )}
            </div>
          );
        })()}

        {/* Remove Member Dialog */}
        <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Remove Member</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You are removing <span className="font-semibold text-foreground">{removeMemberName}</span> from this group. They will be deactivated and notified.
              </p>
              <div>
                <Label>Reason for removal *</Label>
                <Input value={removeReason} onChange={e => setRemoveReason(e.target.value)} placeholder="e.g. Missed 3 consecutive payments" maxLength={500} className="mt-1" />
              </div>
              <p className="text-xs text-muted-foreground">This request will be submitted to admin for approval.</p>
              <Button onClick={handleDeactivateMember} disabled={removing || !removeReason.trim()} variant="destructive" className="w-full">
                {removing ? 'Submitting...' : `Request Removal of ${removeMemberName}`}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Member Detail Dialog (Read-only for Chairperson) */}
        <Dialog open={!!viewMember} onOpenChange={(open) => { if (!open) setViewMember(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Member Details</DialogTitle>
            </DialogHeader>
            {viewMember && (
              <div className="space-y-4 mt-2">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                    {viewMember.profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
                  </div>
                  <div>
                    <p className="font-semibold text-base">{viewMember.profile?.full_name || 'Unknown'}</p>
                    <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${roleColors[viewMember.role]}`}>
                      {roleLabels[viewMember.role]}
                    </span>
                  </div>
                </div>
                <div className="space-y-3 bg-muted/50 rounded-xl p-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Phone Number</p>
                    <p className="text-sm font-medium">{viewMember.profile?.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Email</p>
                    <p className="text-sm font-medium">{viewMember.profile?.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Location</p>
                    <p className="text-sm font-medium">
                      {[viewMember.profile?.ward, viewMember.profile?.sub_county, viewMember.profile?.county].filter(Boolean).join(', ') || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Joined</p>
                    <p className="text-sm font-medium">{new Date(viewMember.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              <p className="text-[11px] text-muted-foreground text-center">Read-only • Only visible to Chairperson</p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Broadcast Dialog */}
        <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Broadcast to Members</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <p className="text-xs text-muted-foreground">Send an SMS to all active members of <span className="font-semibold text-foreground">{group?.name}</span>.</p>
              <Textarea
                value={broadcastMsg}
                onChange={e => setBroadcastMsg(e.target.value)}
                placeholder="Type your message..."
                maxLength={280}
                rows={4}
                className="text-sm resize-none"
              />
              <p className="text-[10px] text-muted-foreground text-right">{broadcastMsg.length}/280</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => { setBroadcastOpen(false); setBroadcastMsg(''); }}>Cancel</Button>
              <Button size="sm" onClick={sendBroadcast} disabled={broadcasting || broadcastMsg.trim().length < 2}>
                {broadcasting ? 'Sending...' : 'Send Broadcast'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Chama-specific bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-primary border-t border-white/[0.06] z-40 safe-area-bottom shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.25)]">
        <div className="flex items-stretch justify-around h-16 px-2 max-w-5xl mx-auto">
          {bottomNavItems.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className={cn(
                'flex flex-col items-center justify-center flex-1 min-w-0 gap-0.5 transition-all duration-200 relative',
                item.isActive ? 'text-accent' : 'text-white/55 hover:text-white/85'
              )}
            >
              {item.isActive && (
                <>
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-b-full bg-accent shadow-[0_0_8px_hsl(var(--accent))]" />
                  <span className="absolute inset-x-3 inset-y-1.5 rounded-xl bg-accent/[0.08]" />
                </>
              )}
              <item.icon size={20} strokeWidth={item.isActive ? 2.4 : 1.8} className="relative z-10" />
              <span className={cn('text-[10px] leading-tight relative z-10 tracking-wide', item.isActive ? 'font-semibold' : 'font-medium')}>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
