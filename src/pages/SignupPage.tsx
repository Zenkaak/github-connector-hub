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

  // Check if registration is globally enabled via the Platform Settings Context
  if (!isEnabled('new_registrations_enabled')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <Logo size="lg" />
          </div>
          <FeatureDisabled 
            title="Registration Closed" 
            message="New account registrations are currently paused. Please check back later or contact support if you believe this is an error." 
          />
          <div className="text-center mt-4">
            <Link to="/auth" className="text-sm text-accent hover:underline font-medium">
              Already have an account? Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      idType: 'national_id'
    }
  });

  // Watch ID type to change placeholder/validation hints dynamically
  const selectedIdType = watch('idType');

  // Handle validation specifically for each step before allowing the user to proceed
  const nextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) {
      fieldsToValidate = ['fullName', 'email', 'phone', 'idNumber', 'dateOfBirth'];
    } else if (step === 2) {
      fieldsToValidate = ['county', 'subCounty', 'ward', 'address'];
    }

    const result = await trigger(fieldsToValidate as any);
    if (result) {
      setStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setStep((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      // 1. Standardize the Phone Number format to E.164
      let phone = data.phone;
      if (phone.startsWith('0')) phone = '+254' + phone.slice(1);
      else if (!phone.startsWith('+')) phone = '+254' + phone;

      // 2. Manual Defensive Check: Verify uniqueness before Auth attempt
      // This prevents "Ghost Users" in Auth who don't have a Profile row
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('phone, email, id_number')
        .or(`phone.eq.${phone},email.eq.${data.email},id_number.eq.${data.idNumber}`)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingProfile) {
        if (existingProfile.email === data.email) toast.error('Email address is already in use.');
        else if (existingProfile.phone === phone) toast.error('Phone number is already registered.');
        else if (existingProfile.id_number === data.idNumber) toast.error('ID number is already in use.');
        
        navigate('/auth');
        return;
      }

      // 3. Create the Authentication Account
      // We pack EVERY detail into options.data so the DB Trigger can create the 
      // profile row with security-definer privileges.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            phone: phone,
            county: data.county,
            sub_county: data.subCounty,
            ward: data.ward,
            address: data.address,
            id_number: data.idNumber,
            date_of_birth: data.dateOfBirth,
          },
        },
      });

      if (authError) {
        if (authError.message?.includes('already registered')) {
          toast.error('This email is already registered. Please login.');
          navigate('/auth');
          return;
        }
        throw authError;
      }

      if (authData.user) {
        // 4. Manual Fallback Upsert (Frontend Backup)
        // This ensures the data is saved even if the trigger has a slight delay.
        // We use .upsert to avoid conflict errors.
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            user_id: authData.user.id,
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
            disable_reason: 'none',
          }, {
            onConflict: 'user_id'
          });

        // 5. Assign default user role
        await supabase.from('user_roles').upsert({
          user_id: authData.user.id,
          role: 'user',
        }, { onConflict: 'user_id' });

        toast.success('Account created successfully! Welcome to DASNET VENTURES.');
        
        // Give the DB a moment to index before moving to dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 1500);
      }
    } catch (error: any) {
      console.error('Signup error details:', error);
      toast.error(error.message || 'Failed to create account. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      {/* Navigation Bar */}
      <div className="h-16 border-b border-border/50 flex items-center justify-between px-4 md:px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <Link to="/" className="flex items-center">
          <Logo size="md" />
        </Link>
        <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Already have an account? <span className="font-semibold text-accent">Sign In</span>
        </Link>
      </div>

      <div className="flex-1 flex items-start justify-center py-10 px-4">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Page Header */}
          <div className="text-center mb-10">
            <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-3">
              Create Your Account
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
              Join DASNET VENTURES today and start managing your savings, chama, and loans with ease.
            </p>
          </div>

          {/* Detailed Stepper Component */}
          <div className="flex items-center justify-center gap-0 mb-10 overflow-hidden">
            {stepInfo.map((s, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === step;
              const isCompleted = stepNum < step;
              return (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                        isCompleted
                          ? 'bg-success text-success-foreground scale-95 opacity-80'
                          : isActive
                          ? 'bg-primary text-primary-foreground shadow-xl ring-4 ring-primary/10'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {isCompleted ? <CheckCircle size={20} /> : <s.icon size={20} />}
                    </div>
                    <span className={`text-[10px] md:text-[11px] mt-2 font-bold uppercase tracking-wider ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div className={`w-16 md:w-24 h-[3px] mx-2 mb-6 rounded-full transition-all duration-700 ${stepNum < step ? 'bg-success' : 'bg-muted'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Main Form Card */}
          <div className="bg-card rounded-[2rem] border border-border/50 shadow-2xl overflow-hidden mb-12">
            <div className="p-6 md:p-10 border-b border-border/50 bg-muted/20">
              <h2 className="font-display font-semibold text-xl text-foreground">
                {stepInfo[step - 1].desc}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Step {step} of 3 — Complete all fields to proceed
              </p>
            </div>

            <div className="p-6 md:p-10">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <AnimatePresence mode="wait">
                  
                  {/* STEP 1: Personal Details */}
                  {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label htmlFor="fullName" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Full Name (as per ID Card)</Label>
                          <Input id="fullName" placeholder="Enter your official full name" {...register('fullName')} className="mt-2 h-14 rounded-2xl bg-muted/30 border-none focus-visible:ring-2" />
                          {errors.fullName && <p className="text-xs text-destructive mt-2 ml-1 font-medium">{errors.fullName.message}</p>}
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Email Address</Label>
                          <Input id="email" type="email" placeholder="e.g., timothy@example.com" {...register('email')} className="h-14 rounded-2xl bg-muted/30 border-none" />
                          {errors.email && <p className="text-xs text-destructive mt-1 ml-1 font-medium">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">M-Pesa Number</Label>
                          <Input id="phone" placeholder="0712345678" {...register('phone')} className="h-14 rounded-2xl bg-muted/30 border-none" />
                          {errors.phone && <p className="text-xs text-destructive mt-1 ml-1 font-medium">{errors.phone.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="idType" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">ID Document Type</Label>
                          <Select onValueChange={(value) => setValue('idType', value as any)} defaultValue="national_id">
                            <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-none">
                              <SelectValue placeholder="Select ID Type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="national_id">National ID</SelectItem>
                              <SelectItem value="maisha_card">Maisha Card</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="idNumber" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">
                            {selectedIdType === 'maisha_card' ? 'Maisha Card Number' : 'National ID Number'}
                          </Label>
                          <Input 
                            id="idNumber" 
                            placeholder={selectedIdType === 'maisha_card' ? "8 or 9 digits" : "8 digits"} 
                            {...register('idNumber')} 
                            className="h-14 rounded-2xl bg-muted/30 border-none" 
                          />
                          {errors.idNumber && <p className="text-xs text-destructive mt-1 ml-1 font-medium">{errors.idNumber.message}</p>}
                        </div>

                        <div className="sm:col-span-2 space-y-2">
                          <Label htmlFor="dateOfBirth" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Date of Birth</Label>
                          <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} className="h-14 rounded-2xl bg-muted/30 border-none" />
                          {errors.dateOfBirth && <p className="text-xs text-destructive mt-1 ml-1 font-medium">{errors.dateOfBirth.message}</p>}
                        </div>
                      </div>
                      
                      <Button type="button" variant="gold" className="w-full mt-4 h-14 rounded-2xl text-base font-bold shadow-lg" onClick={nextStep}>
                        Continue to Location
                        <ArrowRight size={20} className="ml-2" />
                      </Button>
                    </motion.div>
                  )}

                  {/* STEP 2: Location Details */}
                  {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="county" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">County of Residence</Label>
                          <Select onValueChange={(value) => setValue('county', value)}>
                            <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-none">
                              <SelectValue placeholder="Select county" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {kenyaCounties.map((county) => (
                                <SelectItem key={county} value={county}>{county}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.county && <p className="text-xs text-destructive mt-1 ml-1 font-medium">{errors.county.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="subCounty" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Sub-County</Label>
                          <Input id="subCounty" placeholder="Enter your sub-county" {...register('subCounty')} className="h-14 rounded-2xl bg-muted/30 border-none" />
                          {errors.subCounty && <p className="text-xs text-destructive mt-1 ml-1 font-medium">{errors.subCounty.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="ward" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Ward</Label>
                          <Input id="ward" placeholder="Enter your ward" {...register('ward')} className="h-14 rounded-2xl bg-muted/30 border-none" />
                          {errors.ward && <p className="text-xs text-destructive mt-1 ml-1 font-medium">{errors.ward.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="address" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Physical Address</Label>
                          <Input id="address" placeholder="e.g., Street, House No, or Landmark" {...register('address')} className="h-14 rounded-2xl bg-muted/30 border-none" />
                          {errors.address && <p className="text-xs text-destructive mt-1 ml-1 font-medium">{errors.address.message}</p>}
                        </div>
                      </div>

                      <div className="flex gap-4 mt-4">
                        <Button type="button" variant="outline" className="flex-1 h-14 rounded-2xl font-bold border-muted-foreground/20" onClick={prevStep}>
                          <ArrowLeft size={18} className="mr-2" />
                          Back
                        </Button>
                        <Button type="button" variant="gold" className="flex-[2] h-14 rounded-2xl font-bold shadow-lg" onClick={nextStep}>
                          Continue to Security
                          <ArrowRight size={20} className="ml-2" />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3: Security Details */}
                  {step === 3 && (
                    <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Account Password</Label>
                          <div className="relative">
                            <Input
                              id="password"
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Create a strong password"
                              {...register('password')}
                              className="h-14 rounded-2xl pr-12 bg-muted/30 border-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                          {errors.password && <p className="text-xs text-destructive mt-1 ml-1 font-medium">{errors.password.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword" className="text-xs font-bold text-muted-foreground uppercase tracking-widest ml-1">Confirm Password</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Repeat your password"
                            {...register('confirmPassword')}
                            className="h-14 rounded-2xl bg-muted/30 border-none"
                          />
                          {errors.confirmPassword && <p className="text-xs text-destructive mt-1 ml-1 font-medium">{errors.confirmPassword.message}</p>}
                        </div>
                      </div>

                      <div className="flex gap-4 mt-4">
                        <Button type="button" variant="outline" className="flex-1 h-14 rounded-2xl font-bold border-muted-foreground/20" onClick={prevStep} disabled={isLoading}>
                          Back
                        </Button>
                        <Button type="submit" variant="gold" className="flex-[2] h-14 rounded-2xl font-bold shadow-xl shadow-primary/20" disabled={isLoading}>
                          {isLoading ? (
                            <>
                              <Loader2 className="animate-spin mr-2" size={20} />
                              Creating Account...
                            </>
                          ) : (
                            <>
                              Complete Registration
                              <ArrowRight size={20} className="ml-2" />
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
          
          <div className="text-center px-6">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              By creating an account, you agree to DATAVEND VENTURES' 
              <Link to="/terms" className="text-accent font-semibold px-1 hover:underline">Terms of Service</Link> 
              and 
              <Link to="/privacy" className="text-accent font-semibold px-1 hover:underline">Privacy Policy</Link>.
            </p>
          </div>
        </motion.div>
      </div>

      <footer className="py-8 border-t border-border/40 text-center bg-card/20">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
          &copy; {new Date().getFullYear()} DASNET VENTURES. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
 
