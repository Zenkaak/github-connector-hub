import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Mail, Phone, ArrowRight, Shield, Star, Fingerprint } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { loginSchema, LoginFormData } from '@/lib/validations';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { isWebAuthnSupported, hasSavedCredential, authenticateWithFingerprint, registerFingerprint, syncFingerprintPassword, removeFingerprint } from '@/lib/webauthn';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false);
  const [fingerprintLoading, setFingerprintLoading] = useState(false);

  useEffect(() => {
    setFingerprintAvailable(isWebAuthnSupported() && hasSavedCredential());
  }, []);

  const from = location.state?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      let email = data.identifier;

      if (loginMethod === 'phone') {
        let phone = data.identifier.trim();
        if (phone.startsWith('0')) phone = '+254' + phone.slice(1);
        else if (phone.startsWith('254')) phone = '+' + phone;
        else if (!phone.startsWith('+254')) phone = '+254' + phone;

        let { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('email, is_verified, phone')
          .eq('phone', phone)
          .single();

        if (profileError || !profile) {
          const phoneWithout254 = phone.replace('+254', '0');
          const { data: altProfile } = await supabase
            .from('profiles')
            .select('email, is_verified, phone')
            .or(`phone.eq.${phone},phone.eq.${phoneWithout254},phone.eq.254${phone.slice(4)}`)
            .limit(1)
            .single();
          if (altProfile) profile = altProfile;
        }

        if (!profile) throw new Error('Phone number not registered. Please sign up first.');
        email = profile.email;
      }

      // Check if account is disabled before attempting login
      const { data: profileCheck } = await supabase
        .from('profiles')
        .select('is_active, disable_reason, full_name')
        .eq('email', email)
        .maybeSingle();

      if (profileCheck && profileCheck.is_active === false) {
        const reason = profileCheck.disable_reason || 'Your account has been disabled. Please contact support.';
        toast.error(`Account Disabled: ${reason}`, { duration: 8000 });
        setIsLoading(false);
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: data.password,
      });

      if (authError) throw authError;
      if (authData.user) {
        // Check if user is admin to redirect appropriately
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authData.user.id)
          .eq('role', 'admin')
          .maybeSingle();
        const userIsAdmin = !!roleData;

        toast.success('Welcome back!');
        
        // Keep saved fingerprint password in sync after successful password login
        if (isWebAuthnSupported()) {
          const savedExists = hasSavedCredential();

          if (savedExists) {
            syncFingerprintPassword(authData.user.id, authData.user.email || email, data.password);
          } else {
            const shouldSetup = window.confirm(
              '🔒 Secure your account!\n\nWould you like to enable fingerprint login for faster, more secure access?'
            );
            if (shouldSetup) {
              const registered = await registerFingerprint(authData.user.id, authData.user.email || email, data.password);
              if (registered) {
                toast.success('Fingerprint enabled! You can now sign in with your fingerprint.');
              } else {
                toast.error('Fingerprint setup failed. You can try again in Settings.');
              }
            }
          }
        }
        
        // Admin goes straight to admin dashboard, never user dashboard
        if (userIsAdmin) {
          navigate('/dashboard/admin', { replace: true });
        } else {
          navigate(from, { replace: true });
        }
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message?.includes('Invalid login credentials')) {
        toast.error('Invalid email/phone or password');
      } else {
        toast.error(error.message || 'Failed to sign in');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFingerprintLogin = async () => {
    setFingerprintLoading(true);
    try {
      const result = await authenticateWithFingerprint();
      if (!result) {
        toast.error('Fingerprint authentication failed');
        return;
      }

      const { email, password } = result;
      if (!password) {
        toast.error('Please log in with password to re-enable fingerprint login.');
        return;
      }

      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message?.includes('Invalid login credentials')) {
          removeFingerprint();
          setFingerprintAvailable(false);
          toast.error('Fingerprint expired. Please sign in with password once, then try again.');
          return;
        }
        throw error;
      }
      if (authData.user) {
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', authData.user.id)
          .eq('role', 'admin')
          .maybeSingle();
        toast.success('Welcome back!');
        navigate(roleData ? '/dashboard/admin' : from, { replace: true });
      }
    } catch (e: any) {
      console.error('Fingerprint login failed:', e);
      toast.error('Fingerprint login failed. Please use your password.');
    } finally {
      setFingerprintLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-[45%] hero-gradient relative overflow-hidden flex-col justify-between p-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(42_92%_56%_/_0.1),_transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />

        <div className="relative z-10">
          <Link to="/">
            <Logo variant="white" size="lg" />
          </Link>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="font-display text-3xl font-bold text-white leading-tight">
            Welcome back to
            <br />
            <span className="bg-gradient-to-r from-accent to-gold-300 bg-clip-text text-transparent">
              Nyota Foundation
            </span>
          </h2>
          <p className="text-white/50 leading-relaxed max-w-sm">
            Sign in to manage your loans, track applications, and access exclusive financial products.
          </p>

          {/* Trust indicators */}
          <div className="flex items-center gap-6 pt-4">
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Shield size={16} className="text-accent" />
              <span>256-bit Encrypted</span>
            </div>
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <Star size={16} className="text-accent" />
              <span>CBK Regulated</span>
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-white/20">© {new Date().getFullYear()} Nyota Foundation</p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8 bg-background relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(213_72%_18%_/_0.02),_transparent_50%)]" />

        <motion.div
          className="w-full max-w-[400px] relative z-10"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div className="lg:hidden mb-8">
            <Link to="/">
              <Logo size="lg" />
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-foreground mb-1.5">
              Sign In
            </h1>
            <p className="text-sm text-muted-foreground">
              Enter your credentials to access your account
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border/50 shadow-md p-6">
            <Tabs value={loginMethod} onValueChange={(v) => setLoginMethod(v as 'email' | 'phone')}>
              <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="email" className="flex items-center gap-2 text-xs rounded-lg data-[state=active]:shadow-sm">
                  <Mail size={14} />
                  Email
                </TabsTrigger>
                <TabsTrigger value="phone" className="flex items-center gap-2 text-xs rounded-lg data-[state=active]:shadow-sm">
                  <Phone size={14} />
                  Phone
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <TabsContent value="email" className="mt-0">
                  <div>
                    <Label htmlFor="identifier" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Email Address
                    </Label>
                    <Input
                      id="identifier"
                      type="email"
                      placeholder="john@example.com"
                      {...register('identifier')}
                      className={`mt-2 h-12 rounded-xl ${errors.identifier ? 'border-destructive' : ''}`}
                    />
                    {errors.identifier && (
                      <p className="text-xs text-destructive mt-1.5">{errors.identifier.message}</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="phone" className="mt-0">
                  <div>
                    <Label htmlFor="identifier" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Phone Number
                    </Label>
                    <Input
                      id="identifier"
                      type="tel"
                      placeholder="0712345678"
                      {...register('identifier')}
                      className={`mt-2 h-12 rounded-xl ${errors.identifier ? 'border-destructive' : ''}`}
                    />
                    {errors.identifier && (
                      <p className="text-xs text-destructive mt-1.5">{errors.identifier.message}</p>
                    )}
                  </div>
                </TabsContent>

                <div>
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Password
                  </Label>
                  <div className="relative mt-2">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      {...register('password')}
                      className={`h-12 rounded-xl ${errors.password ? 'border-destructive pr-10' : 'pr-10'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-xs text-destructive mt-1.5">{errors.password.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="gold"
                  className="w-full h-12 text-base"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Signing In...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight size={18} />
                    </>
                  )}
                </Button>
              </form>
            </Tabs>
          </div>

          <div className="text-center mt-6 space-y-3">
            {fingerprintAvailable && (
              <Button
                variant="outline"
                className="w-full h-12 gap-2 border-accent/30 text-accent hover:bg-accent/10"
                onClick={handleFingerprintLogin}
                disabled={fingerprintLoading}
              >
                {fingerprintLoading ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={20} />}
                Sign in with Fingerprint
              </Button>
            )}
            <p className="text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="text-primary font-semibold hover:underline">
                Create Account
              </Link>
            </p>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-accent transition-colors block">
              Forgot your password?
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
