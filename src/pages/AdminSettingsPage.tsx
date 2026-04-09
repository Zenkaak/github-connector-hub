import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Settings, Save, Loader2, Search, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  label: string;
  category: string;
  description: string | null;
  updated_at: string;
}

const categoryLabels: Record<string, { label: string; icon: string }> = {
  general: { label: 'General', icon: '🏢' },
  fees: { label: 'Fees & Charges', icon: '💰' },
  loans: { label: 'Loan Settings', icon: '📋' },
  wallet: { label: 'Wallet & Transfers', icon: '💳' },
  savings: { label: 'Savings', icon: '🏦' },
  chama: { label: 'Chama Groups', icon: '👥' },
  harambee: { label: 'Harambee / Fundraisers', icon: '❤️' },
  limits: { label: 'Limits & KYC', icon: '🔒' },
  security: { label: 'Security', icon: '🛡️' },
  notifications: { label: 'Notifications', icon: '🔔' },
  system: { label: 'System', icon: '⚙️' },
};

const categoryOrder = ['general', 'fees', 'loans', 'wallet', 'savings', 'chama', 'harambee', 'limits', 'security', 'notifications', 'system'];

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<PlatformSetting[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchSettings();

    // Real-time subscription for settings changes
    const channel = supabase
      .channel('admin-settings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, () => {
        fetchSettings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from('platform_settings' as any)
      .select('*')
      .order('category')
      .order('key');
    if (data) {
      setSettings(data as any as PlatformSetting[]);
      const vals: Record<string, string> = {};
      (data as any[]).forEach((s: any) => { vals[s.key] = s.value; });
      setEditedValues(vals);
    }
    if (error) console.error('Error fetching settings:', error);
    setLoading(false);
  };

  const hasChanges = settings.some(s => editedValues[s.key] !== s.value);

  const handleSave = async () => {
    setSaving(true);
    try {
      const changed = settings.filter(s => editedValues[s.key] !== s.value);
      for (const s of changed) {
        await supabase
          .from('platform_settings' as any)
          .update({ value: editedValues[s.key], updated_at: new Date().toISOString(), updated_by: user?.id } as any)
          .eq('key', s.key);
      }
      await supabase.from('audit_logs').insert({
        admin_id: user?.id,
        action: 'settings_updated',
        details: { changed: changed.map(s => ({ key: s.key, old: s.value, new: editedValues[s.key] })) },
      });
      toast.success(`${changed.length} setting(s) updated`);
      fetchSettings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    const vals: Record<string, string> = {};
    settings.forEach(s => { vals[s.key] = s.value; });
    setEditedValues(vals);
  };

  const isBooleanSetting = (key: string) =>
    key.includes('enabled') || key.includes('_mode') || key.includes('_required') || key === 'chama_auto_payout' || key === 'chama_meeting_reminders' || key === 'chama_roles_enabled' || key === 'loan_auto_disburse' || key === 'loan_collateral_required';

  const filteredSettings = settings.filter(s =>
    !search || s.label.toLowerCase().includes(search.toLowerCase()) || s.key.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase())
  );

  const groupedSettings = categoryOrder
    .map(cat => ({
      category: cat,
      ...categoryLabels[cat],
      items: filteredSettings.filter(s => s.category === cat),
    }))
    .filter(g => g.items.length > 0);

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center min-h-[60vh]">
          <Loader2 className="animate-spin text-accent" size={32} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 lg:p-8 max-w-4xl">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <Settings size={20} className="text-accent" />
              </div>
              <div>
                <h1 className="text-xl font-bold font-display">Platform Settings</h1>
                <p className="text-xs text-muted-foreground">Configure fees, limits, and system behavior</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {hasChanges && (
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw size={14} /> Reset
                </Button>
              )}
              <Button variant="gold" size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save Changes
              </Button>
            </div>
          </div>

          <div className="relative mb-6">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search settings..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
          </div>

          <div className="space-y-6">
            {groupedSettings.map((group) => (
              <Card key={group.category} className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>{group.icon}</span>
                    {group.label}
                    <span className="text-xs text-muted-foreground font-normal ml-auto">{group.items.length} settings</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {group.items.map((setting, i) => (
                    <div key={setting.key}>
                      {i > 0 && <Separator className="mb-4" />}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <Label className="text-sm font-medium">{setting.label}</Label>
                          {setting.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{setting.description}</p>
                          )}
                        </div>
                        <div className="w-56 shrink-0">
                          {isBooleanSetting(setting.key) ? (
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-xs text-muted-foreground">
                                {editedValues[setting.key] === 'true' ? 'Enabled' : 'Disabled'}
                              </span>
                              <Switch
                                checked={editedValues[setting.key] === 'true'}
                                onCheckedChange={(checked) =>
                                  setEditedValues(prev => ({ ...prev, [setting.key]: checked ? 'true' : 'false' }))
                                }
                              />
                            </div>
                          ) : (
                            <Input
                              value={editedValues[setting.key] || ''}
                              onChange={(e) =>
                                setEditedValues(prev => ({ ...prev, [setting.key]: e.target.value }))
                              }
                              className={`h-9 text-sm ${editedValues[setting.key] !== setting.value ? 'border-accent ring-1 ring-accent/20' : ''}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>

          {hasChanges && (
            <div className="sticky bottom-20 lg:bottom-4 mt-6">
              <Card className="border-accent/30 bg-accent/5">
                <CardContent className="p-4 flex items-center justify-between">
                  <p className="text-sm font-medium">
                    You have unsaved changes ({settings.filter(s => editedValues[s.key] !== s.value).length} modified)
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleReset}>Discard</Button>
                    <Button variant="gold" size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </div>
    </AdminLayout>
  );
}
