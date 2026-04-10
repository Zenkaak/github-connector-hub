import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, ArrowRight, ArrowLeft, Loader2, User, MapPin, Lock, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { signupSchema, SignupFormData } from '@/lib/validations';
import { kenyaCounties } from '@/lib/loan-products';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { FeatureDisabled } from '@/components/FeatureDisabled';

const stepInfo = [
  { label: 'Personal', icon: User, desc: 'Your identity details' },
  { label: 'Location', icon: MapPin, desc: 'Where you are based' },
  { label: 'Security', icon: Lock, desc: 'Secure your account' },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const { isEnabled } = usePlatformSettings();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);

  if (!isEnabled('new_registrations_enabled')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full">
          <div className="text-center mb-6"><Logo size="lg" /></div>
          <FeatureDisabled title="Registration Closed" message="New account registrations are currently paused. Please check back later or contact support." />
          <div className="text-center mt-4"><Link to="/auth" className="text-sm text-accent">Already have an account? Sign In</Link></div>
        </div>
      </div>
    );
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      let phone = data.phone;
      if (phone.startsWith('0')) phone = '+254' + phone.slice(1);
      else if (!phone.startsWith('+')) phone = '+254' + phone;

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('phone, email')
        .or(`phone.eq.${phone},email.eq.${data.email},id_number.eq.${data.idNumber}`)
        .maybeSingle();

      if (existingProfile) {
        toast.error('Account already exists. Please login.');
        navigate('/auth');
        return;
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        if (authError.message?.includes('already registered')) {
          toast.error('This email is already registered. Please login instead.');
          navigate('/auth');
          return;
        }
        throw authError;
      }

      if (authData.user) {
        // With auto-confirm, user is now authenticated. Update the profile created by trigger.
        const { error: profileError } = await supabase.from('profiles').update({
          full_name: data.fullName,
          email: data.email,
          phone: phone,
          county: data.county,
          sub_county: data.subCounty,
          ward: data.ward,
          address: data.address,
          id_number: data.idNumber,
          date_of_birth: data.dateOfBirth,
          is_verified: true,
          is_active: true,
        }).eq('user_id', authData.user.id);
        if (profileError) throw profileError;

        const { error: roleError } = await supabase.from('user_roles').insert({
          user_id: authData.user.id,
          role: 'user',
        });
        if (roleError) console.error('Role error:', roleError);

        toast.success('Account created successfully!');
        navigate('/dashboard');
      }
    } catch (error: any) {
      console.error('Signup error:', error);
      if (error.message?.includes('duplicate key')) {
        toast.error('Phone number or ID is already registered.');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="h-16 border-b border-border/50 flex items-center justify-between px-4 md:px-8 bg-card/50 backdrop-blur-sm">
        <Link to="/">
          <Logo size="md" />
        </Link>
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Already have an account? <span className="font-semibold text-accent">Sign In</span>
        </Link>
      </div>

      <div className="flex-1 flex items-start justify-center py-8 px-4">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">
              Create Your Account
            </h1>
            <p className="text-muted-foreground text-sm">
              Join DASNET VENTURES and access chama management, savings & loans
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0 mb-8">
            {stepInfo.map((s, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === step;
              const isCompleted = stepNum < step;
              return (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                        isCompleted
                          ? 'bg-success text-success-foreground'
                          : isActive
                          ? 'bg-primary text-primary-foreground shadow-navy'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? <CheckCircle size={18} /> : <s.icon size={18} />}
                    </div>
                    <span className={`text-[11px] mt-1.5 font-medium ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div className={`w-16 h-[2px] mx-3 mb-5 rounded transition-colors ${stepNum < step ? 'bg-success' : 'bg-muted'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Form card */}
          <div className="bg-card rounded-2xl border border-border/50 shadow-lg overflow-hidden">
            <div className="p-6 md:p-8 border-b border-border/50 bg-muted/20">
              <h2 className="font-display font-semibold text-lg">
                {stepInfo[step - 1].desc}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Step {step} of 3
              </p>
            </div>

            <div className="p-6 md:p-8">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label htmlFor="fullName" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full Name (as per ID)</Label>
                          <Input id="fullName" placeholder="John Doe" {...register('fullName')} className={`mt-2 h-12 rounded-xl ${errors.fullName ? 'border-destructive' : ''}`} />
                          {errors.fullName && <p className="text-xs text-destructive mt-1.5">{errors.fullName.message}</p>}
                        </div>
                        <div>
                          <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email Address</Label>
                          <Input id="email" type="email" placeholder="john@example.com" {...register('email')} className={`mt-2 h-12 rounded-xl ${errors.email ? 'border-destructive' : ''}`} />
                          {errors.email && <p className="text-xs text-destructive mt-1.5">{errors.email.message}</p>}
                        </div>
                        <div>
                          <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone Number</Label>
                          <Input id="phone" placeholder="0712345678" {...register('phone')} className={`mt-2 h-12 rounded-xl ${errors.phone ? 'border-destructive' : ''}`} />
                          {errors.phone && <p className="text-xs text-destructive mt-1.5">{errors.phone.message}</p>}
                        </div>
                        <div>
                          <Label htmlFor="idNumber" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">National ID Number</Label>
                          <Input id="idNumber" placeholder="12345678" {...register('idNumber')} className={`mt-2 h-12 rounded-xl ${errors.idNumber ? 'border-destructive' : ''}`} />
                          {errors.idNumber && <p className="text-xs text-destructive mt-1.5">{errors.idNumber.message}</p>}
                        </div>
                        <div>
                          <Label htmlFor="dateOfBirth" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</Label>
                          <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} className={`mt-2 h-12 rounded-xl ${errors.dateOfBirth ? 'border-destructive' : ''}`} />
                          {errors.dateOfBirth && <p className="text-xs text-destructive mt-1.5">{errors.dateOfBirth.message}</p>}
                        </div>
                      </div>
                      <Button type="button" variant="gold" className="w-full mt-6 h-12 text-base" onClick={() => setStep(2)}>
                        Continue
                        <ArrowRight size={18} />
                      </Button>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                          <Label htmlFor="county" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">County</Label>
                          <Select onValueChange={(value) => setValue('county', value)}>
                            <SelectTrigger className={`mt-2 h-12 rounded-xl ${errors.county ? 'border-destructive' : ''}`}>
                              <SelectValue placeholder="Select county" />
                            </SelectTrigger>
                            <SelectContent>
                              {kenyaCounties.map((county) => (
                                <SelectItem key={county} value={county}>{county}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.county && <p className="text-xs text-destructive mt-1.5">{errors.county.message}</p>}
                        </div>
                        <div>
                          <Label htmlFor="subCounty" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sub-County</Label>
                          <Input id="subCounty" placeholder="Enter sub-county" {...register('subCounty')} className={`mt-2 h-12 rounded-xl ${errors.subCounty ? 'border-destructive' : ''}`} />
                          {errors.subCounty && <p className="text-xs text-destructive mt-1.5">{errors.subCounty.message}</p>}
                        </div>
                        <div>
                          <Label htmlFor="ward" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ward</Label>
                          <Input id="ward" placeholder="Enter ward" {...register('ward')} className={`mt-2 h-12 rounded-xl ${errors.ward ? 'border-destructive' : ''}`} />
                          {errors.ward && <p className="text-xs text-destructive mt-1.5">{errors.ward.message}</p>}
                        </div>
                        <div>
                          <Label htmlFor="address" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Physical Address</Label>
                          <Input id="address" placeholder="Street, Building, etc." {...register('address')} className={`mt-2 h-12 rounded-xl ${errors.address ? 'border-destructive' : ''}`} />
                          {errors.address && <p className="text-xs text-destructive mt-1.5">{errors.address.message}</p>}
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setStep(1)}>
                          <ArrowLeft size={16} />
                          Back
                        </Button>
                        <Button type="button" variant="gold" className="flex-1 h-12 text-base" onClick={() => setStep(3)}>
                          Continue
                          <ArrowRight size={18} />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
                      <div className="space-y-5">
                        <div>
                          <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Password</Label>
                          <div className="relative mt-2">
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Create a strong password"
                              {...register('password')}
                              className={`h-12 rounded-xl ${errors.password ? 'border-destructive pr-10' : 'pr-10'}`}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          {errors.password && <p className="text-xs text-destructive mt-1.5">{errors.password.message}</p>}
                        </div>
                        <div>
                          <Label htmlFor="confirmPassword" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Confirm Password</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Confirm your password"
                            {...register('confirmPassword')}
                            className={`mt-2 h-12 rounded-xl ${errors.confirmPassword ? 'border-destructive' : ''}`}
                          />
                          {errors.confirmPassword && <p className="text-xs text-destructive mt-1.5">{errors.confirmPassword.message}</p>}
                        </div>
                      </div>
                      <div className="flex gap-3 mt-6">
                        <Button type="button" variant="outline" className="flex-1 h-12" onClick={() => setStep(2)}>
                          <ArrowLeft size={16} />
                          Back
                        </Button>
                        <Button type="submit" variant="gold" className="flex-1 h-12 text-base" disabled={isLoading}>
                          {isLoading ? (
                            <>
                              <Loader2 className="animate-spin" size={18} />
                              Creating...
                            </>
                          ) : (
                            <>
                              Create Account
                              <ArrowRight size={18} />
                            </>
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
