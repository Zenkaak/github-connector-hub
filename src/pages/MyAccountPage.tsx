'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, CreditCard, Calendar, BadgeCheck, Edit3,
  AlertCircle, Lock, Download, Smartphone, ShieldCheck, Key,
  ChevronRight, Loader2, Eye, X, FileText, Monitor, Globe, LogOut,
  Camera, Wallet, PiggyBank, Landmark, Users, Send, ArrowUpRight, CheckCircle2,
  Zap, HeartHandshake, Copy, Sparkles, ArrowLeft, Settings2, ShieldCheck as ShieldIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EditProfileForm } from '@/components/EditProfileForm';
import { DocumentUpload } from '@/components/DocumentUpload';
import { toast } from 'sonner';

type TabKey = 'overview' | 'profile' | 'security' | 'documents';

export default function MyAccountPage() {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isRevoking, setIsRevoking] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [savingsCount, setSavingsCount] = useState(0);
  const [chamaCount, setChamaCount] = useState(0);
  const [docsCount, setDocsCount] = useState(0);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'Valued Member';
  const displayEmail = profile?.email || user?.email;
  const membershipId = profile?.id ? `DASNET-${profile.id.slice(0, 8).toUpperCase()}` : 'DASNET-PENDING';
  const initials = displayName?.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [walletRes, savingsRes, chamaRes, docsRes] = await Promise.all([
        supabase.from('wallets').select('balance').eq('user_id', user.id).maybeSingle(),
        supabase.from('personal_savings').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'active'),
        supabase.from('chama_members').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
        supabase.from('user_documents').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);
      setWalletBalance(walletRes.data?.balance || 0);
      setSavingsCount(savingsRes.count || 0);
      setChamaCount(chamaRes.count || 0);
      setDocsCount(docsRes.count || 0);
    })();
  }, [user]);

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let name = 'Unknown Device';
    if (/Android/i.test(ua)) {
      const match = ua.match(/;\s*([^;)]+)\s*Build/);
      name = match ? match[1].trim() : 'Android Device';
    } else if (/iPhone/i.test(ua)) name = 'iPhone';
    else if (/iPad/i.test(ua)) name = 'iPad';
    else if (/Windows/i.test(ua)) name = 'Windows PC';
    else if (/Mac/i.test(ua)) name = 'Mac';
    else if (/Linux/i.test(ua)) name = 'Linux PC';
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) name += ' · Chrome';
    else if (/Firefox/i.test(ua)) name += ' · Firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) name += ' · Safari';
    else if (/Edg/i.test(ua)) name += ' · Edge';
    return name;
  };

  const [activeDevices] = useState([
    { id: 1, name: getDeviceInfo(), location: 'Current Session', ip: '—', current: true, icon: /Mobi|Android/i.test(navigator.userAgent) ? Smartphone : Monitor },
  ]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters.'); return; }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully.');
      setShowPassModal(false); setNewPassword('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password.');
    } finally { setIsUpdatingPassword(false); }
  };

  const handleLogoutOtherDevices = async (deviceId: number) => {
    setIsRevoking(deviceId);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast.success('Other sessions have been revoked.');
    } catch { toast.error('Failed to revoke session.'); }
    finally { setIsRevoking(null); }
  };

  const verificationSteps = useMemo(() => ([
    { label: 'Profile Completed', done: !!(profile?.full_name && profile?.phone && profile?.id_number) },
    { label: 'National ID Uploaded', done: docsCount > 0 },
    { label: 'Email Verified', done: !!user?.email_confirmed_at },
    { label: 'Admin Approved', done: !!profile?.is_verified },
  ]), [profile, docsCount, user]);

  const completed = verificationSteps.filter(s => s.done).length;
  const totalSteps = verificationSteps.length;
  const completionPct = Math.round((completed / totalSteps) * 100);
  const ringCirc = 2 * Math.PI * 26;
  const ringOffset = ringCirc - (completionPct / 100) * ringCirc;

  const stats = [
    { icon: Wallet, label: 'Wallet', value: `KES ${walletBalance.toLocaleString()}`, accent: 'from-emerald-500/20 to-emerald-500/0', text: 'text-emerald-400', onClick: () => navigate('/dashboard/wallet') },
    { icon: PiggyBank, label: 'Savings', value: `${savingsCount}`, accent: 'from-accent/20 to-accent/0', text: 'text-accent', onClick: () => navigate('/dashboard/savings') },
    { icon: Users, label: 'Chamas', value: `${chamaCount}`, accent: 'from-primary/20 to-primary/0', text: 'text-primary', onClick: () => navigate('/dashboard/chama') },
    { icon: FileText, label: 'KYC Docs', value: `${docsCount}`, accent: 'from-amber-500/20 to-amber-500/0', text: 'text-amber-400', onClick: () => setTab('documents') },
  ];

  const quickActions = [
    { icon: ArrowUpRight, label: 'Deposit', onClick: () => navigate('/dashboard/wallet') },
    { icon: Send, label: 'Transfer', onClick: () => navigate('/dashboard/wallet') },
    { icon: Landmark, label: 'Loan', onClick: () => navigate('/dashboard/apply') },
    { icon: HeartHandshake, label: 'Harambee', onClick: () => navigate('/dashboard/create-fundraiser') },
  ];

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'overview', label: 'Overview', icon: Sparkles },
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'security', label: 'Security', icon: ShieldIcon },
    { key: 'documents', label: 'Docs', icon: FileText },
  ];

  const copyId = () => { navigator.clipboard.writeText(membershipId); toast.success('Member ID copied'); };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        {/* HERO */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/5 to-transparent" />
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-accent/10 blur-3xl" />
          <div className="absolute -bottom-32 -left-16 w-72 h-72 rounded-full bg-primary/15 blur-3xl" />

          <div className="relative px-4 pt-5 pb-8 lg:px-8 lg:pt-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-5">
              <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-card/60 backdrop-blur-md border border-border/40 flex items-center justify-center hover:bg-card transition">
                <ArrowLeft size={16} />
              </button>
              <p className="text-[11px] uppercase tracking-[0.2em] font-bold text-muted-foreground">My Account</p>
              <button onClick={() => setIsEditing(true)} className="w-9 h-9 rounded-full bg-card/60 backdrop-blur-md border border-border/40 flex items-center justify-center hover:bg-card transition">
                <Settings2 size={16} />
              </button>
            </div>

            {/* Identity card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent to-primary flex items-center justify-center text-white font-bold text-2xl shadow-xl shadow-primary/20 border border-white/10">
                  {initials}
                </div>
                <button className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-card border-2 border-background flex items-center justify-center shadow-lg">
                  <Camera size={12} className="text-foreground" />
                </button>
                {profile?.is_verified && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                    <BadgeCheck size={12} className="text-white" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-display text-xl lg:text-2xl font-bold truncate">{displayName}</h1>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
                  <Mail size={11} /> {displayEmail}
                </p>
                <button onClick={copyId} className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-mono font-bold bg-primary/10 text-primary px-2 py-1 rounded-md hover:bg-primary/20 transition">
                  {membershipId} <Copy size={10} />
                </button>
              </div>
            </motion.div>

            {/* Verification progress strip */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="mt-5 rounded-2xl bg-card/70 backdrop-blur-md border border-border/40 p-4 flex items-center gap-4 shadow-lg">
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 64 64" className="w-full h-full -rotate-90">
                  <circle cx="32" cy="32" r="26" stroke="hsl(var(--muted))" strokeWidth="6" fill="none" opacity="0.3" />
                  <circle cx="32" cy="32" r="26" stroke="hsl(var(--primary))" strokeWidth="6" fill="none"
                    strokeDasharray={ringCirc} strokeDashoffset={ringOffset} strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold">{completionPct}%</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Account Verification</p>
                <p className="text-sm font-semibold mt-0.5">{completed} of {totalSteps} steps complete</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {profile?.is_verified ? 'Your account is fully verified ✓' : 'Complete KYC to unlock all features'}
                </p>
              </div>
            </motion.div>
          </div>
        </div>

        {/* TABS */}
        <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/40">
          <div className="max-w-5xl mx-auto px-2 lg:px-8">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
              {tabs.map(t => {
                const active = tab === t.key;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`relative px-4 py-3 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition-colors ${active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                    <t.icon size={13} /> {t.label}
                    {active && <motion.div layoutId="acct-tab" className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div className="max-w-5xl mx-auto px-4 lg:px-8 py-5 pb-24 space-y-5">
          {isEditing ? (
            <EditProfileForm onComplete={() => { setIsEditing(false); refreshProfile(); }} onCancel={() => setIsEditing(false)} />
          ) : (
            <AnimatePresence mode="wait">
              {tab === 'overview' && (
                <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                  {/* Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {stats.map((s, i) => (
                      <button key={i} onClick={s.onClick}
                        className="relative overflow-hidden text-left rounded-2xl border border-border/40 bg-card p-4 hover:border-primary/40 hover:shadow-lg transition-all">
                        <div className={`absolute inset-0 bg-gradient-to-br ${s.accent} opacity-60 pointer-events-none`} />
                        <div className="relative">
                          <s.icon size={18} className={s.text} />
                          <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mt-3">{s.label}</p>
                          <p className={`text-base font-bold mt-0.5 ${s.text} truncate`}>{s.value}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Quick actions */}
                  <Card className="border-border/40 overflow-hidden">
                    <CardHeader className="py-3 px-4 border-b border-border/30 bg-muted/10 flex flex-row items-center gap-2">
                      <Zap size={13} className="text-accent" />
                      <CardTitle className="text-[11px] font-bold uppercase tracking-widest">Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 grid grid-cols-4 gap-2">
                      {quickActions.map((a, i) => (
                        <button key={i} onClick={a.onClick}
                          className="flex flex-col items-center gap-2 py-3 rounded-xl hover:bg-muted/40 transition group">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15 flex items-center justify-center group-hover:scale-105 transition">
                            <a.icon size={18} className="text-primary" />
                          </div>
                          <span className="text-[10px] font-bold">{a.label}</span>
                        </button>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Verification details */}
                  <Card className="border-border/40">
                    <CardHeader className="py-3 px-4 border-b border-border/30 bg-muted/10 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BadgeCheck size={13} className="text-primary" />
                        <CardTitle className="text-[11px] font-bold uppercase tracking-widest">Verification</CardTitle>
                      </div>
                      <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${profile?.is_verified ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                        {profile?.is_verified ? 'Verified' : 'Pending'}
                      </span>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      {verificationSteps.map((step, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/20">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-emerald-500/20' : 'bg-muted/40'}`}>
                            {step.done ? <CheckCircle2 size={14} className="text-emerald-400" /> : <AlertCircle size={14} className="text-muted-foreground/60" />}
                          </div>
                          <span className={`text-xs font-semibold flex-1 ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>{step.label}</span>
                          {!step.done && <ChevronRight size={14} className="text-muted-foreground/50" />}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {tab === 'profile' && (
                <motion.div key="profile" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                  <Card className="border-border/40">
                    <CardHeader className="py-3 px-4 border-b border-border/30 bg-muted/10 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User size={13} className="text-primary" />
                        <CardTitle className="text-[11px] font-bold uppercase tracking-widest">Personal Info</CardTitle>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setIsEditing(true)}>
                        <Edit3 size={10} className="mr-1" /> Edit
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-border/20">
                      {[
                        { icon: User, label: 'Full Legal Name', value: profile?.full_name },
                        { icon: CreditCard, label: 'National ID', value: profile?.id_number },
                        { icon: Calendar, label: 'Date of Birth', value: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-KE') : null },
                        { icon: Mail, label: 'Email', value: displayEmail },
                        { icon: Phone, label: 'Phone Number', value: profile?.phone },
                      ].map((f, i) => (
                        <div key={i} className="px-4 py-3.5 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                            <f.icon size={14} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">{f.label}</p>
                            <p className="text-sm font-semibold truncate">{f.value || '—'}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="border-border/40">
                    <CardHeader className="py-3 px-4 border-b border-border/30 bg-muted/10 flex flex-row items-center gap-2">
                      <MapPin size={13} className="text-primary" />
                      <CardTitle className="text-[11px] font-bold uppercase tracking-widest">Residential</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-border/20">
                      {[
                        { label: 'County', value: profile?.county },
                        { label: 'Sub-County', value: profile?.sub_county },
                        { label: 'Ward', value: profile?.ward },
                        { label: 'Physical Address', value: profile?.address },
                      ].map((f, i) => (
                        <div key={i} className="px-4 py-3 flex flex-col">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-wider">{f.label}</span>
                          <span className="text-sm font-semibold mt-0.5 truncate">{f.value || '—'}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {tab === 'security' && (
                <motion.div key="security" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                  <Card className="border-border/40">
                    <CardHeader className="py-3 px-4 border-b border-border/30 bg-muted/10 flex flex-row items-center gap-2">
                      <ShieldCheck size={13} className="text-primary" />
                      <CardTitle className="text-[11px] font-bold uppercase tracking-widest">Access & Privacy</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2">
                      <button onClick={() => setShowPassModal(true)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/30 transition group">
                        <div className="w-10 h-10 rounded-xl bg-accent/15 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                          <Key size={16} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-bold">Update Password</p>
                          <p className="text-[10px] text-muted-foreground">Change your login credentials</p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground/50" />
                      </button>

                      <button onClick={() => navigate('/dashboard/pin')}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/30 transition group">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Lock size={16} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-sm font-bold">Transaction PIN</p>
                          <p className="text-[10px] text-muted-foreground">Manage your 4-digit PIN</p>
                        </div>
                        <ChevronRight size={16} className="text-muted-foreground/50" />
                      </button>
                    </CardContent>
                  </Card>

                  <Card className="border-border/40">
                    <CardHeader className="py-3 px-4 border-b border-border/30 bg-muted/10 flex flex-row items-center gap-2">
                      <Smartphone size={13} className="text-primary" />
                      <CardTitle className="text-[11px] font-bold uppercase tracking-widest">Active Sessions</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 divide-y divide-border/20">
                      {activeDevices.map((device) => (
                        <div key={device.id} className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <device.icon size={16} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold truncate">{device.name}</p>
                                {device.current && <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">LIVE</span>}
                              </div>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5"><Globe size={10} /> {device.location}</p>
                            </div>
                            {!device.current && (
                              <button onClick={() => handleLogoutOtherDevices(device.id)} disabled={isRevoking === device.id}
                                className="text-[10px] text-destructive font-bold flex items-center gap-1 hover:underline disabled:opacity-50">
                                {isRevoking === device.id ? <Loader2 size={10} className="animate-spin" /> : <LogOut size={10} />} End
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {tab === 'documents' && (
                <motion.div key="docs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
                  <Card className="border-border/40">
                    <CardHeader className="py-3 px-4 border-b border-border/30 bg-muted/10 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText size={13} className="text-primary" />
                        <CardTitle className="text-[11px] font-bold uppercase tracking-widest">KYC Documents</CardTitle>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setShowDocViewer(true)}>
                        <Eye size={10} className="mr-1" /> Preview
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4">
                      <DocumentUpload />
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {/* MODAL: PASSWORD UPDATE */}
        <AnimatePresence>
          {showPassModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md">
                <Card className="shadow-2xl border-border">
                  <CardHeader className="border-b pb-4 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Update Password</CardTitle>
                      <CardDescription className="text-xs">Choose a new secure password</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setShowPassModal(false)} className="rounded-full"><X size={18} /></Button>
                  </CardHeader>
                  <form onSubmit={handlePasswordUpdate}>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">New Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                          <input type="password" required placeholder="Min. 6 characters"
                            className="w-full bg-muted/50 border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                            value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="gap-3 pt-2">
                      <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowPassModal(false)}>Cancel</Button>
                      <Button type="submit" variant="gold" className="flex-1" disabled={isUpdatingPassword}>
                        {isUpdatingPassword ? <Loader2 className="animate-spin" size={14} /> : 'Update Now'}
                      </Button>
                    </CardFooter>
                  </form>
                </Card>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: DOC PREVIEW */}
        <AnimatePresence>
          {showDocViewer && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="w-full max-w-2xl bg-card rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-border/40">
                <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg"><FileText size={18} className="text-primary" /></div>
                    <div>
                      <p className="text-sm font-bold">KYC Verification Record</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Secured by Dasnet Ventures</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowDocViewer(false)} className="rounded-full"><X size={20} /></Button>
                </div>
                <div className="bg-muted/10 flex items-center justify-center p-10">
                  <div className="text-center space-y-4">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto shadow-inner">
                      <ShieldCheck size={48} className="text-primary" />
                    </div>
                    <div className="max-w-xs mx-auto">
                      <p className="text-foreground font-bold">Documents Encrypted</p>
                      <p className="text-muted-foreground text-xs mt-1">Your records are securely stored and only visible to you and verified admins.</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-9 text-xs">
                      <Download size={14} className="mr-2" /> Download
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
