import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Mail, Phone, ArrowRight, Shield, Star, Fingerprint, Lock, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
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

        let { data: profile } = await supabase
          .from('profiles').select('email, phone').eq('phone', phone).maybeSingle();
        if (!profile) {
          const { data: alt } = await supabase
            .from('profiles').select('email, phone')
            .or(`phone.eq.${phone},phone.eq.${phone.replace('+254', '0')}`).limit(1).maybeSingle();
          if (alt) profile = alt;
        }
        if (!profile) throw new Error('Phone not registered');
        email = profile.email;
      }

      const { data: profileCheck } = await supabase
        .from('profiles').select('is_active, disable_reason').eq('email', email).maybeSingle();
      if (profileCheck && profileCheck.is_active === false) {
        toast.error(`Account Disabled: ${profileCheck.disable_reason || 'Contact support.'}`, { duration: 8000 });
        setIsLoading(false);
        return;
      }

      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: data.password });
      if (error) throw error;
      if (!authData.user) throw new Error('Login failed');

      toast.success('Welcome back!');

      // Mark needs-PIN flag if user doesn't have one
      const { data: pinRow } = await supabase
        .from('user_pins' as any).select('id').eq('user_id', authData.user.id).maybeSingle();
      if (!pinRow) sessionStorage.setItem('promptPinSetup', '1');
      else try { localStorage.setItem('hasPin', '1'); } catch {}

      // Fingerprint setup
      if (isWebAuthnSupported() && !hasSavedCredential()) {
        // skip auto prompt to avoid overlap with PIN prompt
      } else if (isWebAuthnSupported()) {
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

      const { data, error } = await supabase.functions.invoke('pin-login', {
        body: { identifier, pin },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'PIN login failed');

      const { email, token_hash } = data as { email: string; token_hash: string };
      const { data: vData, error: vErr } = await supabase.auth.verifyOtp({
        type: 'magiclink', token_hash, email,
      });
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
    <div className="min-h-screen flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[45%] hero-gradient relative overflow-hidden flex-col justify-between p-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(42_92%_56%_/_0.1),_transparent_50%)]" />
        <div className="relative z-10"><Link to="/"><Logo variant="white" size="lg" /></Link></div>
        <div className="relative z-10 space-y-6">
          <h2 className="font-display text-3xl font-bold text-white leading-tight">
            Welcome back to<br />
            <span className="bg-gradient-to-r from-accent to-gold-300 bg-clip-text text-transparent">DASNET VENTURES</span>
          </h2>
          <p className="text-white/50 leading-relaxed max-w-sm">
            Sign in with your password or 4-digit PIN to manage your wallet, loans, and chama groups.
          </p>
          <div className="flex items-center gap-6 pt-4">
            <div className="flex items-center gap-2 text-white/40 text-sm"><Shield size={16} className="text-accent" /><span>256-bit Encrypted</span></div>
            <div className="flex items-center gap-2 text-white/40 text-sm"><Star size={16} className="text-accent" /><span>CBK Regulated</span></div>
          </div>
        </div>
        <div className="relative z-10"><p className="text-xs text-white/20">© {new Date().getFullYear()} DASNET VENTURES LTD</p></div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 bg-background relative">
        <motion.div className="w-full max-w-[380px] relative z-10" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="lg:hidden mb-5"><Link to="/"><Logo size="md" /></Link></div>

          <div className="mb-4">
            <h1 className="font-display text-xl font-bold mb-0.5">Sign In</h1>
            <p className="text-xs text-muted-foreground">Choose how you'd like to sign in</p>
          </div>

          {/* Mode switch */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-muted/40 rounded-lg mb-4">
            <button
              type="button" onClick={() => setMode('password')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition ${
                mode === 'password' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            ><Lock size={12} /> Password</button>
            <button
              type="button" onClick={() => setMode('pin')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-semibold transition ${
                mode === 'pin' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            ><KeyRound size={12} /> PIN</button>
          </div>

          <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4">
            {mode === 'password' ? (
              <Tabs value={loginMethod} onValueChange={(v) => setLoginMethod(v as any)}>
                <TabsList className="grid w-full grid-cols-2 mb-4 bg-muted/50 p-0.5 rounded-lg h-9">
                  <TabsTrigger value="email" className="flex items-center gap-1.5 text-xs rounded-md h-7"><Mail size={12} /> Email</TabsTrigger>
                  <TabsTrigger value="phone" className="flex items-center gap-1.5 text-xs rounded-md h-7"><Phone size={12} /> Phone</TabsTrigger>
                </TabsList>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5">
                  <TabsContent value="email" className="mt-0">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Email Address</Label>
                    <Input type="email" placeholder="john@example.com" {...register('identifier')}
                      className={`mt-1.5 h-10 rounded-lg text-sm ${errors.identifier ? 'border-destructive' : ''}`} />
                    {errors.identifier && <p className="text-xs text-destructive mt-1">{errors.identifier.message}</p>}
                  </TabsContent>
                  <TabsContent value="phone" className="mt-0">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Phone Number</Label>
                    <Input type="tel" placeholder="0712345678" {...register('identifier')}
                      className={`mt-1.5 h-10 rounded-lg text-sm ${errors.identifier ? 'border-destructive' : ''}`} />
                    {errors.identifier && <p className="text-xs text-destructive mt-1">{errors.identifier.message}</p>}
                  </TabsContent>

                  <div>
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Password</Label>
                    <div className="relative mt-1.5">
                      <Input type={showPassword ? 'text' : 'password'} placeholder="Enter your password"
                        {...register('password')}
                        className={`h-10 rounded-lg pr-10 text-sm ${errors.password ? 'border-destructive' : ''}`} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-destructive mt-1">{errors.password.message}</p>}
                  </div>

                  <Button type="submit" variant="gold" className="w-full h-10 text-sm" disabled={isLoading}>
                    {isLoading ? <><Loader2 className="animate-spin" size={15} /> Signing In…</> : <>Sign In <ArrowRight size={15} /></>}
                  </Button>
                </form>
              </Tabs>
            ) : (
              <form onSubmit={handlePinLogin} className="space-y-3.5">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Email or Phone</Label>
                  <Input value={pinIdentifier} onChange={(e) => setPinIdentifier(e.target.value)}
                    placeholder="john@example.com or 0712345678" className="mt-1.5 h-10 rounded-lg text-sm" required />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">Enter your 4-digit PIN</Label>
                  <PinPad value={pin} onChange={setPin} autoFocus disabled={isLoading} />
                </div>
                <Button type="submit" variant="gold" className="w-full h-10 text-sm"
                  disabled={isLoading || pin.length !== 4 || !pinIdentifier.trim()}>
                  {isLoading ? <><Loader2 className="animate-spin" size={15} /> Verifying…</> : <>Sign In with PIN <ArrowRight size={15} /></>}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  No PIN yet? Sign in with your password once and we'll prompt you to create one.
                </p>
              </form>
            )}
          </div>

          <div className="text-center mt-4 space-y-2.5">
            {fingerprintAvailable && (
              <Button variant="outline" className="w-full h-10 gap-2 border-accent/30 text-accent hover:bg-accent/10 text-sm"
                onClick={handleFingerprintLogin} disabled={fingerprintLoading}>
                {fingerprintLoading ? <Loader2 size={15} className="animate-spin" /> : <Fingerprint size={16} />}
                Sign in with Fingerprint
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="text-accent font-semibold hover:underline">Create Account</Link>
            </p>
            <Link to="/forgot-password" className="text-[11px] text-accent/70 hover:text-accent transition-colors block">
              Forgot your password?
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
