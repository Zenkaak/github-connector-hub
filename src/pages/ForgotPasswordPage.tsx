import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, CheckCircle, Lock, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PinPad } from '@/components/PinPad';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'code' | 'password' | 'success'>('email');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('password-recovery-otp', {
        body: { action: 'request', email: email.trim().toLowerCase() },
      });
      if (error) throw error;
      setStep('code');
      toast.success('We sent a 6-digit code to your email');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return toast.error('Enter the 6-digit code');
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('password-recovery-otp', {
        body: { action: 'check', email: email.trim().toLowerCase(), code },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Invalid code');
      setStep('password');
    } catch (err: any) {
      toast.error(err.message || 'Invalid code');
      setCode('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error('Password must be at least 6 characters');
    if (password !== confirmPassword) return toast.error('Passwords don\'t match');
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('password-recovery-otp', {
        body: {
          action: 'verify',
          email: email.trim().toLowerCase(),
          code,
          newPassword: password,
        },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      setStep('success');
      toast.success('Password reset successfully');
    } catch (error: any) {
      toast.error(error.message || 'Could not reset password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      await supabase.functions.invoke('password-recovery-otp', {
        body: { action: 'request', email: email.trim().toLowerCase() },
      });
      toast.success('New code sent');
      setCode('');
    } finally { setIsLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(213_72%_18%_/_0.04),_transparent_50%)]" />
      <motion.div className="w-full max-w-[400px] relative z-10" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-8">
          <Link to="/"><Logo size="lg" /></Link>
        </div>

        {step === 'email' && (
          <>
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold mb-1.5">Forgot Password</h1>
              <p className="text-sm text-muted-foreground">Enter your email and we'll send a 6-digit recovery code</p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 shadow-md p-6">
              <form onSubmit={handleSendCode} className="space-y-5">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com" className="mt-2 h-12 rounded-xl" required />
                </div>
                <Button type="submit" variant="gold" className="w-full h-12" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="animate-spin" size={18} /> Sending…</> : <><Mail size={18} /> Send Recovery Code</>}
                </Button>
              </form>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6">
              <Link to="/auth" className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
                <ArrowLeft size={14} /> Back to Sign In
              </Link>
            </p>
          </>
        )}

        {step === 'code' && (
          <>
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold mb-1.5">Enter Code</h1>
              <p className="text-sm text-muted-foreground">We sent a 6-digit code to <strong className="text-foreground">{email}</strong></p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 shadow-md p-6 space-y-6">
              <div className="flex justify-center">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
                  <KeyRound className="text-accent" size={26} />
                </div>
              </div>
              <form onSubmit={handleVerifyCode} className="space-y-5">
                <PinPad value={code} onChange={setCode} length={6} autoFocus />
                <Button type="submit" variant="gold" className="w-full h-12" disabled={code.length !== 6}>Continue</Button>
              </form>
              <button onClick={handleResend} disabled={isLoading}
                className="block mx-auto text-xs text-primary font-semibold hover:underline disabled:opacity-50">
                {isLoading ? 'Sending…' : "Didn't receive the code? Resend"}
              </button>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6">
              <button onClick={() => { setStep('email'); setCode(''); }} className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
                <ArrowLeft size={14} /> Change email
              </button>
            </p>
          </>
        )}

        {step === 'password' && (
          <>
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold mb-1.5">Set New Password</h1>
              <p className="text-sm text-muted-foreground">Code verified. Enter your new password below.</p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 shadow-md p-6">
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New Password</Label>
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters" className="mt-2 h-12 rounded-xl" required minLength={6} />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
                  <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password" className="mt-2 h-12 rounded-xl" required minLength={6} />
                </div>
                <Button type="submit" variant="gold" className="w-full h-12" disabled={isLoading}>
                  {isLoading ? <><Loader2 className="animate-spin" size={18} /> Updating…</> : <><Lock size={18} /> Update Password</>}
                </Button>
              </form>
            </div>
          </>
        )}

        {step === 'success' && (
          <div className="bg-card rounded-2xl border border-border/50 shadow-md p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-success/10 flex items-center justify-center">
              <CheckCircle className="text-success" size={28} />
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Password Updated</h2>
            <p className="text-sm text-muted-foreground mb-6">Sign in with your new password to continue.</p>
            <Button variant="gold" className="w-full" onClick={() => navigate('/auth')}>Sign In</Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
