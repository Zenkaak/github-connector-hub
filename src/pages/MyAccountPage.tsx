import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, MapPin, CreditCard, Calendar, Shield, BadgeCheck, Edit3, 
  AlertCircle, Lock, Download, Fingerprint, Smartphone, ShieldCheck, Key, 
  ChevronRight, UserCheck, Loader2, History, Eye, X, FileText, Monitor, Globe, LogOut,
  Camera, ShieldAlert, ArrowUpRight, Zap
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
    if (/Android/i.test(ua)) name = 'Android Device';
    else if (/iPhone/i.test(ua)) name = 'iPhone';
    else if (/Windows/i.test(ua)) name = 'Windows PC';
    else if (/Mac/i.test(ua)) name = 'MacBook';
    
    if (/Chrome/i.test(ua)) name += ' • Chrome';
    else if (/Safari/i.test(ua)) name += ' • Safari';
    return name;
  };

  const [activeDevices] = useState([
    { id: 1, name: getDeviceInfo(), location: 'Nairobi, KE', ip: '197.xxx.xxx.xx', current: true, icon: /Mobi|Android/i.test(navigator.userAgent) ? Smartphone : Monitor },
  ]);

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password too short.");
      return;
    }
    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Security credentials synchronized.");
      setShowPassModal(false);
      setNewPassword('');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleLogoutOtherDevices = async (deviceId: number) => {
    setIsRevoking(deviceId);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      toast.success("Remote sessions terminated.");
    } catch (error: any) {
      toast.error("Action failed.");
    } finally {
      setIsRevoking(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0E14] transition-colors duration-500">
        <div className="max-w-[1400px] mx-auto p-6 lg:p-10 space-y-10">
          
          {/* TOP NAVIGATION & SEARCH AREA */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-[0.2em]">
                <Zap size={14} fill="currentColor" />
                System Status: Active
              </div>
              <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                Account Control <span className="text-primary">.</span>
              </h1>
            </div>
            
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
              <Button variant="ghost" className="rounded-xl text-xs font-bold px-4 hover:bg-slate-100 dark:hover:bg-slate-800">
                <History size={15} className="mr-2" /> Logs
              </Button>
              <Button variant="gold" className="rounded-xl text-xs font-bold px-5 shadow-lg shadow-gold/20">
                <Download size={15} className="mr-2" /> Export Data
              </Button>
            </div>
          </div>

          {isEditing ? (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto">
               <EditProfileForm onComplete={() => { setIsEditing(false); refreshProfile(); }} onCancel={() => setIsEditing(false)} />
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* LEFT COLUMN: IDENTITY CARD */}
              <div className="lg:col-span-4 space-y-8">
                <Card className="relative overflow-hidden border-none shadow-2xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 rounded-[2rem]">
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Shield size={120} />
                  </div>
                  <CardContent className="pt-12 pb-8 px-8 flex flex-col items-center text-center">
                    <div className="relative group cursor-pointer mb-6">
                      <div className="absolute -inset-1 bg-gradient-to-tr from-primary to-gold rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                      <div className="relative w-28 h-28 rounded-[2rem] bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-4xl font-black text-primary border-4 border-white dark:border-slate-900 shadow-xl">
                        {initials}
                      </div>
                      <div className="absolute bottom-0 right-0 p-2 bg-primary text-white rounded-xl shadow-lg border-2 border-white dark:border-slate-900 translate-x-1 translate-y-1">
                        <Camera size={14} />
                      </div>
                    </div>
                    
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-1">{displayName}</h2>
                    <p className="text-sm font-medium text-slate-500 mb-6">{displayEmail}</p>
                    
                    <div className="w-full grid grid-cols-2 gap-3 mb-8">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Verified Status</p>
                        <div className="flex items-center justify-center gap-1.5 mt-1 text-success font-black text-xs uppercase">
                          <BadgeCheck size={14} /> Tier 2
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Member Since</p>
                        <p className="mt-1 text-slate-900 dark:text-slate-200 font-black text-xs">APR 2024</p>
                      </div>
                    </div>

                    <Button onClick={() => setIsEditing(true)} className="w-full h-12 rounded-2xl bg-slate-900 dark:bg-white dark:text-slate-900 font-bold hover:scale-[1.02] transition-transform">
                      <Edit3 size={16} className="mr-2" /> Modify Profile
                    </Button>
                  </CardContent>
                  <CardFooter className="bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800/50 p-5 justify-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{membershipId}</span>
                  </CardFooter>
                </Card>

                {/* SECURITY SESSIONS CARD */}
                <Card className="rounded-[2rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden">
                  <CardHeader className="border-b border-slate-50 dark:border-slate-800 px-8 py-6">
                    <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <Fingerprint size={16} className="text-primary" /> Security Perimeter
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {activeDevices.map((device) => (
                      <div key={device.id} className="px-8 py-6 group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                              <device.icon size={22} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 dark:text-white">{device.name}</p>
                              <p className="text-xs text-slate-500 font-medium">{device.location}</p>
                            </div>
                          </div>
                          {device.current && <div className="w-2.5 h-2.5 rounded-full bg-success ring-4 ring-success/20 animate-pulse" />}
                        </div>
                        <div className="flex items-center justify-between mt-2 pl-16">
                          <span className="text-[10px] font-mono font-bold text-slate-400">{device.ip}</span>
                          {!device.current && (
                            <button onClick={() => handleLogoutOtherDevices(device.id)} className="text-[10px] font-black text-destructive uppercase tracking-widest hover:underline">Revoke</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* RIGHT COLUMN: DATA & ACTIONS */}
              <div className="lg:col-span-8 space-y-8">
                
                {/* INFO GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {[
                    { title: 'Personal Details', icon: User, data: [
                        { l: 'Full Name', v: profile?.full_name },
                        { l: 'ID Number', v: profile?.id_number },
                        { l: 'Birthday', v: profile?.date_of_birth }
                    ]},
                    { title: 'Contact & Residence', icon: MapPin, data: [
                        { l: 'Phone', v: profile?.phone || 'Not Linked' },
                        { l: 'Address', v: profile?.address },
                        { l: 'County', v: profile?.county }
                    ]}
                  ].map((group, idx) => (
                    <Card key={idx} className="rounded-[2rem] border-none shadow-xl shadow-slate-200/50 dark:shadow-none bg-white dark:bg-slate-900">
                      <CardHeader className="flex flex-row items-center justify-between px-8 pt-8 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            <group.icon size={18} />
                          </div>
                          <CardTitle className="text-base font-black">{group.title}</CardTitle>
                        </div>
                        <ArrowUpRight size={18} className="text-slate-300" />
                      </CardHeader>
                      <CardContent className="px-8 pb-8 space-y-5">
                        {group.data.map((item, i) => (
                          <div key={i} className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.l}</span>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">{item.v || '—'}</span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* SECURITY QUICK ACTIONS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button 
                    onClick={() => setShowPassModal(true)}
                    className="flex items-center justify-between p-6 rounded-[2rem] bg-gradient-to-br from-slate-900 to-slate-800 text-white hover:shadow-2xl hover:shadow-primary/20 transition-all group overflow-hidden relative"
                  >
                    <div className="relative z-10 flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center group-hover:bg-primary transition-colors">
                        <Key size={24} />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-lg">Update Credentials</p>
                        <p className="text-xs text-slate-400 font-medium">Reset your secure password</p>
                      </div>
                    </div>
                    <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform">
                      <Lock size={120} />
                    </div>
                  </button>

                  <button 
                    onClick={() => setShowDocViewer(true)}
                    className="flex items-center justify-between p-6 rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-primary transition-all group"
                  >
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:bg-primary group-hover:text-white transition-colors">
                        <ShieldCheck size={24} />
                      </div>
                      <div className="text-left">
                        <p className="font-black text-lg text-slate-900 dark:text-white">KYC Documents</p>
                        <p className="text-xs text-slate-500 font-medium">View encrypted uploads</p>
                      </div>
                    </div>
                  </button>
                </div>

                {/* FILE UPLOAD ZONE */}
                <div className="rounded-[2.5rem] bg-slate-100/50 dark:bg-slate-800/20 p-2 border-2 border-dashed border-slate-200 dark:border-slate-800/60">
                  <DocumentUpload />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* REFINED MODALS (STYLING ONLY) */}
        <AnimatePresence>
          {showPassModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/90 backdrop-blur-xl">
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 border border-white/10">
                <div className="flex justify-between items-center mb-8">
                  <h3 className="text-xl font-black">Security Sync</h3>
                  <Button variant="ghost" size="icon" onClick={() => setShowPassModal(false)} className="rounded-full"><X /></Button>
                </div>
                <form onSubmit={handlePasswordUpdate} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">New Database Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-4 text-slate-300 group-focus-within:text-primary" size={20} />
                      <input 
                        type="password" 
                        className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl pl-12 pr-4 font-bold border-none ring-2 ring-transparent focus:ring-primary/50 transition-all outline-none" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="submit" variant="gold" className="w-full h-14 rounded-2xl font-black text-base shadow-xl shadow-gold/20" disabled={isUpdatingPassword}>
                    {isUpdatingPassword ? <Loader2 className="animate-spin" /> : 'Confirm Identity Update'}
                  </Button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
 
