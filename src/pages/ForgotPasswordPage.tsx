import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Loader2, Mail, CheckCircle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'sent' | 'password' | 'success'>('email');

  // If redirected from reset link (PASSWORD_RECOVERY event), go straight to password step
  useEffect(() => {
    if (location.state?.fromResetLink) {
      setStep('password');
    }
  }, [location.state]);

  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setStep('sent');
      toast.success('Reset link sent to your email!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to send reset link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setStep('success');
      toast.success('Password updated successfully!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('New reset link sent to your email!');
    } catch (error: any) {
      toast.error(error.message || 'Failed to resend link');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(213_72%_18%_/_0.04),_transparent_50%)]" />
      <motion.div
        className="w-full max-w-[400px] relative z-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-8">
          <Link to="/">
            <Logo size="lg" />
          </Link>
        </div>

        {step === 'success' && (
          <div className="bg-card rounded-2xl border border-border/50 shadow-md p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-success/10 flex items-center justify-center">
              <CheckCircle className="text-success" size={28} />
            </div>
            <h2 className="font-display text-xl font-bold mb-2">Password Updated!</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your password has been changed successfully. You can now sign in with your new password.
            </p>
            <Button variant="gold" className="w-full" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
          </div>
        )}

        {step === 'email' && (
          <>
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold text-foreground mb-1.5">Forgot Password</h1>
              <p className="text-sm text-muted-foreground">Enter your email and we'll send you a reset link</p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 shadow-md p-6">
              <form onSubmit={handleSendLink} className="space-y-5">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Email Address
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="mt-2 h-12 rounded-xl"
                    required
                  />
                </div>
                <Button type="submit" variant="gold" className="w-full h-12" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="animate-spin" size={18} /> Sending...</>
                  ) : (
                    <><Mail size={18} /> Send Reset Link</>
                  )}
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

        {step === 'sent' && (
          <>
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold text-foreground mb-1.5">Check Your Email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a password reset link to <strong className="text-foreground">{email}</strong>
              </p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 shadow-md p-6 space-y-5">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Mail className="text-primary" size={28} />
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Click the link in the email to reset your password. If you don't see it, check your spam folder.
              </p>
              <div className="text-center">
                <button
                  onClick={handleResend}
                  className="text-xs text-primary font-semibold hover:underline disabled:opacity-50"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending...' : "Didn't receive the email? Resend"}
                </button>
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground mt-6">
              <button onClick={() => setStep('email')} className="text-primary font-semibold hover:underline inline-flex items-center gap-1">
                <ArrowLeft size={14} /> Change email
              </button>
            </p>
          </>
        )}

        {step === 'password' && (
          <>
            <div className="mb-6">
              <h1 className="font-display text-2xl font-bold text-foreground mb-1.5">Set New Password</h1>
              <p className="text-sm text-muted-foreground">Enter your new password below</p>
            </div>
            <div className="bg-card rounded-2xl border border-border/50 shadow-md p-6">
              <form onSubmit={handleResetPassword} className="space-y-5">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    New Password
                  </Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="mt-2 h-12 rounded-xl"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Confirm Password
                  </Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="mt-2 h-12 rounded-xl"
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" variant="gold" className="w-full h-12" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="animate-spin" size={18} /> Updating...</>
                  ) : (
                    <><Lock size={18} /> Update Password</>
                  )}
                </Button>
              </form>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}
