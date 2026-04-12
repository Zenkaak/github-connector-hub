import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  User, 
  MapPin, 
  Lock, 
  CheckCircle,
  ShieldCheck,
  Smartphone,
  Mail,
  CreditCard,
  Calendar
} from 'lucide-react';
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

  // Check if registration is globally enabled via Context
  if (!isEnabled('new_registrations_enabled')) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <Logo size="lg" />
          </div>
          <FeatureDisabled 
            title="Registration Paused" 
            message="We are currently not accepting new account registrations. Please check back later or contact our support team for assistance." 
          />
          <div className="text-center mt-6">
            <Link to="/auth" className="text-sm font-semibold text-accent hover:underline flex items-center justify-center gap-2">
              <ArrowLeft size={14} /> Already have an account? Sign In
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

  // Manual step validation before proceeding
  const handleNextStep = async () => {
    let fieldsToValidate: any[] = [];
    if (step === 1) {
      fieldsToValidate = ['fullName', 'email', 'phone', 'idNumber', 'dateOfBirth'];
    } else if (step === 2) {
      fieldsToValidate = ['county', 'subCounty', 'ward', 'address'];
    }

    const isStepValid = await trigger(fieldsToValidate as any);
    if (isStepValid) {
      setStep((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      toast.error("Please fix the errors before moving to the next step.");
    }
  };

  const handlePrevStep = () => {
    setStep((prev) => prev - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    try {
      // 1. Standardize Phone Number
      let phone = data.phone;
      if (phone.startsWith('0')) phone = '+254' + phone.slice(1);
      else if (!phone.startsWith('+')) phone = '+254' + phone;

      // 2. Pre-check for Duplicates (Phone, Email, ID)
      const { data: existingUser, error: checkError } = await supabase
        .from('profiles')
        .select('phone, email, id_number')
        .or(`phone.eq.${phone},email.eq.${data.email},id_number.eq.${data.idNumber}`)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingUser) {
        if (existingUser.email === data.email) toast.error('This email is already in use.');
        else if (existingUser.phone === phone) toast.error('This phone number is already registered.');
        else if (existingUser.id_number === data.idNumber) toast.error('This ID number is already registered.');
        
        navigate('/auth');
        return;
      }

      // 3. Create Authentication Account
      // CRITICAL: We pass all data into 'options.data'. This metadata is 
      // accessed by our PostgreSQL Trigger to create the profile safely.
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
        // 4. Redundant Manual Save (Frontend Backup)
        // We attempt a manual upsert in case the DB trigger is disabled or delayed.
        // We catch the 401 error silently here because the trigger handles it anyway.
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

        // 5. Assign User Role
        const { error: roleError } = await supabase.from('user_roles').upsert({
          user_id: authData.user.id,
          role: 'user',
        }, { onConflict: 'user_id' });

        if (roleError) console.error('Role assignment error:', roleError);

        toast.success('Your account has been created successfully!');
        
        // Brief delay to ensure database consistency before redirect
        setTimeout(() => {
          navigate('/dashboard');
        }, 1200);
      }
    } catch (error: any) {
      console.error('Full Signup Error:', error);
      toast.error(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/20">
      {/* Header Navigation */}
      <nav className="h-16 border-b border-border/40 flex items-center justify-between px-6 md:px-12 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <Link to="/" className="hover:opacity-80 transition-opacity">
          <Logo size="md" />
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden md:inline text-sm text-muted-foreground">Existing member?</span>
          <Button variant="ghost" asChild className="text-accent hover:text-accent hover:bg-accent/5 font-bold">
            <Link to="/auth">Sign In</Link>
          </Button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center py-12 px-4">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {/* Header Section */}
          <div className="text-center mb-10">
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground mb-3">
              Start Your Journey
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-md mx-auto">
              Create an account with DASNET VENTURES to access premium financial services and community savings.
            </p>
          </div>

          {/* Multi-Step Indicator */}
          <div className="flex items-center justify-center mb-12 relative">
            <div className="absolute top-5 left-1/2 -translate-x-1/2 w-2/3 h-[2px] bg-muted -z-10" />
            {stepInfo.map((s, i) => {
              const stepNum = i + 1;
              const isActive = stepNum === step;
              const isCompleted = stepNum < step;
              return (
                <div key={i} className="flex flex-col items-center flex-1">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold transition-all duration-500 ${
                      isCompleted
                        ? 'bg-success text-white scale-110 shadow-lg shadow-success/20'
                        : isActive
                        ? 'bg-primary text-primary-foreground scale-110 shadow-xl ring-4 ring-primary/10'
                        : 'bg-card border-2 border-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? <CheckCircle size={22} /> : <s.icon size={20} />}
                  </div>
                  <span className={`text-[10px] md:text-[11px] mt-2.5 font-bold uppercase tracking-widest ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Form Container */}
          <div className="bg-card rounded-[2rem] border border-border/50 shadow-2xl shadow-black/5 overflow-hidden">
            <div className="p-6 md:p-10 border-b border-border/40 bg-muted/10 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {stepInfo[step - 1].desc}
                </h2>
                <p className="text-xs text-muted-foreground mt-1 font-medium">
                  Please provide accurate information for verification.
                </p>
              </div>
              <div className="bg-background/80 p-3 rounded-2xl border border-border/50 hidden sm:block">
                <span className="text-sm font-bold text-primary">Step {step}/3</span>
              </div>
            </div>

            <div className="p-6 md:p-10">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <AnimatePresence mode="wait">
                  
                  {/* STEP 1: PERSONAL INFORMATION */}
                  {step === 1 && (
                    <motion.div 
                      key="step1" 
                      initial={{ opacity: 0, x: 20 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Full Name (As per Identity Document)</Label>
                          <div className="relative mt-2">
                            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input {...register('fullName')} placeholder="e.g. Timothy Cheruiyot" className="h-14 rounded-2xl pl-11 bg-muted/30 border-none focus-visible:ring-2" />
                          </div>
                          {errors.fullName && <p className="text-xs text-destructive mt-2 font-medium ml-1">{errors.fullName.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address</Label>
                          <div className="relative">
                            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input type="email" {...register('email')} placeholder="name@example.com" className="h-14 rounded-2xl pl-11 bg-muted/30 border-none" />
                          </div>
                          {errors.email && <p className="text-xs text-destructive mt-1 font-medium">{errors.email.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">M-Pesa Phone Number</Label>
                          <div className="relative">
                            <Smartphone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input {...register('phone')} placeholder="0712345678" className="h-14 rounded-2xl pl-11 bg-muted/30 border-none" />
                          </div>
                          {errors.phone && <p className="text-xs text-destructive mt-1 font-medium">{errors.phone.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Document Type</Label>
                          <Select onValueChange={(v) => setValue('idType', v as any)} defaultValue="national_id">
                            <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="national_id">National ID Card</SelectItem>
                              <SelectItem value="maisha_card">Maisha Card</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">ID Number</Label>
                          <div className="relative">
                            <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input {...register('idNumber')} placeholder={selectedIdType === 'maisha_card' ? "8 or 9 digits" : "8 digits"} className="h-14 rounded-2xl pl-11 bg-muted/30 border-none" />
                          </div>
                          {errors.idNumber && <p className="text-xs text-destructive mt-1 font-medium">{errors.idNumber.message}</p>}
                        </div>

                        <div className="sm:col-span-2 space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Date of Birth</Label>
                          <div className="relative">
                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input type="date" {...register('dateOfBirth')} className="h-14 rounded-2xl pl-11 bg-muted/30 border-none" />
                          </div>
                          {errors.dateOfBirth && <p className="text-xs text-destructive mt-1 font-medium">{errors.dateOfBirth.message}</p>}
                        </div>
                      </div>

                      <Button type="button" variant="gold" className="w-full h-14 rounded-2xl text-md font-bold shadow-xl shadow-primary/10 group" onClick={handleNextStep}>
                        Continue to Location <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
                      </Button>
                    </motion.div>
                  )}

                  {/* STEP 2: LOCATION DETAILS */}
                  {step === 2 && (
                    <motion.div 
                      key="step2" 
                      initial={{ opacity: 0, x: 20 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">County of Residence</Label>
                          <Select onValueChange={(v) => setValue('county', v)}>
                            <SelectTrigger className="h-14 rounded-2xl bg-muted/30 border-none">
                              <SelectValue placeholder="Select County" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {kenyaCounties.map((c) => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {errors.county && <p className="text-xs text-destructive mt-1">{errors.county.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Sub-County</Label>
                          <Input {...register('subCounty')} placeholder="Enter sub-county" className="h-14 rounded-2xl bg-muted/30 border-none" />
                          {errors.subCounty && <p className="text-xs text-destructive mt-1">{errors.subCounty.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Ward</Label>
                          <Input {...register('ward')} placeholder="Enter ward name" className="h-14 rounded-2xl bg-muted/30 border-none" />
                          {errors.ward && <p className="text-xs text-destructive mt-1">{errors.ward.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Residential Address</Label>
                          <Input {...register('address')} placeholder="Landmark or Street Name" className="h-14 rounded-2xl bg-muted/30 border-none" />
                          {errors.address && <p className="text-xs text-destructive mt-1">{errors.address.message}</p>}
                        </div>
                      </div>

                      <div className="flex gap-4">
                        <Button type="button" variant="outline" className="flex-1 h-14 rounded-2xl font-bold border-muted-foreground/20" onClick={handlePrevStep}>
                          <ArrowLeft className="mr-2" size={18} /> Back
                        </Button>
                        <Button type="button" variant="gold" className="flex-[2] h-14 rounded-2xl font-bold shadow-xl shadow-primary/10" onClick={handleNextStep}>
                          Continue to Security <ArrowRight className="ml-2" size={18} />
                        </Button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3: SECURITY & PASSWORD */}
                  {step === 3 && (
                    <motion.div 
                      key="step3" 
                      initial={{ opacity: 0, x: 20 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="bg-accent/5 p-5 rounded-[1.5rem] border border-accent/10 flex gap-4 items-start mb-6">
                        <ShieldCheck className="text-accent shrink-0 mt-0.5" size={24} />
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-accent">Security Requirement</h4>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Your password must be at least 8 characters long and should contain a mix of uppercase letters, numbers, and symbols for maximum protection.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Choose Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input 
                              type={showPassword ? 'text' : 'password'} 
                              {...register('password')} 
                              placeholder="••••••••" 
                              className="h-14 rounded-2xl pl-11 pr-12 bg-muted/30 border-none" 
                            />
                            <button 
                              type="button" 
                              onClick={() => setShowPassword(!showPassword)} 
                              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                            </button>
                          </div>
                          {errors.password && <p className="text-xs text-destructive mt-1 font-medium">{errors.password.message}</p>}
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Confirm Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                            <Input 
                              type="password" 
                              {...register('confirmPassword')} 
                              placeholder="••••••••" 
                              className="h-14 rounded-2xl pl-11 bg-muted/30 border-none" 
                            />
                          </div>
                          {errors.confirmPassword && <p className="text-xs text-destructive mt-1 font-medium">{errors.confirmPassword.message}</p>}
                        </div>
                      </div>

                      <div className="flex gap-4 pt-4">
                        <Button type="button" variant="outline" className="flex-1 h-14 rounded-2xl font-bold border-muted-foreground/20" onClick={handlePrevStep} disabled={isLoading}>
                          Back
                        </Button>
                        <Button type="submit" variant="gold" className="flex-[2] h-14 rounded-2xl font-bold shadow-2xl shadow-accent/20" disabled={isLoading}>
                          {isLoading ? (
                            <>
                              <Loader2 className="animate-spin mr-2" size={20} /> Finalizing...
                            </>
                          ) : (
                            <>
                              Complete Registration <ArrowRight className="ml-2" size={20} />
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

          <div className="mt-8 text-center">
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              By clicking "Complete Registration", you agree to our 
              <Link to="/terms" className="text-accent font-semibold hover:underline px-1">Terms of Service</Link> 
              and 
              <Link to="/privacy" className="text-accent font-semibold hover:underline px-1">Privacy Policy</Link>.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Simplified Footer */}
      <footer className="py-10 border-t border-border/40 text-center">
        <p className="text-[10px] md:text-xs text-muted-foreground font-bold uppercase tracking-[0.2em]">
          &copy; {new Date().getFullYear()} DATAVEND VENTURES. All Rights Reserved.
        </p>
      </footer>
    </div>
  );
}
 
