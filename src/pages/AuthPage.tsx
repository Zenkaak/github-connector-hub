import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Mail, Phone, ArrowRight, Shield, Star, Fingerprint, Lock, KeyRound, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { loginSchema, LoginFormData } from '@/lib/validations';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PinPad } from '@/components/PinPad';
import { toast } from 'sonner';
import { isWebAuthnSupported, hasSavedCredential, authenticateWithFingerprint, registerFingerprint, syncFingerprintPassword, removeFingerprint } from '@/lib/webauthn';

type Mode = 'password' | 'pin';

export default function AuthPage() {
  // ... (Logic remains identical)
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [pin, setPin] = useState('');

  useEffect(() => {
    setFingerprintAvailable(isWebAuthnSupported() && hasSavedCredential());
  }, []);

  const from = location.state?.from?.pathname || '/dashboard';

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const redirectAfterAuth = async (userId: string) => {
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    if (roleData) navigate('/dashboard/admin', { replace: true });
    else navigate(from, { replace: true });
  };

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      let email = data.identifier;
      if (loginMethod === 'phone') {
        let phone = data.identifier.trim();
        if (phone.startsWith('0')) phone = '+254' + phone.slice(1);
        else if (phone.startsWith('254')) phone = '+' + phone;
        else if (!phone.startsWith('+254')) phone = '+254' + phone;
        let { data: profile } = await supabase.from('profiles').select('email, phone').eq('phone', phone).maybeSingle();
        if (!profile) {
          const { data: alt } = await supabase.from('profiles').select('email, phone').or(`phone.eq.${phone},phone.eq.${phone.replace('+254', '0')}`).limit(1).maybeSingle();
          if (alt) profile = alt;
        }
        if (!profile) throw new Error('Phone not registered');
        email = profile.email;
      }
      const { data: profileCheck } = await supabase.from('profiles').select('is_active, disable_reason').eq('email', email).maybeSingle();
      if (profileCheck && profileCheck.is_active === false) {
        toast.error(`Account Disabled: ${profileCheck.disable_reason || 'Contact support.'}`, { duration: 8000 });
        setIsLoading(false);
        return;
      }
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: data.password });
      if (error) throw error;
      if (!authData.user) throw new Error('Login failed');
      toast.success('Welcome back!');
      const { data: pinRow } = await supabase.from('user_pins' as any).select('id').eq('user_id', authData.user.id).maybeSingle();
      if (!pinRow) sessionStorage.setItem('promptPinSetup', '1');
      else try { localStorage.setItem('hasPin', '1'); } catch {}
      if (isWebAuthnSupported() && !hasSavedCredential()) {} else if (isWebAuthnSupported()) {
        syncFingerprintPassword(authData.user.id, authData.user.email || email, data.password);
      }
      await redirectAfterAuth(authData.user.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message?.includes('Invalid login') ? 'Invalid email/phone or password' : (error.message || 'Failed to sign in'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4 || !pinIdentifier.trim()) return;
    setIsLoading(true);
    try {
      let identifier = pinIdentifier.trim();
      if (/^0\d{9}$/.test(identifier)) identifier = '+254' + identifier.slice(1);
      const { data, error } = await supabase.functions.invoke('pin-login', { body: { identifier, pin } });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'PIN login failed');
      const { email, token_hash } = data as { email: string; token_hash: string };
      const { data: vData, error: vErr } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash, email });
      if (vErr) throw vErr;
      if (!vData.user) throw new Error('Sign-in failed');
      toast.success('Welcome back!');
      await redirectAfterAuth(vData.user.id);
    } catch (error: any) {
      toast.error(error.message || 'PIN login failed');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFingerprintLogin = async () => {
    setFingerprintLoading(true);
    try {
      const result = await authenticateWithFingerprint();
      if (!result) { toast.error('Fingerprint failed'); return; }
      const { email, password } = result;
      if (!password) { toast.error('Sign in with password to refresh fingerprint'); return; }
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message?.includes('Invalid login')) {
          removeFingerprint(); setFingerprintAvailable(false);
          toast.error('Fingerprint expired'); return;
        }
        throw error;
      }
      if (authData.user) {
        toast.success('Welcome back!');
        await redirectAfterAuth(authData.user.id);
      }
    } catch (e: any) {
      toast.error('Fingerprint login failed');
    } finally { setFingerprintLoading(false); }
  };

  return (
    <div className="min-h-screen flex bg-[#FAFAFB]">
      {/* Left brand panel - Enhanced with Glassmorphism and better typography */}
      <div className="hidden lg:flex lg:w-[45%] hero-gradient relative overflow-hidden flex-col justify-between p-12">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-accent/20 rounded-full blur-[120px]" />
        
        <div className="relative z-10">
          <Link to="/" className="inline-block transition-transform hover:scale-105">
            <Logo variant="white" size="lg" />
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="font-display text-4xl font-extrabold text-white leading-[1.1] tracking-tight">
              Secure access to your <br />
              <span className="text-accent">financial future.</span>
            </h2>
            <p className="mt-6 text-white/70 text-lg leading-relaxed max-w-md font-light">
              Manage your wealth, track investments, and access credit with Kenya's most trusted digital partner.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-4 pt-8">
            {[
              { icon: <Shield className="text-accent" size={18} />, text: "Bank-Grade Security" },
              { icon: <CheckCircle2 className="text-accent" size={18} />, text: "CBK Regulated" }
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 bg-white/5 backdrop-blur-md border border-white/10 p-3 rounded-xl">
                {item.icon}
                <span className="text-white/80 text-sm font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-white/40 font-medium">
            © {new Date().getFullYear()} DASNET VENTURES LTD. All Rights Reserved.
          </p>
        </div>
      </div>

      {/* Right form panel - Cleaner and focused */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative">
        <motion.div 
          className="w-full max-w-[420px]"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <div className="lg:hidden mb-10 flex justify-center">
            <Link to="/"><Logo size="lg" /></Link>
          </div>

          <div className="mb-8 text-center lg:text-left">
            <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">Sign In</h1>
            <p className="text-slate-500 mt-2">Welcome back! Please enter your details.</p>
          </div>

          {/* Elegant Mode Switcher */}
          <div className="flex p-1 bg-slate-100 rounded-2xl mb-8 border border-slate-200/50">
            <button
              onClick={() => setMode('password')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                mode === 'password' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Lock size={16} strokeWidth={2.5} /> Password
            </button>
            <button
              onClick={() => setMode('pin')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
                mode === 'pin' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <KeyRound size={16} strokeWidth={2.5} /> PIN Pad
            </button>
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="wait">
              {mode === 'password' ? (
                <motion.div
                  key="password-mode"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <Tabs value={loginMethod} onValueChange={(v) => setLoginMethod(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-8 h-11 bg-transparent border-b border-slate-200 rounded-none p-0">
                      <TabsTrigger value="email" className="data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none bg-transparent data-[state=active]:shadow-none font-bold text-xs uppercase tracking-widest">Email</TabsTrigger>
                      <TabsTrigger value="phone" className="data-[state=active]:border-b-2 data-[state=active]:border-accent rounded-none bg-transparent data-[state=active]:shadow-none font-bold text-xs uppercase tracking-widest">Phone</TabsTrigger>
                    </TabsList>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                      <TabsContent value="email" className="mt-0 focus-visible:outline-none">
                        <div className="space-y-2">
                          <Label className="text-[11px] uppercase font-bold text-slate-500 tracking-wider ml-1">Email Address</Label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <Input 
                              type="email" 
                              placeholder="name@company.com" 
                              {...register('identifier')}
                              className={`pl-11 h-13 border-slate-200 focus:border-accent focus:ring-accent/20 rounded-xl transition-all ${errors.identifier ? 'border-destructive' : ''}`} 
                            />
                          </div>
                          {errors.identifier && <p className="text-xs text-destructive font-medium mt-1">{errors.identifier.message}</p>}
                        </div>
                      </TabsContent>

                      <TabsContent value="phone" className="mt-0 focus-visible:outline-none">
                        <div className="space-y-2">
                          <Label className="text-[11px] uppercase font-bold text-slate-500 tracking-wider ml-1">Phone Number</Label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <Input 
                              type="tel" 
                              placeholder="0712 345 678" 
                              {...register('identifier')}
                              className={`pl-11 h-13 border-slate-200 focus:border-accent focus:ring-accent/20 rounded-xl transition-all ${errors.identifier ? 'border-destructive' : ''}`} 
                            />
                          </div>
                          {errors.identifier && <p className="text-xs text-destructive font-medium mt-1">{errors.identifier.message}</p>}
                        </div>
                      </TabsContent>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <Label className="text-[11px] uppercase font-bold text-slate-500 tracking-wider">Password</Label>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <Input 
                            type={showPassword ? 'text' : 'password'} 
                            placeholder="••••••••"
                            {...register('password')}
                            className={`pl-11 pr-12 h-13 border-slate-200 focus:border-accent focus:ring-accent/20 rounded-xl transition-all ${errors.password ? 'border-destructive' : ''}`} 
                          />
                          <button 
                            type="button" 
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {errors.password && <p className="text-xs text-destructive font-medium mt-1">{errors.password.message}</p>}
                      </div>

                      <Button type="submit" variant="gold" className="w-full h-13 rounded-xl shadow-lg shadow-gold-500/20 text-base font-bold transition-all active:scale-[0.98]" disabled={isLoading}>
                        {isLoading ? <><Loader2 className="animate-spin mr-2" size={20} /> Processing...</> : <>Sign In <ArrowRight className="ml-2" size={18} /></>}
                      </Button>
                    </form>
                  </Tabs>
                </motion.div>
              ) : (
                <motion.div
                  key="pin-mode"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  <form onSubmit={handlePinLogin} className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-[11px] uppercase font-bold text-slate-500 tracking-wider ml-1">Account Identifier</Label>
                      <Input 
                        value={pinIdentifier} 
                        onChange={(e) => setPinIdentifier(e.target.value)}
                        placeholder="Email or phone number" 
                        className="h-13 border-slate-200 focus:border-accent focus:ring-accent/20 rounded-xl" 
                        required 
                      />
                    </div>
                    <div className="space-y-4">
                      <Label className="text-[11px] uppercase font-bold text-slate-500 tracking-wider text-center block">Enter 4-Digit Security PIN</Label>
                      <PinPad value={pin} onChange={setPin} autoFocus disabled={isLoading} />
                    </div>
                    <Button type="submit" variant="gold" className="w-full h-13 rounded-xl shadow-lg shadow-gold-500/20 text-base font-bold"
                      disabled={isLoading || pin.length !== 4 || !pinIdentifier.trim()}>
                      {isLoading ? <><Loader2 className="animate-spin mr-2" size={20} /> Verifying...</> : <>Unlock Account <ArrowRight className="ml-2" size={18} /></>}
                    </Button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#FAFAFB] px-4 text-slate-400 font-bold tracking-widest">Additional Options</span></div>
            </div>

            <div className="space-y-4">
              {fingerprintAvailable && (
                <Button 
                  variant="outline" 
                  className="w-full h-13 rounded-xl gap-3 border-slate-200 text-slate-700 hover:bg-slate-50 font-bold transition-all"
                  onClick={handleFingerprintLogin} 
                  disabled={fingerprintLoading}
                >
                  {fingerprintLoading ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={20} className="text-accent" />}
                  Biometric Unlock
                </Button>
              )}
              
              <div className="flex flex-col items-center gap-4">
                <Link to="/forgot-password" size="sm" className="text-sm font-semibold text-accent hover:text-accent-hover transition-colors">
                  Forgot password?
                </Link>
                <p className="text-sm text-slate-500 font-medium">
                  New to Dasnet?{' '}
                  <Link to="/signup" className="text-slate-900 font-bold hover:underline underline-offset-4">Create an account</Link>
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
