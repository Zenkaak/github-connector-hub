import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Crown, Search, UserPlus, ArrowLeft, BookOpen, Coins, MessageSquare, Wallet, FileText, AlertTriangle, TrendingUp, Calendar, PiggyBank, Settings, Megaphone, Landmark, LogOut, UserCheck, Receipt, Vote, HandCoins, HeadphonesIcon, Camera, Loader2, CalendarDays, Download, Shield, MoreHorizontal, RefreshCw } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
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
  const { groupId } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string>('member');
  const [activeTab, setActiveTab] = useState('members');
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
  const MyRoleIcon = roleIcons[myRole] || Users;

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/chama')} className="mb-3 -ml-2 text-muted-foreground gap-1">
          <ArrowLeft size={16} /> Back to Groups
        </Button>

        {/* Group Header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/50 mb-5 overflow-hidden">
            {/* Hero band */}
            <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:p-6">
              <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
              <div className="absolute -left-12 bottom-0 w-32 h-32 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="relative group shrink-0">
                    {group.profile_image_url ? (
                      <img src={group.profile_image_url} alt={group.name} className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover ring-2 ring-primary/20 shadow-md" />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center ring-2 ring-primary/20 shadow-md">
                        <PiggyBank size={28} className="text-primary" />
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
                    <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">Chama Group</p>
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold tracking-tight mt-0.5 truncate">{group.name}</h1>
                    {group.description && <p className="text-xs sm:text-sm text-muted-foreground mt-1 line-clamp-2">{group.description}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={cn('text-[11px] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1', roleColors[myRole])}>
                        <MyRoleIcon size={12} /> {myRoleLabel}
                      </span>
                      <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-background/60 text-foreground/80 ring-1 ring-border flex items-center gap-1">
                        <Users size={11} /> {members.length} members
                      </span>
                    </div>
                  </div>
                </div>
                {isLeader && (
                  <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" className="gap-1.5 shrink-0"><UserPlus size={14} /> Add</Button>
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

            {/* KPI grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border/60 border-t">
              {[
                { label: 'Savings Wallet', value: `KES ${totalSavings.toLocaleString()}`, icon: TrendingUp, color: 'text-primary', bg: 'from-primary/10 to-transparent' },
                { label: 'Joining Fees', value: `KES ${totalJoiningFees.toLocaleString()}`, icon: Coins, color: 'text-amber-500', bg: 'from-amber-500/10 to-transparent' },
                { label: 'Platform Fees', value: `KES ${totalPlatformFees.toLocaleString()}`, icon: Shield, color: 'text-pink-500', bg: 'from-pink-500/10 to-transparent' },
                { label: 'My Savings', value: `KES ${mySavings.toLocaleString()}`, icon: Wallet, color: 'text-emerald-500', bg: 'from-emerald-500/10 to-transparent' },
                { label: 'Members', value: members.length, icon: Users, color: 'text-blue-500', bg: 'from-blue-500/10 to-transparent' },
                { label: 'Deposits', value: savingsCount, icon: Calendar, color: 'text-violet-500', bg: 'from-violet-500/10 to-transparent' },
              ].map((stat, i) => (
                <div key={i} className={cn('relative p-3 lg:p-4 bg-card overflow-hidden')}>
                  <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none', stat.bg)} />
                  <div className="relative">
                    <div className={cn('w-7 h-7 rounded-lg bg-background flex items-center justify-center mb-2 ring-1 ring-border', stat.color)}>
                      <stat.icon size={13} />
                    </div>
                    <p className="text-sm lg:text-base font-bold tracking-tight truncate">{stat.value}</p>
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mt-0.5 truncate">{stat.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          {(() => {
            const primaryTabs = [
              { value: 'members', icon: Users, label: 'Members' },
              { value: 'savings', icon: Wallet, label: 'Savings' },
              { value: 'loans', icon: Landmark, label: 'Loans' },
              { value: 'withdrawals', icon: Coins, label: 'Withdraw' },
              { value: 'mgr', icon: RefreshCw, label: 'Merry-Go-Round' },
            ];
            const moreTabs = [
              { value: 'chat', icon: MessageSquare, label: 'Chat' },
              { value: 'announcements', icon: Megaphone, label: 'Notices' },
              { value: 'meetings', icon: CalendarDays, label: 'Meetings' },
              { value: 'transactions', icon: Receipt, label: 'Transactions' },
              { value: 'votes', icon: Vote, label: 'Votes' },
              { value: 'arrears', icon: AlertTriangle, label: 'Arrears' },
              { value: 'penalties', icon: Shield, label: 'Penalties' },
              { value: 'emergency', icon: Shield, label: 'Emergency' },
              { value: 'reports', icon: Download, label: 'Reports' },
              { value: 'support', icon: HeadphonesIcon, label: 'Support' },
              ...(isLeader ? [{ value: 'requests', icon: UserCheck, label: 'Requests' }] : []),
              { value: 'terms', icon: FileText, label: 'Terms' },
              { value: 'leave', icon: LogOut, label: 'Leave' },
              ...(isChair ? [{ value: 'settings', icon: Settings, label: 'Settings' }] : []),
            ];
            const activeMore = moreTabs.find(t => t.value === activeTab);
            const ActiveMoreIcon = activeMore?.icon || MoreHorizontal;
            return (
              <div className="overflow-x-auto no-scrollbar">
                <TabsList className="inline-flex w-auto h-auto p-1 gap-1 flex-nowrap bg-muted/40 rounded-xl">
                  {primaryTabs.map((tab) => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      title={tab.label}
                      className="flex flex-col items-center gap-1 text-[11px] py-2.5 px-3 min-w-[68px] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                    >
                      <tab.icon size={18} className="shrink-0" />
                      <span className="truncate leading-tight">{tab.label}</span>
                    </TabsTrigger>
                  ))}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "flex flex-col items-center gap-1 text-[11px] py-2.5 px-3 min-w-[68px] rounded-lg transition-colors",
                          activeMore ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                        )}
                        title="More"
                      >
                        <ActiveMoreIcon size={18} className="shrink-0" />
                        <span className="truncate leading-tight">{activeMore?.label || 'More'}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 max-h-[70vh] overflow-y-auto">
                      <DropdownMenuLabel>More options</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {moreTabs.map((tab) => (
                        <DropdownMenuItem
                          key={tab.value}
                          onSelect={() => setActiveTab(tab.value)}
                          className={cn("gap-2 cursor-pointer", activeTab === tab.value && "bg-primary/10 text-primary font-medium")}
                        >
                          <tab.icon size={16} />
                          <span>{tab.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TabsList>
              </div>
            );
          })()}

          <TabsContent value="members" className="mt-4">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Members ({members.length})</h2>
            </div>
            {/* Leaders section */}
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
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <Card className="overflow-hidden">
              <ChamaChat groupId={groupId!} members={members} myRole={myRole} />
            </Card>
          </TabsContent>

          <TabsContent value="savings" className="mt-4">
            <ChamaSavings groupId={groupId!} group={group} members={members} myRole={myRole} onRefreshGroup={fetchGroupData} />
          </TabsContent>

          <TabsContent value="withdrawals" className="mt-4">
            <ChamaWithdrawals groupId={groupId!} members={members} myRole={myRole} savings={totalSavings} />
          </TabsContent>

          <TabsContent value="terms" className="mt-4">
            <ChamaTerms groupId={groupId!} group={group} members={members} myRole={myRole} onRefreshGroup={fetchGroupData} />
          </TabsContent>

          <TabsContent value="transactions" className="mt-4">
            <ChamaTransactions groupId={groupId!} members={members} />
          </TabsContent>

          <TabsContent value="votes" className="mt-4">
            <ChamaVotes groupId={groupId!} members={members} myRole={myRole} />
          </TabsContent>

          <TabsContent value="mgr" className="mt-4">
            <ChamaMerryGoRound groupId={groupId!} group={group} members={members} myRole={myRole} />
          </TabsContent>

          <TabsContent value="support" className="mt-4">
            <Card className="overflow-hidden">
              <ChamaSupportChat groupId={groupId!} members={members} myRole={myRole} />
            </Card>
          </TabsContent>

          <TabsContent value="meetings" className="mt-4">
            <ChamaMeetings groupId={groupId!} group={group} members={members} myRole={myRole} />
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <ChamaReports groupId={groupId!} group={group} members={members} />
          </TabsContent>

          <TabsContent value="penalties" className="mt-4">
            <ChamaPenalties groupId={groupId!} group={group} members={members} myRole={myRole} />
          </TabsContent>

          <TabsContent value="emergency" className="mt-4">
            <ChamaEmergencyFund groupId={groupId!} members={members} />
          </TabsContent>

          <TabsContent value="arrears" className="mt-4">
            <ChamaArrears groupId={groupId!} group={group} members={members} />
          </TabsContent>

          <TabsContent value="announcements" className="mt-4">
            <ChamaAnnouncements groupId={groupId!} members={members} myRole={myRole} />
          </TabsContent>

          <TabsContent value="loans" className="mt-4">
            <ChamaLoans groupId={groupId!} group={group} members={members} myRole={myRole} />
          </TabsContent>

          <TabsContent value="leave" className="mt-4">
            <ChamaLeaveRequest groupId={groupId!} group={group} members={members} myRole={myRole} mySavings={mySavings} onRefreshGroup={fetchGroupData} />
          </TabsContent>

          {isLeader && (
            <TabsContent value="requests" className="mt-4">
              <ChamaJoinRequests groupId={groupId!} group={group} members={members} myRole={myRole} onRefreshGroup={fetchGroupData} />
            </TabsContent>
          )}

          {isChair && (
            <TabsContent value="settings" className="mt-4">
              <ChamaSettings groupId={groupId!} group={group} members={members} onRefreshGroup={fetchGroupData} />
            </TabsContent>
          )}
        </Tabs>

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
      </div>
    </DashboardLayout>
  );
}
