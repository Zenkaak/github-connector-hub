import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users, Crown, ChevronRight, Globe } from 'lucide-react';
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
  member_count?: number;
  my_role?: string;
}

export default function ChamaGroupsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isEnabled } = usePlatformSettings();
  const chamaCreationDisabled = !isEnabled('chama_creation_enabled');
  const [groups, setGroups] = useState<ChamaGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '' });

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
      const { data: groupsData } = await supabase.from('chama_groups').select('*').in('id', groupIds);

      if (groupsData) {
        const enriched = await Promise.all(
          groupsData.map(async (g) => {
            const { count } = await supabase.from('chama_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id).eq('is_active', true);
            const myRole = memberships.find(m => m.group_id === g.id)?.role;
            return { ...g, member_count: count || 0, my_role: myRole };
          })
        );
        setGroups(enriched);
      }
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGroups(); }, [user]);

  const handleCreateGroup = async () => {
    if (!user || !newGroup.name.trim()) return;
    if (chamaCreationDisabled) {
      toast({ title: 'Feature Disabled', description: 'Chama group creation is currently disabled by admin.', variant: 'destructive' });
      return;
    }

    // Check max 3 chama limit
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

  const roleLabels: Record<string, string> = { chairperson: 'Chairperson', secretary: 'Secretary', treasurer: 'Treasurer', member: 'Member' };
  const roleColors: Record<string, string> = { chairperson: 'bg-accent/10 text-accent', secretary: 'bg-blue-500/10 text-blue-500', treasurer: 'bg-emerald-500/10 text-emerald-500', member: 'bg-muted text-muted-foreground' };

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold">Chama Groups</h1>
            <p className="text-sm text-muted-foreground mt-1">Create and manage your savings groups</p>
          </div>
          <div className="flex gap-2">
            <Link to="/dashboard/chama/explore">
              <Button variant="outline" className="gap-2">
                <Globe size={16} /> Explore
              </Button>
            </Link>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus size={16} /> New Group</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create New Chama Group</DialogTitle></DialogHeader>
                <div className="space-y-4 mt-2">
                  <div>
                    <Label>Group Name *</Label>
                    <Input value={newGroup.name} onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))} placeholder="e.g. Umoja Savings Group" maxLength={100} />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea value={newGroup.description} onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))} placeholder="Brief description of your group's purpose..." maxLength={500} rows={3} />
                  </div>
                  <Button onClick={handleCreateGroup} disabled={creating || !newGroup.name.trim()} className="w-full">
                    {creating ? 'Creating...' : 'Create Group'}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">You will be assigned as the Chairperson. Configure settings after creation.</p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : groups.length === 0 ? (
          <Card className="p-12 text-center">
            <Users size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold text-lg mb-1">No Groups Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">Create your first Chama group or explore existing ones</p>
            <div className="flex gap-2 justify-center">
              <Button onClick={() => setDialogOpen(true)} className="gap-2"><Plus size={16} /> Create Group</Button>
              <Link to="/dashboard/chama/explore"><Button variant="outline" className="gap-2"><Globe size={16} /> Explore Groups</Button></Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Link key={group.id} to={`/dashboard/chama/${group.id}`}>
                <Card className="p-4 hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Users size={22} className="text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{group.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${roleColors[group.my_role || 'member']}`}>
                            {group.my_role === 'chairperson' && <Crown size={10} className="inline mr-1" />}
                            {roleLabels[group.my_role || 'member']}
                          </span>
                          <span className="text-xs text-muted-foreground">{group.member_count} members</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
