import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Bell,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Trash2,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Moon,
  Sun,
  Globe,
  Volume2,
  Play,
  Fingerprint,
} from 'lucide-react';
import { getSelectedSound, setSelectedSound, playNotificationSound, SOUND_LABELS, type NotificationSoundType } from '@/lib/notification-sound';
import { isWebAuthnSupported, hasSavedCredential, registerFingerprint, removeFingerprint } from '@/lib/webauthn';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export default function SettingsPage() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [smsNotifications, setSmsNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loanUpdates, setLoanUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [selectedNotifSound, setSelectedNotifSound] = useState<NotificationSoundType>(getSelectedSound());
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);
  const [fingerprintSupported, setFingerprintSupported] = useState(false);
  const [registeringFingerprint, setRegisteringFingerprint] = useState(false);

  useEffect(() => {
    setFingerprintSupported(isWebAuthnSupported());
    setFingerprintEnabled(hasSavedCredential());
  }, []);
  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const settingsSections = [
    {
      title: 'Notifications',
      description: 'Manage how you receive updates and alerts',
      icon: Bell,
      items: [
        { label: 'SMS Notifications', description: 'Receive updates via text message', checked: smsNotifications, onChange: setSmsNotifications },
        { label: 'Email Notifications', description: 'Get email alerts for important updates', checked: emailNotifications, onChange: setEmailNotifications },
        { label: 'Loan Status Updates', description: 'Alerts when your loan status changes', checked: loanUpdates, onChange: setLoanUpdates },
        { label: 'Promotions & Offers', description: 'Special offers and new product announcements', checked: promotions, onChange: setPromotions },
      ],
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-5 lg:p-8 space-y-6 max-w-[900px]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your preferences and account security</p>
        </motion.div>

        {/* Security */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-primary" />
                <div>
                  <CardTitle className="text-base">Security</CardTitle>
                  <CardDescription>Protect your account with strong credentials</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Lock size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Password</p>
                    <p className="text-xs text-muted-foreground">Last changed: Unknown</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChangePassword(!showChangePassword)}
                >
                  {showChangePassword ? 'Cancel' : 'Change'}
                </Button>
              </div>

              {showChangePassword && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3 pt-2 pb-1"
                >
                  <div className="space-y-2">
                    <Label className="text-xs">New Password</Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Confirm New Password</Label>
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={handleChangePassword}
                    loading={changingPassword}
                    disabled={!newPassword || !confirmPassword}
                  >
                    Update Password
                  </Button>
                </motion.div>
              )}

              <Separator />

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Smartphone size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Phone Number</p>
                    <p className="text-xs text-muted-foreground">{profile?.phone || 'Not set'}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Verified</span>
              </div>

              <Separator />

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Globe size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Email Address</p>
                    <p className="text-xs text-muted-foreground">{profile?.email || user?.email || 'Not set'}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-full">Primary</span>
              </div>
              {/* Fingerprint */}
              {fingerprintSupported && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                        <Fingerprint size={16} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Fingerprint Login</p>
                        <p className="text-xs text-muted-foreground">
                          {fingerprintEnabled ? 'Enabled — use fingerprint to sign in' : 'Use biometrics to quickly sign in'}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={fingerprintEnabled ? 'outline' : 'gold'}
                      size="sm"
                      disabled={registeringFingerprint}
                      onClick={async () => {
                        if (fingerprintEnabled) {
                          removeFingerprint();
                          setFingerprintEnabled(false);
                          toast.success('Fingerprint removed');
                        } else {
                          if (!user || !profile?.email) return;
                          const pwd = window.prompt('Enter your password to enable fingerprint login:');
                          if (!pwd) return;
                          // Verify password first
                          const { error } = await supabase.auth.signInWithPassword({ email: profile.email, password: pwd });
                          if (error) {
                            toast.error('Incorrect password');
                            return;
                          }
                          setRegisteringFingerprint(true);
                          const ok = await registerFingerprint(user.id, profile.email, pwd);
                          setRegisteringFingerprint(false);
                          if (ok) {
                            setFingerprintEnabled(true);
                            toast.success('Fingerprint registered! You can now sign in with fingerprint.');
                          } else {
                            toast.error('Failed to register fingerprint');
                          }
                        }
                      }}
                    >
                      {registeringFingerprint ? 'Registering...' : fingerprintEnabled ? 'Remove' : 'Enable'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Notifications */}
        {settingsSections.map((section, si) => (
          <motion.div
            key={si}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + si * 0.05 }}
          >
            <Card className="border-border/50">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <section.icon size={18} className="text-primary" />
                  <div>
                    <CardTitle className="text-base">{section.title}</CardTitle>
                    <CardDescription>{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {section.items.map((item, i) => (
                    <div key={i}>
                      {i > 0 && <Separator className="my-0" />}
                      <div className="flex items-center justify-between py-3.5">
                        <div>
                          <p className="text-sm font-medium">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        </div>
                        <Switch
                          checked={item.checked}
                          onCheckedChange={item.onChange}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}

        {/* Notification Sound */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <Volume2 size={18} className="text-primary" />
                <div>
                  <CardTitle className="text-base">Notification Sound</CardTitle>
                  <CardDescription>Choose the sound for all notifications</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {(Object.keys(SOUND_LABELS) as NotificationSoundType[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedNotifSound(key);
                      setSelectedSound(key);
                      playNotificationSound(key);
                    }}
                    className={`w-full flex items-center justify-between py-3 px-3 rounded-lg transition-colors ${
                      selectedNotifSound === key
                        ? 'bg-primary/10 border border-primary/30'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    <span className="text-sm font-medium">{SOUND_LABELS[key]}</span>
                    <div className="flex items-center gap-2">
                      {selectedNotifSound === key && (
                        <span className="text-xs text-primary font-medium">Active</span>
                      )}
                      <Play size={14} className="text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>


        {/* Support & Help */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-border/50">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-primary" />
                <div>
                  <CardTitle className="text-base">Help & Support</CardTitle>
                  <CardDescription>Get assistance and learn more</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {[
                { label: 'Contact Support', description: 'Reach out to our team for help', path: '/contact' },
                { label: 'Terms of Service', description: 'Read our terms and conditions', path: '/terms' },
                { label: 'About Nyota Foundation', description: 'Learn about our mission', path: '/about' },
              ].map((item, i) => (
                <div key={i}>
                  {i > 0 && <Separator className="my-0" />}
                  <button
                    onClick={() => navigate(item.path)}
                    className="w-full flex items-center justify-between py-3.5 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground" />
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Danger Zone */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-destructive/20">
            <CardHeader className="pb-4">
              <CardTitle className="text-base text-destructive">Account Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full justify-start gap-3 border-border"
                onClick={handleSignOut}
              >
                <LogOut size={16} />
                Sign Out of Account
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
