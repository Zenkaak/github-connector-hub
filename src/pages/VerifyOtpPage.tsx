import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const phone = location.state?.phone || '';
  
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { phone, otp },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Phone number verified successfully!');
        navigate('/dashboard', { replace: true });
      } else {
        toast.error(data.message || 'Invalid OTP');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast.error(error.message || 'Failed to verify OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.functions.invoke('send-otp', {
        body: { phone },
      });

      if (error) throw error;

      toast.success('OTP resent successfully!');
    } catch (error: any) {
      console.error('Resend error:', error);
      toast.error(error.message || 'Failed to resend OTP');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-navy-50 via-background to-gold-50/30 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="inline-block mb-6">
            <Logo size="lg" />
          </Link>
          <h1 className="font-display text-3xl font-bold text-primary mb-2">
            Verify Your Phone
          </h1>
          <p className="text-muted-foreground">
            We've sent a 6-digit code to{' '}
            <span className="font-semibold text-foreground">{phone}</span>
          </p>
        </div>

        <Card className="premium-card">
          <CardHeader className="text-center">
            <CardTitle>Enter Verification Code</CardTitle>
            <CardDescription>
              Please enter the OTP sent to your phone
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value)}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              variant="gold"
              className="w-full"
              onClick={handleVerify}
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  Verifying...
                </>
              ) : (
                'Verify OTP'
              )}
            </Button>

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Didn't receive the code?
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResend}
                disabled={isResending}
              >
                {isResending ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Sending...
                  </>
                ) : (
                  <>
                    <RefreshCw size={14} />
                    Resend OTP
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Wrong number?{' '}
          <Link to="/signup" className="text-primary font-semibold hover:underline">
            Go back
          </Link>
        </p>
      </div>
    </div>
  );
}
