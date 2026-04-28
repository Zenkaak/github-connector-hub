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
    toast.error(`Account Disabled: ${profileCheck.disable_reason || 'Contact support.'}`);  
    setIsLoading(false);  
    return;  
  }  

  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password: data.password });  
  if (error) throw error;  
  if (!authData.user) throw new Error('Login failed');  

  toast.success('Welcome back!');  

  await redirectAfterAuth(authData.user.id);  
} catch (error: any) {  
  toast.error(error.message || 'Failed to sign in');  
} finally {  
  setIsLoading(false);  
}

};

const handlePinLogin = async (e: React.FormEvent) => {
e.preventDefault();
if (pin.length !== 4 || !pinIdentifier.trim()) return;
setIsLoading(true);
try {
const { data, error } = await supabase.functions.invoke('pin-login', { body: { identifier: pinIdentifier, pin } });
if (error) throw error;

const { email, token_hash } = data;  
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
if (!result) return toast.error('Fingerprint failed');

const { email, password } = result;  
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });  
  if (error) throw error;  

  toast.success('Welcome back!');  
  await redirectAfterAuth(authData.user.id);  
} catch {  
  toast.error('Fingerprint login failed');  
} finally {  
  setFingerprintLoading(false);  
}

};

return (
<div className="min-h-screen flex bg-[#F4F6F8]">

{/* LEFT PANEL */}
<div className="hidden lg:flex lg:w-[45%] bg-[#0B1220] text-white p-10 flex-col justify-between">
  <Logo variant="white" size="lg" />
  <div>
    <h2 className="text-3xl font-bold">
      Welcome back<br />
      <span className="text-[#FFB800]">Dasnet Ventures</span>
    </h2>
    <p className="text-white/60 mt-4">
      Securely manage your wallet, loans and groups.
    </p>
  </div>
</div>

{/* RIGHT PANEL */}
<div className="flex-1 flex items-center justify-center px-4">

<motion.div className="w-full max-w-md">

<div className="text-center mb-6">
  <Logo size="lg" />
  <h1 className="text-2xl font-bold mt-4 text-[#0B1220]">Sign In</h1>
</div>

<div className="bg-white p-6 rounded-2xl border border-gray-200">

{mode === 'password' && (
<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

<Input
  placeholder="Email or Phone"
  {...register('identifier')}
  className="h-12 rounded-xl bg-[#0B1220] text-white border-none"
/>

<div className="relative">
  <Input
    type={showPassword ? 'text' : 'password'}
    placeholder="Password"
    {...register('password')}
    className="h-12 rounded-xl bg-[#0B1220] text-white border-none pr-10"
  />
  <button type="button"
    onClick={() => setShowPassword(!showPassword)}
    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
  </button>
</div>

<Button className="w-full h-12 bg-[#FFB800] text-black font-semibold">
{isLoading ? <Loader2 className="animate-spin"/> : "Sign In"}
</Button>

</form>
)}

</div>

</motion.div>
</div>
</div>
);
         }
