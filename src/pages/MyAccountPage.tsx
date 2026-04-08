import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, CreditCard, Calendar, Shield, BadgeCheck, Edit3, 
  AlertCircle, Lock, Download, Fingerprint, Smartphone, ShieldCheck, Key, 
  ChevronRight, UserCheck, Loader2, History, Eye, X, FileText, Monitor, Globe, LogOut,
  Camera, ShieldAlert
} from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EditProfileForm } from '@/components/EditProfileForm';
import { DocumentUpload } from '@/components/DocumentUpload';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function MyAccountPage() {
  const { profile, user, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showDocViewer, setShowDocViewer] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isRevoking, setIsRevoking] = useState<number | null>(null);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'Valued Member';
  const displayEmail = profile?.email || user?.email;
  const membershipId = profile?.id ? `NYOTA-${profile.id.slice(0, 8).toUpperCase()}` : 'NYOTA-PENDING';
  const initials = displayName?.split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

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
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) name += ' — Chrome';
    else if (/Firefox/i.test(ua)) name += ' — Firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) name += ' — Safari';
    else if (/Edg/i.test(ua)) name += ' — Edge';
    return name;
  };

  const [activeDevices] = useState([
    { id: 1, name: getDeviceInfo(), location: 'Current Session', ip: '—', current: true, icon: /Mobi|Android/i.test(navigator.userAgent) ? Smartphone : Monitor },
  ]);

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
      <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
        
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-border/40 pb-8">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider mb-3">
              <ShieldCheck size={12} />
              Secure Fintech Environment
            </div>
            <h1 className="font-display text-3xl lg:text-4xl font-bold text-foreground tracking-tight">Account Settings</h1>
            <p className="text-sm text-muted-foreground mt-2">Manage your digital identity and security preferences.</p>
          </motion.div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="h-10 px-4 rounded-xl border-border/60 font-medium">
              <History size={16} className="mr-2 opacity-70" /> Activity Log
            </Button>
            <Button variant="gold" size="sm" className="h-10 px-4 rounded-xl shadow-lg shadow-gold/20 font-semibold transition-all hover:scale-[1.02] active:scale-95">
              <Download size={16} className="mr-2" /> Export KYC
            </Button>
          </div>
        </div>

        {isEditing ? (
          <div className="max-w-4xl mx-auto">
            <EditProfileForm onComplete={() => { setIsEditing(false); refreshProfile(); }} onCancel={() => setIsEditing(false)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
            
            {/* SIDEBAR: Profile & Devices */}
            <div className="xl:col-span-4 space-y-8">
              <Card className="border-border/40 overflow-hidden shadow-xl shadow-black/5 bg-card/50 backdrop-blur-sm">
                <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/5 to-transparent relative" />
                <CardContent className="relative px-6 pb-8 text-center">
                  <div className="group relative w-24 h-24 mx-auto -mt-12 mb-4">
                    <div className="w-full h-full rounded-3xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center text-accent-foreground font-bold text-3xl shadow-2xl border-4 border-card transition-transform group-hover:scale-105 duration-300">
                      {initials}
                    </div>
                    <button className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-xl shadow-lg hover:bg-primary/90 transition-colors">
                      <Camera size={16} />
                    </button>
                  </div>
                  <h2 className="font-display text-xl font-bold text-foreground">{displayName}</h2>
                  <p className="text-sm text-muted-foreground mb-6">{displayEmail}</p>
                  <Button variant="outline" size="sm" className="w-full h-10 rounded-xl border-border/80 bg-background/50 hover:bg-accent hover:text-accent-foreground transition-all" onClick={() => setIsEditing(true)}>
                    <Edit3 size={14} className="mr-2" /> Edit Profile Details
                  </Button>
                </CardContent>
                <div className="px-6 py-4 bg-muted/30 border-t border-border/40 flex justify-between items-center">
                   <span className="text-[10px] text-muted-foreground font-black tracking-widest uppercase">Member ID</span>
                   <span className="text-sm font-mono font-bold text-primary">{membershipId}</span>
                </div>
              </Card>

              {/* LOGGED IN DEVICES */}
              <Card className="border-border/40 shadow-xl shadow-black/5 overflow-hidden">
                <CardHeader className="pb-4 border-b border-border/40 bg-muted/20">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground">
                    <Smartphone size={14} className="text-primary" /> Active Sessions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y divide-border/40">
                  {activeDevices.map((device) => (
                    <div key={device.id} className="p-5 flex flex-col gap-3 hover:bg-muted/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("p-2 rounded-lg", device.current ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                            <device.icon size={18} />
                          </div>
                          <div>
                            <span className="text-sm font-bold block leading-tight">{device.name}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1 font-mono uppercase">
                               <Globe size={10} /> {device.ip}
                            </span>
                          </div>
                        </div>
                        {device.current && (
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-success/10 text-success text-[10px] font-bold border border-success/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                            ACTIVE
                          </div>
                        )}
                      </div>
                      {!device.current && (
                        <button 
                          onClick={() => handleLogoutOtherDevices(device.id)}
                          disabled={isRevoking === device.id}
                          className="text-xs text-destructive font-bold ml-11 flex items-center gap-2 hover:opacity-80 transition-opacity disabled:opacity-50"
                        >
                          {isRevoking === device.id ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                          Revoke Access
                        </button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="xl:col-span-8 space-y-8">
              
              {/* INFORMATION CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {infoSections.map((section, si) => (
                  <Card key={si} className="border-border/40 shadow-lg shadow-black/5">
                    <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/10 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 bg-primary/10 rounded-lg">
                          <section.icon size={16} className="text-primary" />
                        </div>
                        <CardTitle className="text-sm font-bold tracking-tight">{section.title}</CardTitle>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-primary/10" onClick={() => setShowDocViewer(true)}>
                        <Eye size={16} className="text-muted-foreground" />
                      </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="grid grid-cols-1 divide-y divide-border/40">
                        {section.fields.map((field, fi) => (
                          <div key={fi} className="px-6 py-4 flex flex-col gap-1.5 group hover:bg-muted/5 transition-colors">
                            <span className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-widest">{field.label}</span>
                            <span className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                              {field.value || <span className="text-muted-foreground/40 italic font-normal">Not provided</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* SECURITY ACTIONS */}
              <Card className="border-border/40 shadow-lg shadow-black/5 overflow-hidden">
                <CardHeader className="py-5 px-6 border-b border-border/40 bg-muted/5">
                  <div className="flex items-center gap-3">
                    <ShieldAlert size={20} className="text-primary" />
                    <div>
                      <CardTitle className="text-md font-bold uppercase tracking-wider">Access & Security</CardTitle>
                      <CardDescription className="text-xs">Secure your account and manage authentication</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Button variant="outline" className="w-full justify-between h-auto py-5 px-5 border-border/60 bg-card hover:border-accent hover:shadow-md transition-all group" onClick={() => setShowPassModal(true)}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-white transition-all duration-300">
                          <Key size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">Update Password</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Keep your credentials fresh</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </Button>

                    <Button variant="outline" className="w-full justify-between h-auto py-5 px-5 border-border/60 bg-card hover:border-primary hover:shadow-md transition-all group" onClick={() => setShowDocViewer(true)}>
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                          <Eye size={20} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm">KYC Vault</p>
                          <p className="text-xs text-muted-foreground mt-0.5">View your verified data</p>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-muted-foreground opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </Button>
                </CardContent>
              </Card>

              {/* DOCUMENT UPLOAD AREA */}
              <div className="bg-muted/10 rounded-3xl border border-dashed border-border/60 p-1">
                <DocumentUpload />
              </div>
            </div>
          </div>
        )}

        {/* MODAL: PASSWORD UPDATE */}
        <AnimatePresence>
          {showPassModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md">
                <Card className="shadow-2xl border-border/60 overflow-hidden">
                  <CardHeader className="border-b border-border/40 bg-muted/20 pb-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Lock size={20} />
                        </div>
                        <div>
                          <CardTitle className="text-lg font-bold">Security Update</CardTitle>
                          <CardDescription className="text-xs">Update your login credentials</CardDescription>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setShowPassModal(false)} className="rounded-full hover:bg-destructive/10 hover:text-destructive"><X size={20}/></Button>
                    </div>
                  </CardHeader>
                  <form onSubmit={handlePasswordUpdate}>
                    <CardContent className="pt-8 pb-6 space-y-6">
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">New Password</label>
                        <div className="relative group">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" size={18} />
                          <input 
                            type="password" 
                            required 
                            placeholder="At least 6 characters"
                            className="w-full bg-muted/40 border-border/60 border rounded-2xl py-3.5 pl-12 pr-4 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all" 
                            value={newPassword} 
                            onChange={(e) => setNewPassword(e.target.value)} 
                          />
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="gap-3 bg-muted/20 border-t border-border/40 p-6">
                      <Button type="button" variant="ghost" className="flex-1 rounded-xl h-11 font-semibold" onClick={() => setShowPassModal(false)}>Cancel</Button>
                      <Button type="submit" variant="gold" className="flex-1 rounded-xl h-11 font-bold shadow-lg shadow-gold/20" disabled={isUpdatingPassword}>
                        {isUpdatingPassword ? <Loader2 className="animate-spin mr-2" size={18} /> : 'Update Password'}
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
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
              <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} className="w-full max-w-4xl bg-card rounded-[2.5rem] overflow-hidden flex flex-col shadow-2xl border border-white/10">
                <div className="p-6 border-b border-border/40 flex items-center justify-between bg-muted/30">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl shadow-inner">
                      <FileText size={24} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-foreground">KYC_Verification_Record.pdf</p>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-0.5">Encrypted Security Vault</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setShowDocViewer(false)} className="h-12 w-12 rounded-full hover:bg-muted"><X size={24}/></Button>
                </div>
                <div className="flex-1 bg-muted/10 min-h-[400px] flex items-center justify-center p-12 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-[0.03] pattern-grid-lg" />
                  <div className="text-center space-y-6 relative z-10">
                    <div className="w-28 h-28 bg-gradient-to-br from-primary/20 to-primary/5 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl border border-primary/20">
                      <ShieldCheck size={56} className="text-primary" />
                    </div>
                    <div className="max-w-md mx-auto">
                      <h3 className="text-xl font-bold text-foreground">Protected Asset</h3>
                      <p className="text-muted-foreground text-sm mt-2 leading-relaxed">This record is synchronized with our secure database and is only visible to your authenticated session. Digital signatures are verified.</p>
                    </div>
                    <div className="flex gap-4 justify-center pt-4">
                      <Button variant="outline" className="h-12 px-8 rounded-2xl border-border/60 bg-card hover:bg-muted font-bold">
                        <Download size={18} className="mr-2" /> Download Original
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-muted/30 border-t border-border/40 text-center">
                  <p className="text-[10px] text-muted-foreground font-medium italic">Nyota Secure Document Viewer v2.4 — End-to-End Encrypted</p>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
 
