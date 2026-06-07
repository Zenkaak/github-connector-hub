import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Users, Crown, ChevronRight, Globe, Wallet, TrendingUp,
  Calendar, Sparkles, ShieldCheck, ArrowUpRight, Coins,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';

const DEFAULT_TERMS = `CHAMA GROUP TERMS AND CONDITIONS

1. MEMBERSHIP
   a) All members must be registered and verified on the platform.
   b) New members can only be added by group leaders or through approved join requests.
   c) Members may voluntarily leave by submitting a leave request to the Chairperson.
   d) Leaving members are subject to the group's refund policy as configured in settings.
   e) Members who leave are deactivated, not deleted, to preserve group records.

2. CONTRIBUTIONS
   a) All members are required to make contributions as per the agreed schedule and amount.
   b) Contributions must be made via M-Pesa through the platform.
   c) Late contributions will be recorded as arrears and visible to all members.
   d) Members who consistently default may face penalties as determined by the Chairperson.

3. SAVINGS & WITHDRAWALS
   a) Withdrawals must be requested by the Treasurer and approved by all three leaders.
   b) Approved withdrawals are subject to final admin authorization.
   c) Emergency withdrawals may be considered on a case-by-case basis.
   d) Individual savings refunds on leaving are governed by the group's refund policy.

4. GROUP LOANS
   a) Internal lending is available if enabled by the Chairperson in settings.
   b) Loan amounts, interest rates, and duration are configured by the Chairperson.
   c) Loan requests require Chairperson approval.
   d) Approved loans are disbursed from the group's pooled savings.
   e) Loan repayments must be made on time to avoid penalties.

5. GOVERNANCE
   a) The Chairperson has overall leadership and final decision-making authority.
   b) The Secretary handles group communications, records, and document management.
   c) The Treasurer manages financial transactions and withdrawal requests.
   d) Role changes can only be made by the Chairperson.
   e) The Chairperson manages all group settings including fees, policies, and loan configuration.

6. JOINING & FEES
   a) New members may request to join through the platform's group explorer.
   b) Join requests require approval from group leadership (Chairperson has final say).
   c) A joining fee may be required as configured by the Chairperson.
   d) The joining fee must be paid via M-Pesa before membership is activated.

7. MEETINGS & COMMUNICATION
   a) Members should actively participate in the group chat.
   b) Important announcements will be posted by group leaders.
   c) All members will receive notifications for important updates.

8. PENALTIES
   a) Members who consistently default on contributions may be deactivated by the Chairperson.
   b) Misuse of group funds will result in immediate removal and possible legal action.

9. AMENDMENTS
   a) These terms may be amended by the Chairperson.
   b) All members will be notified of any changes and must re-sign.
   c) Continued participation after notification constitutes acceptance.

By signing below, I agree to abide by these terms and conditions.`;

interface ChamaGroup {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  contribution_amount: number;
  contribution_frequency: string;
  profile_image_url?: string | null;
  meeting_day?: string | null;
  member_count: number;
  my_role: string;
  my_savings: number;
  group_pool: number;
}

const KES = (n: number) =>
  `KES ${(n || 0).toLocaleString('en-KE', { maximumFractionDigits: 0 })}`;

const initials = (name: string) =>
  name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();

const roleLabels: Record<string, string> = {
  chairperson: 'Chairperson', secretary: 'Secretary',
  treasurer: 'Treasurer', member: 'Member',
};
const roleStyles: Record<string, string> = {
  chairperson: 'bg-accent/15 text-accent border-accent/30',
  secretary:   'bg-blue-500/15 text-blue-500 border-blue-500/30',
  treasurer:   'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  member:      'bg-muted text-muted-foreground border-border',
};

export default function ChamaGroupsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isEnabled } = usePlatformSettings();
  const chamaCreationDisabled = !isEnabled('chama_creation_enabled');
  const [groups, setGroups] = useState<ChamaGroup[]>([]);
  const [available, setAvailable] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });
  const [myRequests, setMyRequests] = useState<Record<string, string>>({});

  const fetchGroups = async () => {
    if (!user) return;
    try {
      const { data: memberships } = await supabase
        .from('chama_members')
        .select('group_id, role')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!memberships?.length) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const groupIds = memberships.map(m => m.group_id);
      const { data: groupsData } = await supabase
        .from('chama_groups')
        .select('*')
        .in('id', groupIds);

      if (!groupsData) { setGroups([]); setLoading(false); return; }

      const enriched = await Promise.all(
        groupsData.map(async (g) => {
          const [countRes, poolRes, mineRes] = await Promise.all([
            supabase.from('chama_members').select('id', { count: 'exact', head: true })
              .eq('group_id', g.id).eq('is_active', true),
            supabase.from('chama_savings').select('amount').eq('group_id', g.id),
            supabase.from('chama_savings').select('amount')
              .eq('group_id', g.id).eq('user_id', user.id),
          ]);
          const sum = (rows: any[] | null) =>
            (rows ?? []).reduce((a, r) => a + Number(r.amount || 0), 0);
          return {
            ...g,
            member_count: countRes.count || 0,
            my_role: memberships.find(m => m.group_id === g.id)?.role || 'member',
            group_pool: sum(poolRes.data),
            my_savings: sum(mineRes.data),
          } as ChamaGroup;
        })
      );
      setGroups(enriched);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailable = async (joinedIds: string[]) => {
    if (!user) return;
    const { data: allGroups } = await supabase
      .from('chama_groups')
      .select('id, name, description, contribution_amount, contribution_frequency, joining_fee, profile_image_url')
      .order('created_at', { ascending: false })
      .limit(20);
    if (!allGroups) { setAvailable([]); return; }
    const open = allGroups.filter((g: any) => !joinedIds.includes(g.id));
    const enriched = await Promise.all(
      open.map(async (g: any) => {
        const { count } = await supabase
          .from('chama_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', g.id)
          .eq('is_active', true);
        return { ...g, member_count: count || 0 };
      })
    );
    setAvailable(enriched.slice(0, 6));

    const { data: reqs } = await supabase
      .from('chama_join_requests')
      .select('group_id, status')
      .eq('user_id', user.id);
    const map: Record<string, string> = {};
    (reqs || []).forEach((r: any) => { map[r.group_id] = r.status; });
    setMyRequests(map);
  };

  useEffect(() => {
    (async () => {
      await fetchGroups();
    })();
  }, [user]);

  useEffect(() => {
    if (!loading) fetchAvailable(groups.map(g => g.id));
  }, [loading, groups.length]);

  const handleJoinRequest = async (groupId: string) => {
    if (!user) return;
    if (groups.length >= 3) {
      toast({ title: 'Limit Reached', description: 'You can only join a maximum of 3 Chama groups.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('chama_join_requests').insert({
        group_id: groupId,
        user_id: user.id,
      } as any);
      if (error) throw error;
      setMyRequests(prev => ({ ...prev, [groupId]: 'pending' }));
      toast({ title: 'Request Sent', description: 'Group leaders will review your request.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };


  const totals = useMemo(() => ({
    pool:    groups.reduce((a, g) => a + g.group_pool, 0),
    mine:    groups.reduce((a, g) => a + g.my_savings, 0),
    leading: groups.filter(g => g.my_role === 'chairperson').length,
  }), [groups]);

  const handleCreateGroup = async () => {
    if (!user || !newGroup.name.trim()) return;
    if (chamaCreationDisabled) {
      toast({ title: 'Feature Disabled', description: 'Chama group creation is currently disabled by admin.', variant: 'destructive' });
      return;
    }
    if (groups.length >= 3) {
      toast({ title: 'Limit Reached', description: 'You can only join or create a maximum of 3 Chama groups.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const groupId = crypto.randomUUID();
      const now = new Date().toISOString();

      const { error: groupError } = await supabase.from('chama_groups').insert({
        id: groupId,
        name: newGroup.name.trim(),
        description: newGroup.description.trim() || null,
        created_by: user.id,
        terms: DEFAULT_TERMS,
        terms_updated_at: now,
      });
      if (groupError) throw groupError;

      const { error: memberError } = await supabase.from('chama_members').insert({
        group_id: groupId,
        user_id: user.id,
        role: 'chairperson' as any,
        added_by: user.id,
      });
      if (memberError) throw memberError;

      toast({ title: 'Group Created', description: `${newGroup.name} has been created successfully.` });
      setNewGroup({ name: '', description: '' });
      setDialogOpen(false);
      fetchGroups();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl lg:text-3xl font-display font-bold tracking-tight">
              My Chamas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Save together, grow together. Manage your savings groups in one place.
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/dashboard/chama/explore">
              <Button variant="outline" size="sm" className="gap-2 h-10 rounded-xl">
                <Globe size={15} /> Explore
              </Button>
            </Link>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 h-10 rounded-xl shadow-sm">
                  <Plus size={15} /> New Chama
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create New Chama Group</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Group Name *</Label>
                    <Input
                      value={newGroup.name}
                      onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Umoja Savings Group"
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={newGroup.description}
                      onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Brief description of your group's purpose..."
                      maxLength={500}
                      rows={3}
                    />
                  </div>
                  <Button
                    onClick={handleCreateGroup}
                    disabled={creating || !newGroup.name.trim()}
                    className="w-full"
                  >
                    {creating ? 'Creating...' : 'Create Group'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    You will be assigned as the Chairperson. Configure settings after creation.
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="grid sm:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-44 rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <Card className="p-10 lg:p-14 text-center rounded-2xl border-dashed">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users size={28} className="text-primary" />
            </div>
            <h3 className="font-display font-bold text-xl mb-1.5">Start your first Chama</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Pool money with people you trust. Save, lend, and grow together — fully digital and transparent.
            </p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button onClick={() => setDialogOpen(true)} className="gap-2 rounded-xl">
                <Plus size={16} /> Create Chama
              </Button>
              <Link to="/dashboard/chama/explore">
                <Button variant="outline" className="gap-2 rounded-xl">
                  <Globe size={16} /> Explore Groups
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {groups.map((group, idx) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Link to={`/dashboard/chama/${group.id}`} className="block group h-full">
                  <Card
                    className="relative h-full overflow-hidden rounded-2xl border border-border/60 p-5
                               transition-all duration-200 hover:border-accent/40 hover:shadow-lg
                               hover:-translate-y-0.5 cursor-pointer"
                  >
                    {/* gold accent bar */}
                    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-accent/40 via-accent to-accent/40 opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="flex items-start gap-3">
                      {group.profile_image_url ? (
                        <img
                          src={group.profile_image_url}
                          alt={group.name}
                          className="w-12 h-12 rounded-xl object-cover ring-1 ring-border"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center text-primary font-display font-bold">
                          {initials(group.name)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-display font-bold text-base leading-tight truncate">
                            {group.name}
                          </h3>
                          <ArrowUpRight
                            size={16}
                            className="text-muted-foreground group-hover:text-accent transition-colors shrink-0 mt-0.5"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border inline-flex items-center gap-1 ${roleStyles[group.my_role]}`}
                          >
                            {group.my_role === 'chairperson' && <Crown size={10} />}
                            {group.my_role === 'treasurer' && <ShieldCheck size={10} />}
                            {roleLabels[group.my_role]}
                          </span>
                          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                            <Users size={11} /> {group.member_count}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <MiniStat
                        label="My savings"
                        value={KES(group.my_savings)}
                        icon={<Wallet size={12} />}
                        tone="accent"
                      />
                      <MiniStat
                        label="Group pool"
                        value={KES(group.group_pool)}
                        icon={<TrendingUp size={12} />}
                        tone="emerald"
                      />
                    </div>

                    {/* Footer meta */}
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Coins size={12} className="text-accent" />
                        {group.contribution_amount > 0
                          ? `${KES(group.contribution_amount)} / ${group.contribution_frequency}`
                          : 'Open contribution'}
                      </span>
                      {group.meeting_day && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar size={12} /> {group.meeting_day}
                        </span>
                      )}
                    </div>
                  </Card>
                </Link>
              </motion.div>
            ))}

            {/* "Add another" tile if under limit */}
            {groups.length < 3 && (
              <button
                type="button"
                onClick={() => setDialogOpen(true)}
                className="rounded-2xl border-2 border-dashed border-border/70 hover:border-accent/50
                           hover:bg-accent/5 transition-colors min-h-[180px] flex flex-col items-center
                           justify-center gap-2 text-muted-foreground hover:text-accent"
              >
                <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center">
                  <Plus size={20} />
                </div>
                <span className="text-sm font-semibold">Create another Chama</span>
                <span className="text-[11px]">{3 - groups.length} slot{3 - groups.length === 1 ? '' : 's'} left</span>
              </button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Stat({
  label, value, icon, highlight,
}: { label: string; value: string; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-primary-foreground/70">
        {icon} {label}
      </div>
      <div className={`mt-1 font-display font-bold leading-tight ${highlight ? 'text-accent text-xl lg:text-2xl' : 'text-lg lg:text-xl text-primary-foreground'}`}>
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  label, value, icon, tone,
}: { label: string; value: string; icon: React.ReactNode; tone: 'accent' | 'emerald' }) {
  const toneClass =
    tone === 'accent'
      ? 'bg-accent/8 text-accent'
      : 'bg-emerald-500/8 text-emerald-600 dark:text-emerald-400';
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5 border border-border/40">
      <div className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${toneClass}`}>
        {icon} {label}
      </div>
      <div className="mt-1 font-display font-bold text-sm">{value}</div>
    </div>
  );
}
