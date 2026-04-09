'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, CreditCard, Calendar, Shield, BadgeCheck, Edit3, 
  AlertCircle, Lock, Download, Fingerprint, Smartphone, ShieldCheck, Key, 
  ChevronRight, UserCheck, Loader2, History, Eye, X, FileText, Monitor, Globe, LogOut,
  Camera, ShieldAlert, Wallet, PiggyBank, Landmark, Users, Send, ArrowUpRight, CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EditProfileForm } from '@/components/EditProfileForm';
import { DocumentUpload } from '@/components/DocumentUpload';
import { toast } from 'sonner';

export default function MyAccountPage() {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
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
  const membershipId = profile?.id ? `NYOTA-${profile.id.slice(0, 8).toUpperCase()}` : 'NYOTA-PENDING';
  const initials = displayName?.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  useEffect(() => {
    if (!user) return;
    const fetchAccountData = async () => {
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
    };
    fetchAccountData();
  }, [user]);

  // Detect current device from browser user agent
  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    let name = 'Unknown Device';
    if (/Android/i.test(ua)) {
      const match = ua.match(/;\s*([^;)]+)\s*Build/);
      name = match ? match[1].trim() : 'Android Device';
    } else if (/iPhone/i.test(ua)) {
      name = 'iPhone';
    } else if (/iPad/i.test(ua)) {
      name = 'iPad';
    } else if (/Windows/i.test(ua)) {
      name = 'Windows PC';
    } else if (/Mac/i.test(ua)) {
      name = 'Mac';
    } else if (/Linux/i.test(ua)) {
      name = 'Linux PC';
    }
    // Append browser
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) name += ' — Chrome';
    else if (/Firefox/i.test(ua)) name += ' — Firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) name += ' — Safari';
    else if (/Edg/i.test(ua)) name += ' — Edge';
    return name;
  };

  const [activeDevices] = useState([
    { id: 1, name: getDeviceInfo(), location: 'Current Session', ip: '—', current: true, icon: /Mobi|Android/i.test(navigator.userAgent) ? Smartphone : Monitor },
  ]);

  // DATABASE SYNC: Update Password
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Database credentials updated successfully.");
      setShowPassModal(false);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.message || "Failed to sync password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // DATABASE SYNC: Revoke Other Sessions
  const handleLogoutOtherDevices = async (deviceId: number) => {
    setIsRevoking(deviceId);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast.success("Other sessions have been revoked.");
    } catch (error: any) {
      toast.error("Failed to revoke session.");
    } finally {
      setIsRevoking(null);
    }
  };

  const infoSections = [
    {
      title: 'Identity Profile',
      icon: User,
      fields: [
        { label: 'Full Legal Name', value: profile?.full_name, icon: User },
        { label: 'National ID', value: profile?.id_number, icon: CreditCard },
        { label: 'Date of Birth', value: profile?.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('en-KE') : '—', icon: Calendar },
      ],
    },
    {
      title: 'Residential Details',
      icon: MapPin,
      fields: [
        { label: 'County', value: profile?.county, icon: MapPin },
        { label: 'Sub-County', value: profile?.sub_county, icon: MapPin },
        { label: 'Ward', value: profile?.ward, icon: MapPin },
        { label: 'Physical Address', value: profile?.address, icon: MapPin },
      ],
    },
  ];

  return (
    <DashboardLayout>
      <div className="p-4 lg:p-8 space-y-6 lg:space-y-8 w-full animate-in fade-in duration-500">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-foreground tracking-tight">Account Settings</h1>
            <p className="text-xs lg:text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <ShieldCheck size={14} className="text-primary" />
              Secure Fintech Environment
            </p>
          </motion.div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none h-9 text-xs">
              <History size={14} className="mr-2 hidden xs:block" /> Activity Log
            </Button>
            <Button variant="gold" size="sm" className="flex-1 sm:flex-none h-9 text-xs shadow-gold-sm">
              <Download size={14} className="mr-2 hidden xs:block" /> Export KYC
            </Button>
          </div>
        </div>

        {isEditing ? (
          <EditProfileForm onComplete={() => { setIsEditing(false); refreshProfile(); }} onCancel={() => setIsEditing(false)} />
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 lg:gap-8">
            
            {/* SIDEBAR: Profile & Devices */}
            <div className="xl:col-span-1 space-y-6">
              <Card className="border-border/50 overflow-hidden shadow-sm">
                <div className="h-20 bg-primary/10 relative" />
                <CardContent className="relative px-6 pb-6 text-center">
                  <div className="group relative w-20 h-20 mx-auto -mt-10 mb-3">
                    <div className="w-full h-full rounded-2xl bg-accent flex items-center justify-center text-accent-foreground font-bold text-2xl shadow-lg border-4 border-card">
                      {initials}
                    </div>
                    <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <Camera size={20} className="text-white" />
                    </div>
                  </div>
                  <h2 className="font-display text-lg font-bold truncate">{displayName}</h2>
                  <p className="text-xs text-muted-foreground mb-4 truncate">{displayEmail}</p>
                  <Button variant="outline" size="sm" className="w-full text-[11px] h-8" onClick={() => setIsEditing(true)}>
                    <Edit3 size={12} className="mr-1.5" /> Edit Profile
                  </Button>
                </CardContent>
                <div className="px-6 py-3 bg-muted/20 border-t border-border/50 flex justify-between items-center text-[10px] font-bold">
                   <span className="text-muted-foreground tracking-wider">MEMBER ID</span>
                   <span className="text-primary font-mono">{membershipId}</span>
                </div>
              </Card>

              {/* LOGGED IN DEVICES */}
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 bg-muted/10 border-b border-border/5">
                  <CardTitle className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <Smartphone size={12} className="text-primary" /> Active Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/5">
                  {activeDevices.map((device) => (
                    <div key={device.id} className="p-4 flex flex-col gap-2 hover:bg-muted/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <device.icon size={14} className={device.current ? "text-primary" : "text-muted-foreground"} />
                          <span className="text-xs font-bold">{device.name}</span>
                        </div>
                        {device.current && <span className="text-[9px] bg-success/10 text-success px-2 py-0.5 rounded-full font-bold">Online</span>}
                      </div>
                      <div className="flex flex-col text-[10px] text-muted-foreground ml-6 space-y-0.5">
                        <span className="flex items-center gap-1 font-mono"><Globe size={10} /> {device.ip}</span>
                        <span>{device.location}</span>
                      </div>
                      {!device.current && (
                        <button 
                          onClick={() => handleLogoutOtherDevices(device.id)}
                          disabled={isRevoking === device.id}
                          className="text-[10px] text-destructive font-bold mt-1 ml-6 flex items-center gap-1 hover:underline disabled:opacity-50"
                        >
                          {isRevoking === device.id ? <Loader2 size={10} className="animate-spin" /> : <LogOut size={10} />}
                          End Session
                        </button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="xl:col-span-3 space-y-6">
              
              {/* INFORMATION CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                {infoSections.map((section, si) => (
                  <Card key={si} className="border-border/50 shadow-sm">
                    <CardHeader className="py-3 px-6 border-b border-border/5 bg-muted/5 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        <section.icon size={16} className="text-primary" />
                        <CardTitle className="text-sm font-bold">{section.title}</CardTitle>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-primary/10 group" onClick={() => setShowDocViewer(true)}>
                        <Eye size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="grid grid-cols-1 divide-y divide-border/5">
                        {section.fields.map((field, fi) => (
                          <div key={fi} className="px-6 py-4 flex flex-col gap-1 hover:bg-muted/5 transition-colors">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground/70">{field.label}</span>
                            <span className="text-sm font-semibold truncate">{field.value || '—'}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* SECURITY ACTIONS */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="py-4 border-b border-border/5 bg-muted/5">
                  <div className="flex items-center gap-2 text-primary">
                    <ShieldAlert size={16} />
                    <CardTitle className="text-sm font-bold uppercase tracking-wider">Access & Privacy</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
                    <Button variant="outline" className="w-full justify-between text-xs h-16 px-4 border-border/50 group hover:border-accent/50" onClick={() => setShowPassModal(true)}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-colors">
                          <Key size={18} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">Update Password</p>
                          <p className="text-[10px] text-muted-foreground">Modify login credentials</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground opacity-50 group-hover:opacity-100" />
                    </Button>

                    <Button variant="outline" className="w-full justify-between text-xs h-16 px-4 border-border/50 group hover:border-primary/50" onClick={() => setShowDocViewer(true)}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                          <Eye size={18} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">KYC Documents</p>
                          <p className="text-[10px] text-muted-foreground">View verified uploads</p>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-muted-foreground opacity-50 group-hover:opacity-100" />
                    </Button>
                </CardContent>
              </Card>

              {/* DOCUMENT UPLOAD AREA */}
              <DocumentUpload />
            </div>
          </div>
        )}

        {/* MODAL: PASSWORD UPDATE */}
        <AnimatePresence>
          {showPassModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="w-full max-w-md">
                <Card className="shadow-2xl border-border">
                  <CardHeader className="border-b pb-4 flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Security Sync</CardTitle>
                      <CardDescription className="text-xs">Enter your new database password</CardDescription>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setShowPassModal(false)} className="rounded-full"><X size={18}/></Button>
                  </CardHeader>
                  <form onSubmit={handlePasswordUpdate}>
                    <CardContent className="pt-6 space-y-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">New Password</label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-2.5 text-muted-foreground" size={16} />
                          <input 
                            type="password" 
                            required 
                            placeholder="Min. 6 characters"
                            className="w-full bg-muted/50 border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                          />
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

        {/* MODAL: DOCUMENT PREVIEW */}
        <AnimatePresence>
          {showDocViewer && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} className="w-full max-w-3xl aspect-[4/3] bg-card rounded-2xl overflow-hidden flex flex-col shadow-2xl border border-white/10">
                <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <FileText size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">KYC_Verification_Record.pdf</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Secured by Nyota Foundation</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowDocViewer(false)} className="rounded-full hover:bg-muted"><X size={20}/></Button>
                </div>
                <div className="flex-1 bg-muted/10 flex items-center justify-center p-8 relative overflow-hidden">
                   {/* Decorative background for the empty viewer */}
                  <div className="absolute inset-0 opacity-5 pattern-grid-lg" />
                  <div className="text-center space-y-4 relative z-10">
                    <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto shadow-inner">
                      <ShieldCheck size={48} className="text-primary" />
                    </div>
                    <div className="max-w-xs mx-auto">
                      <p className="text-foreground font-bold">Document Fully Encrypted</p>
                      <p className="text-muted-foreground text-xs mt-1">This record is synchronized with our secure database and is only visible to you.</p>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button variant="outline" size="sm" className="h-9 text-xs">
                        <Download size={14} className="mr-2" /> Download
                      </Button>
                    </div>
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
