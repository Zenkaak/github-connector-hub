import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Eye, EyeOff, Loader2, ArrowRight, Shield, Star, Fingerprint, Lock, KeyRound, AtSign } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PinPad } from '@/components/PinPad';
import { toast } from 'sonner';
import { isWebAuthnSupported, hasSavedCredential, authenticateWithFingerprint, syncFingerprintPassword, removeFingerprint } from '@/lib/webauthn';

type Mode = 'password' | 'otp';

function normalizePhoneClient(input: string) {
  let p = input.trim().replace(/\s+/g, '');
  if (p.startsWith('0') && p.length === 10) return '+254' + p.slice(1);
  if (p.startsWith('254') && p.length === 12) return '+' + p;
  if (p.startsWith('+254')) return p;
  if (/^\d{9}$/.test(p)) return '+254' + p;
  return p;
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('password');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);

  // Shared identifier (email or phone)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // OTP state
  const [otpStep, setOtpStep] = useState<'enter' | 'verify'>('enter');
  const [otp, setOtp] = useState('');
  const [otpEmail, setOtpEmail] = useState(''); // resolved email returned from server
  const [otpMaskEmail, setOtpMaskEmail] = useState('');
  const [otpMaskPhone, setOtpMaskPhone] = useState<string | null>(null);

  useEffect(() => {
    setFingerprintAvailable(isWebAuthnSupported() && hasSavedCredential());
  }, []);

  const from = location.state?.from?.pathname || '/dashboard';

  const redirectAfterAuth = async (userId: string) => {
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', userId).eq('role', 'admin').maybeSingle();
    if (roleData) navigate('/dashboard/admin', { replace: true });
    else navigate(from, { replace: true });
  };

  const resolveEmailFromIdentifier = async (raw: string): Promise<{ email: string; profile: any }> => {
    const id = raw.trim();
    if (id.includes('@')) {
      const { data } = await supabase.from('profiles')
        .select('email, is_active, disable_reason').eq('email', id.toLowerCase()).maybeSingle();
      return { email: id.toLowerCase(), profile: data };
    }
    const phone = normalizePhoneClient(id);
    const altLocal = phone.startsWith('+254') ? '0' + phone.slice(4) : phone;
    const { data } = await supabase.from('profiles')
      .select('email, is_active, disable_reason')
      .or(`phone.eq.${phone},phone.eq.${altLocal}`).limit(1).maybeSingle();
    if (!data) throw new Error('No account found for that phone');
    return { email: data.email, profile: data };
  };

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) return;
    setIsLoading(true);
    try {
      const { email, profile } = await resolveEmailFromIdentifier(identifier);
      if (profile && profile.is_active === false) {
        toast.error(`Account Disabled: ${profile.disable_reason || 'Contact support.'}`, { duration: 8000 });
        setIsLoading(false);
        return;
      }
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!authData.user) throw new Error('Login failed');

      toast.success('Welcome back!');

      const { data: pinRow } = await supabase
        .from('user_pins' as any).select('id').eq('user_id', authData.user.id).maybeSingle();
      if (!pinRow) sessionStorage.setItem('promptPinSetup', '1');
      else try { localStorage.setItem('hasPin', '1'); } catch {}

      if (isWebAuthnSupported() && hasSavedCredential()) {
        syncFingerprintPassword(authData.user.id, authData.user.email || email, password);
      }

      await redirectAfterAuth(authData.user.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message?.includes('Invalid login') ? 'Invalid email/phone or password' : (error.message || 'Failed to sign in'));
    } finally {
      setIsLoading(false);
    }
  };

  const requestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auth-otp', {
        body: { action: 'request', identifier: identifier.trim() },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Could not send code');
      const d = data as any;
      setOtpEmail(d.email);
      setOtpMaskEmail(d.emailMask || '');
      setOtpMaskPhone(d.phoneMask || null);
      setOtpStep('verify');
      toast.success(d.sentSms ? 'Code sent via SMS and email' : 'Code sent to your email');
    } catch (err: any) {
      toast.error(err.message || 'Could not send code');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auth-otp', {
        body: { action: 'verify', email: otpEmail, code: otp },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Verification failed');
      const { token_hash } = data as { token_hash: string; email: string };

      const { data: vData, error: vErr } = await supabase.auth.verifyOtp({
        type: 'magiclink', token_hash,
      });
      if (vErr) throw vErr;
      if (!vData.user) throw new Error('Sign-in failed');

      toast.success('Welcome back!');
      await redirectAfterAuth(vData.user.id);
    } catch (err: any) {
      toast.error(err.message || 'Verification failed');
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('auth-otp', {
        body: { action: 'request', identifier: identifier.trim() },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const d = data as any;
      toast.success(d.sentSms ? 'New code sent via SMS and email' : 'New code sent to your email');
      setOtp('');
    } catch (err: any) { toast.error(err.message || 'Resend failed'); }
    finally { setIsLoading(false); }
  };

  const handleFingerprintLogin = async () => {
    setFingerprintLoading(true);
    try {
      const result = await authenticateWithFingerprint();
      if (!result) { toast.error('Fingerprint failed'); return; }
      const { email, password: pwd } = result;
      if (!pwd) { toast.error('Sign in with password to refresh fingerprint'); return; }
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
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
            Sign in with your password or a one-time code sent by SMS and email.
          </p>
          <div className="flex items-center gap-6 pt-4">
            <div className="flex items-center gap-2 text-white/40 text-sm"><Shield size={16} className="text-accent" /><span>256-bit Encrypted</span></div>
            <div className="flex items-center gap-2 text-white/40 text-sm"><Star size={16} className="text-accent" /><span>CBK Regulated</span></div>
          </div>
        </div>
        <div className="relative z-10"><p className="text-xs text-white/20">© {new Date().getFullYear()} DASNET VENTURES LTD</p></div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 bg-gradient-to-b from-background via-background to-muted/30 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <motion.div
          className="w-full max-w-[400px] relative z-10"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        >
          <div className="lg:hidden mb-6 text-center">
            <Link to="/" className="inline-block mb-3"><Logo size="md" /></Link>
            <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Shield size={10} className="text-accent" /> Bank-grade</span>
              <span className="w-1 h-1 rounded-full bg-border" />
              <span className="inline-flex items-center gap-1"><Star size={10} className="text-accent" /> CBK Regulated</span>
            </div>
          </div>

          <div className="text-center lg:text-left mb-5">
            <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Welcome back</h1>
            <p className="text-sm text-muted-foreground">Sign in to your DASNET VENTURES account</p>
          </div>

          {/* Mode switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-xl mb-4 border border-border/40">
            <button type="button" onClick={() => { setMode('password'); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'password' ? 'bg-card shadow-sm text-foreground ring-1 ring-border/50' : 'text-muted-foreground hover:text-foreground/80'
              }`}>
              <Lock size={13} /> Password
            </button>
            <button type="button" onClick={() => { setMode('otp'); setOtpStep('enter'); setOtp(''); }}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'otp' ? 'bg-card shadow-sm text-foreground ring-1 ring-border/50' : 'text-muted-foreground hover:text-foreground/80'
              }`}>
              <KeyRound size={13} /> One-time Code
            </button>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 shadow-xl shadow-primary/5 p-5">
            {mode === 'password' ? (
              <form onSubmit={onPasswordSubmit} className="space-y-4">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Email or Phone Number</Label>
                  <div className="relative mt-1.5">
                    <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com or 0712 345 678"
                      className="h-11 rounded-lg text-sm pl-9" autoComplete="username" required />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Password</Label>
                    <Link to="/forgot-password" className="text-[10px] text-accent hover:underline font-medium">Forgot?</Link>
                  </div>
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="h-11 rounded-lg pr-10 text-sm" autoComplete="current-password" required />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <Button type="submit" variant="gold" className="w-full h-11 text-sm font-semibold rounded-lg" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="animate-spin" size={15} /> Signing In…</> : <>Sign In <ArrowRight size={15} /></>}
                </Button>
              </form>
            ) : otpStep === 'enter' ? (
              <form onSubmit={requestOtp} className="space-y-4">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Email or Phone Number</Label>
                  <div className="relative mt-1.5">
                    <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="you@example.com or 0712 345 678"
                      className="h-11 rounded-lg text-sm pl-9" required />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                    We'll send a 6-digit code to your registered email and phone (if available).
                  </p>
                </div>
                <Button type="submit" variant="gold" className="w-full h-11 text-sm font-semibold rounded-lg" disabled={isLoading || !identifier.trim()}>
                  {isLoading ? <><Loader2 className="animate-spin" size={15} /> Sending…</> : <>Send Code <ArrowRight size={15} /></>}
                </Button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Code sent to</p>
                  <p className="text-sm font-semibold text-foreground mt-0.5">{otpMaskEmail}</p>
                  {otpMaskPhone && <p className="text-xs text-muted-foreground mt-0.5">and SMS to {otpMaskPhone}</p>}
                </div>
                <PinPad value={otp} onChange={setOtp} length={6} autoFocus disabled={isLoading} />
                <Button type="submit" variant="gold" className="w-full h-11 text-sm font-semibold rounded-lg"
                  disabled={isLoading || otp.length !== 6}>
                  {isLoading ? <><Loader2 className="animate-spin" size={15} /> Verifying…</> : <>Sign In <ArrowRight size={15} /></>}
                </Button>
                <div className="flex items-center justify-between text-[11px]">
                  <button type="button" onClick={() => { setOtpStep('enter'); setOtp(''); }} className="text-muted-foreground hover:text-foreground">
                    ← Change details
                  </button>
                  <button type="button" onClick={resendOtp} disabled={isLoading} className="text-accent font-semibold hover:underline disabled:opacity-50">
                    Didn't get it? Resend
                  </button>
                </div>
              </form>
            )}
          </div>

          {fingerprintAvailable && mode === 'password' && (
            <>
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">or</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>
              <Button variant="outline" className="w-full h-11 gap-2 border-accent/30 text-accent hover:bg-accent/10 text-sm font-semibold rounded-lg"
                onClick={handleFingerprintLogin} disabled={fingerprintLoading}>
                {fingerprintLoading ? <Loader2 size={15} className="animate-spin" /> : <Fingerprint size={16} />}
                Sign in with Fingerprint
              </Button>
            </>
          )}

          <p className="text-xs text-muted-foreground text-center mt-5">
            New to DASNET VENTURES?{' '}
            <Link to="/signup" className="text-accent font-semibold hover:underline">Create account</Link>
          </p>

          <p className="text-[10px] text-muted-foreground/60 text-center mt-4 lg:hidden">
            © {new Date().getFullYear()} DASNET VENTURES LTD · CBK Regulated
          </p>
        </motion.div>
      </div>
    </div>
  );
}
