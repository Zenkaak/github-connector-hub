import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Users, Crown, Search, UserPlus, ArrowLeft, BookOpen, Coins, MessageSquare, Wallet,
  FileText, AlertTriangle, TrendingUp, Calendar, PiggyBank, Settings, Megaphone,
  Landmark, LogOut, UserCheck, Receipt, Vote, HandCoins, HeadphonesIcon, Camera,
  Loader2, CalendarDays, Download, Shield, RefreshCw, ArrowDownLeft, ArrowUpRight,
  Eye, EyeOff, ChevronRight, Bell, Grid3x3, History, Home,
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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

const roleLabels: Record<string, string> = { chairperson: 'Chairperson', secretary: 'Secretary', treasurer: 'Treasurer', member: 'Member' };
const roleIcons: Record<string, typeof Crown> = { chairperson: Crown, secretary: BookOpen, treasurer: Coins, member: Users };
const roleColors: Record<string, string> = {
  chairperson: 'bg-amber-400/15 text-amber-200 border-amber-300/30',
  secretary: 'bg-sky-400/15 text-sky-200 border-sky-300/30',
  treasurer: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/30',
  member: 'bg-white/5 text-slate-300 border-white/10',
};

type TabDef = { value: string; icon: typeof Users; label: string };

const bottomTabs: TabDef[] = [
  { value: 'home', icon: Home, label: 'Home' },
  { value: 'savings', icon: Wallet, label: 'Savings' },
  { value: 'loans', icon: HandCoins, label: 'Loans' },
  { value: 'members', icon: Users, label: 'Members' },
];

const primaryActions: TabDef[] = [
  { value: 'savings', icon: ArrowDownLeft, label: 'Deposit' },
  { value: 'withdrawals', icon: ArrowUpRight, label: 'Withdraw' },
  { value: 'loans', icon: HandCoins, label: 'Borrow' },
  { value: 'mgr', icon: RefreshCw, label: 'Merry-Go' },
];

const secondaryActions: TabDef[] = [
  { value: 'transactions', icon: History, label: 'Statement' },
  { value: 'chat', icon: MessageSquare, label: 'Chat' },
  { value: 'announcements', icon: Megaphone, label: 'Notices' },
  { value: 'meetings', icon: CalendarDays, label: 'Meetings' },
  { value: 'votes', icon: Vote, label: 'Votes' },
  { value: 'arrears', icon: AlertTriangle, label: 'Arrears' },
  { value: 'penalties', icon: Shield, label: 'Penalties' },
  { value: 'reports', icon: Download, label: 'Reports' },
];

export default function ChamaGroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string>('member');
  const [activeTab, setActiveTab] = useState('home');
  const [showBalance, setShowBalance] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
  const profilePicRef = useRef<HTMLInputElement>(null);

  const isLeader = ['chairperson', 'secretary', 'treasurer'].includes(myRole);
  const isChair = myRole === 'chairperson';

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
      if (feesRes.data) setTotalJoiningFees(feesRes.data.reduce((s, r) => s + r.amount, 0));
      if (platformFeesRes.data) setTotalPlatformFees(platformFeesRes.data.reduce((s, r) => s + r.amount, 0));
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

  const drawerSections = useMemo(() => ([
    { id: 'governance', label: 'Governance', items: [
      { value: 'terms', icon: FileText, label: 'Terms & Rules' },
      ...(isLeader ? [{ value: 'requests', icon: UserCheck, label: 'Join Requests' }] : []),
      ...(isChair ? [{ value: 'settings', icon: Settings, label: 'Group Settings' }] : []),
      { value: 'leave', icon: LogOut, label: 'Leave Group' },
    ]},
    { id: 'more', label: 'More', items: [
      { value: 'emergency', icon: Shield, label: 'Emergency Fund' },
      { value: 'support', icon: HeadphonesIcon, label: 'Support' },
    ]},
  ]), [isLeader, isChair]);

  const allTabs: TabDef[] = useMemo(() => ([
    ...bottomTabs, ...primaryActions, ...secondaryActions,
    ...drawerSections.flatMap(s => s.items),
  ]), [drawerSections]);

  const activeTabMeta = useMemo(() => allTabs.find(t => t.value === activeTab), [allTabs, activeTab]);
  const isBottomTab = bottomTabs.some(t => t.value === activeTab);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-4">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!group) return null;

  const myRoleLabel = roleLabels[myRole] || 'Member';
  const renderHome = () => (
    <div className="space-y-4">
      <Card className="overflow-hidden border border-white/10 bg-gradient-to-br from-teal-700 via-emerald-700 to-emerald-800 text-white shadow-xl shadow-emerald-950/40">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative group">
                {group.profile_image_url ? (
                  <img src={group.profile_image_url} alt={group.name} className="w-12 h-12 rounded-2xl object-cover border border-white/20" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20">
                    <PiggyBank size={22} className="text-white" />
                  </div>
                )}
                {isChair && (
                  <>
                    <input ref={profilePicRef} type="file" accept="image/*" className="hidden" onChange={handleProfilePicUpload} />
                    <button
                      onClick={() => profilePicRef.current?.click()}
                      disabled={uploadingPic}
                      className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    >
                      {uploadingPic ? <Loader2 size={16} className="text-white animate-spin" /> : <Camera size={16} className="text-white" />}
                    </button>
                  </>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wider text-emerald-100/80 font-medium">Group Balance</p>
                <p className="text-2xl font-bold tracking-tight mt-0.5">
                  {showBalance ? `KES ${totalSavings.toLocaleString()}` : 'KES •••••••'}
                </p>
              </div>
            </div>
            <button onClick={() => setShowBalance(v => !v)} className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition shrink-0">
              {showBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <div className="grid grid-cols-3 gap-px mt-3 bg-white/15 rounded-lg overflow-hidden">
            <div className="bg-emerald-800/70 px-2 py-2">
              <p className="text-[9px] text-emerald-100/70 uppercase">My Savings</p>
              <p className="text-xs font-bold mt-0.5">{showBalance ? `KES ${(mySavings/1000).toFixed(1)}K` : '•••'}</p>
            </div>
            <div className="bg-emerald-800/70 px-2 py-2">
              <p className="text-[9px] text-emerald-100/70 uppercase">Joining Fees</p>
              <p className="text-xs font-bold mt-0.5">{showBalance ? `KES ${(totalJoiningFees/1000).toFixed(1)}K` : '•••'}</p>
            </div>
            <div className="bg-emerald-800/70 px-2 py-2">
              <p className="text-[9px] text-emerald-100/70 uppercase">Deposits</p>
              <p className="text-xs font-bold mt-0.5">{savingsCount}</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-3 bg-white/[0.04] border-white/10 backdrop-blur-sm">
        <div className="grid grid-cols-4 gap-2">
          {primaryActions.map(a => {
            const Icon = a.icon;
            return (
              <button
                key={a.value}
                onClick={() => setActiveTab(a.value)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-white/5 active:bg-white/10 transition-colors"
              >
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400/25 to-teal-500/15 border border-emerald-300/20 flex items-center justify-center shadow-inner">
                  <Icon size={20} className="text-emerald-200" />
                </div>
                <span className="text-[10px] font-semibold text-slate-100 leading-tight text-center">{a.label}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Group Services</h3>
          <button onClick={() => setDrawerOpen(true)} className="text-[11px] text-emerald-300 font-semibold flex items-center gap-0.5 hover:text-emerald-200">
            All <ChevronRight size={12} />
          </button>
        </div>
        <Card className="p-3 bg-white/[0.04] border-white/10 backdrop-blur-sm">
          <div className="grid grid-cols-4 gap-2">
            {secondaryActions.map(a => {
              const Icon = a.icon;
              return (
                <button
                  key={a.value}
                  onClick={() => setActiveTab(a.value)}
                  className="flex flex-col items-center gap-1.5 py-2.5 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                    <Icon size={18} className="text-slate-200" />
                  </div>
                  <span className="text-[10px] font-medium text-slate-300 leading-tight text-center">{a.label}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderMembers = () => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? members.filter(m => (m.profile?.full_name || '').toLowerCase().includes(q) || (m.profile?.phone || '').toLowerCase().includes(q))
      : members;
    const leaders = filtered.filter(m => ['chairperson', 'secretary', 'treasurer'].includes(m.role));
    const regulars = filtered.filter(m => !['chairperson', 'secretary', 'treasurer'].includes(m.role));

    const MemberCard = ({ member }: { member: Member }) => {
      const RoleIcon = roleIcons[member.role] || Users;
      const isMe = member.user_id === user?.id;
      return (
        <div
          className={cn('p-3 flex items-center justify-between gap-2', isChair && !isMe && 'cursor-pointer hover:bg-white/5')}
          onClick={() => { if (isChair && !isMe) setViewMember(member); }}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400/30 to-teal-600/15 border border-emerald-300/20 flex items-center justify-center text-emerald-200 font-bold text-xs shrink-0">
              {member.profile?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate text-slate-100">
                {member.profile?.full_name || 'Unknown'}
                {isMe && <span className="text-[10px] text-slate-400 ml-1 font-normal">(You)</span>}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{member.profile?.phone}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isChair && !isMe ? (
              <>
                <Select value={member.role} onValueChange={val => handleUpdateRole(member.id, val)}>
                  <SelectTrigger className="h-8 text-xs w-[110px] bg-white/5 border-white/15 text-slate-100" onClick={e => e.stopPropagation()}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="treasurer">Treasurer</SelectItem>
                    <SelectItem value="secretary">Secretary</SelectItem>
                    <SelectItem value="chairperson">Chairperson</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-300 hover:text-red-200 hover:bg-white/10" onClick={(e) => { e.stopPropagation(); openRemoveDialog(member.id, member.profile?.full_name || 'member'); }}>
                  <LogOut size={14} />
                </Button>
              </>
            ) : (
              <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium border flex items-center gap-1', roleColors[member.role])}>
                <RoleIcon size={11} /> {roleLabels[member.role]}
              </span>
            )}
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">Members ({members.length})</h2>
          {isLeader && (
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 border-0"><UserPlus size={14} /> Add</Button>
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

        {leaders.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1 mb-1.5 px-1">
              <Crown size={11} /> Leadership
            </p>
            <Card className="divide-y divide-white/10 bg-white/[0.04] border-white/10 backdrop-blur-sm">
              {leaders.map(m => <MemberCard key={m.id} member={m} />)}
            </Card>
          </div>
        )}

        <div>
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 px-1">
            Members ({regulars.length})
          </p>
          <Card className="divide-y divide-white/10 bg-white/[0.04] border-white/10 backdrop-blur-sm">
            {regulars.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400">No members match your search.</div>
            ) : regulars.map(m => <MemberCard key={m.id} member={m} />)}
          </Card>
        </div>
      </div>
    );
  };

  const renderFeature = () => {
    if (!groupId) return null;
    switch (activeTab) {
      case 'savings': return <ChamaSavings groupId={groupId} group={group} members={members} myRole={myRole} onRefreshGroup={fetchGroupData} />;
      case 'withdrawals': return <ChamaWithdrawals groupId={groupId} members={members} myRole={myRole} savings={totalSavings} />;
      case 'loans': return <ChamaLoans groupId={groupId} group={group} members={members} myRole={myRole} />;
      case 'mgr': return <ChamaMerryGoRound groupId={groupId} group={group} members={members} myRole={myRole} />;
      case 'transactions': return <ChamaTransactions groupId={groupId} members={members} />;
      case 'chat': return <Card className="overflow-hidden bg-white/[0.04] border-white/10"><ChamaChat groupId={groupId} members={members} myRole={myRole} /></Card>;
      case 'announcements': return <ChamaAnnouncements groupId={groupId} members={members} myRole={myRole} />;
      case 'meetings': return <ChamaMeetings groupId={groupId} group={group} members={members} myRole={myRole} />;
      case 'votes': return <ChamaVotes groupId={groupId} members={members} myRole={myRole} />;
      case 'arrears': return <ChamaArrears groupId={groupId} group={group} members={members} />;
      case 'penalties': return <ChamaPenalties groupId={groupId} group={group} members={members} myRole={myRole} />;
      case 'reports': return <ChamaReports groupId={groupId} group={group} members={members} />;
      case 'emergency': return <ChamaEmergencyFund groupId={groupId} members={members} />;
      case 'support': return <Card className="overflow-hidden bg-white/[0.04] border-white/10"><ChamaSupportChat groupId={groupId} members={members} myRole={myRole} /></Card>;
      case 'terms': return <ChamaTerms groupId={groupId} group={group} members={members} myRole={myRole} onRefreshGroup={fetchGroupData} />;
      case 'requests': return isLeader ? <ChamaJoinRequests groupId={groupId} group={group} members={members} myRole={myRole} onRefreshGroup={fetchGroupData} /> : null;
      case 'settings': return isChair ? <ChamaSettings groupId={groupId} group={group} members={members} onRefreshGroup={fetchGroupData} /> : null;
      case 'leave': return <ChamaLeaveRequest groupId={groupId} group={group} members={members} myRole={myRole} mySavings={mySavings} onRefreshGroup={fetchGroupData} />;
      default: return null;
    }
  };

  const renderContent = () => {
    if (activeTab === 'home') return renderHome();
    if (activeTab === 'members') return renderMembers();
    return (
      <div className="space-y-3">
        {activeTabMeta && <h2 className="text-base font-bold text-white">{activeTabMeta.label}</h2>}
        <div>{renderFeature()}</div>
      </div>
    );
  };
  return (
    <DashboardLayout>
      <div className="min-h-screen pb-24 bg-gradient-to-b from-emerald-950 via-emerald-900 to-slate-900 text-slate-100 -m-4 lg:-m-8">
        <header className="sticky top-0 z-30 bg-emerald-950/85 backdrop-blur-md border-b border-white/10">
          <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-center gap-2.5">
            <button onClick={() => navigate('/dashboard/chama')} className="p-1.5 -ml-1 rounded-lg hover:bg-white/10 text-slate-100">
              <ArrowLeft size={18} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400/40 to-emerald-600/20 flex items-center justify-center shrink-0 border border-white/10 overflow-hidden">
              {group.profile_image_url ? (
                <img src={group.profile_image_url} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <PiggyBank size={17} className="text-emerald-200" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-extrabold tracking-tight uppercase truncate leading-tight text-white">{group.name}</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide border', roleColors[myRole])}>
                  {myRoleLabel}
                </span>
                <span className="text-[10px] text-slate-300 font-medium">{members.length} members</span>
              </div>
            </div>
            <button className="p-2 rounded-lg hover:bg-white/10 relative text-slate-100">
              <Bell size={17} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />
            </button>
          </div>
          <div className="max-w-2xl mx-auto px-3 pb-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10 focus-within:bg-white/15 focus-within:border-emerald-300/40 transition">
              <Search size={15} className="text-slate-300 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search members, transactions, loans…"
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-slate-400"
              />
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-3 py-3">{renderContent()}</main>

        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-emerald-950/90 backdrop-blur-md border-t border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.4)]">
          <div className="max-w-2xl mx-auto grid grid-cols-5">
            {bottomTabs.map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setActiveTab(t.value)}
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 py-2.5 transition-colors',
                    isActive ? 'text-emerald-300' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {isActive && <span className="absolute top-0 w-8 h-0.5 bg-emerald-300 rounded-full" />}
                  <Icon size={18} />
                  <span className="text-[9px] font-bold uppercase tracking-wide">{t.label}</span>
                </button>
              );
            })}

            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
              <SheetTrigger asChild>
                <button
                  className={cn(
                    'relative flex flex-col items-center gap-0.5 py-2.5 transition-colors',
                    !isBottomTab ? 'text-emerald-300' : 'text-slate-400 hover:text-slate-200',
                  )}
                >
                  {!isBottomTab && <span className="absolute top-0 w-8 h-0.5 bg-emerald-300 rounded-full" />}
                  <Grid3x3 size={18} />
                  <span className="text-[9px] font-bold uppercase tracking-wide">Menu</span>
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] overflow-y-auto rounded-t-2xl bg-gradient-to-b from-emerald-950 to-slate-900 border-t border-white/10 text-slate-100">
                <SheetHeader>
                  <SheetTitle className="text-left text-white">All Services</SheetTitle>
                </SheetHeader>

                <div className="mt-4">
                  <p className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-2">Quick Actions</p>
                  <div className="grid grid-cols-4 gap-2">
                    {primaryActions.map(a => {
                      const Icon = a.icon;
                      return (
                        <button
                          key={a.value}
                          onClick={() => { setActiveTab(a.value); setDrawerOpen(false); }}
                          className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/10 transition"
                        >
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400/25 to-teal-500/15 border border-emerald-300/20 flex items-center justify-center">
                            <Icon size={18} className="text-emerald-200" />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-100 leading-tight text-center">{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-2">Group Services</p>
                  <div className="grid grid-cols-4 gap-2">
                    {secondaryActions.map(a => {
                      const Icon = a.icon;
                      const isActive = activeTab === a.value;
                      return (
                        <button
                          key={a.value}
                          onClick={() => { setActiveTab(a.value); setDrawerOpen(false); }}
                          className={cn(
                            'flex flex-col items-center gap-1.5 py-3 rounded-xl border transition',
                            isActive ? 'bg-emerald-400/15 border-emerald-300/30' : 'bg-white/[0.03] border-white/10 hover:bg-white/10',
                          )}
                        >
                          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                            <Icon size={18} className={cn(isActive ? 'text-emerald-200' : 'text-slate-200')} />
                          </div>
                          <span className="text-[10px] font-medium text-slate-200 leading-tight text-center">{a.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {drawerSections.map(sec => (
                  <div key={sec.id} className="mt-5">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mb-2">{sec.label}</p>
                    <Card className="divide-y divide-white/10 bg-white/[0.04] border-white/10">
                      {sec.items.map(item => {
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.value}
                            onClick={() => { setActiveTab(item.value); setDrawerOpen(false); }}
                            className="w-full px-3 py-3 flex items-center gap-3 hover:bg-white/5 text-left"
                          >
                            <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                              <Icon size={16} className="text-slate-200" />
                            </div>
                            <span className="flex-1 text-sm font-medium text-slate-100">{item.label}</span>
                            <ChevronRight size={14} className="text-slate-400" />
                          </button>
                        );
                      })}
                    </Card>
                  </div>
                ))}
              </SheetContent>
            </Sheet>
          </div>
        </nav>

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

        <Dialog open={!!viewMember} onOpenChange={(open) => { if (!open) setViewMember(null); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Member Details</DialogTitle></DialogHeader>
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
      </div>
    </DashboardLayout>
  );
}
