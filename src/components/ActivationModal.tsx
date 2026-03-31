import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Smartphone, Shield, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { stkPushSchema, StkPushFormData } from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface ActivationModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ActivationModal({ open, onClose, onSuccess }: ActivationModalProps) {
  const { profile, user } = useAuth();
  const { getNumber } = usePlatformSettings();
  const activationFee = getNumber('activation_fee', 349);
  const [step, setStep] = useState<'form' | 'processing' | 'success' | 'failed'>('form');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<StkPushFormData>({
    resolver: zodResolver(stkPushSchema),
    defaultValues: {
      phone: profile?.phone?.replace('+254', '0') || '',
    },
  });

  const onSubmit = async (data: StkPushFormData) => {
    setIsLoading(true);
    setStep('processing');

    try {
      // Format phone to +254
      let phone = data.phone;
      if (phone.startsWith('0')) {
        phone = '+254' + phone.slice(1);
      } else if (!phone.startsWith('+')) {
        phone = '+254' + phone;
      }

      // Initiate STK Push
      const { data: stkData, error: stkError } = await supabase.functions.invoke('initiate-stk-push', {
        body: {
          phone,
          amount: activationFee,
          userId: user?.id,
        },
      });

      if (stkError) throw stkError;

      if (stkData.success) {
        // Poll for payment status
        const pollStatus = async (attempts = 0): Promise<boolean> => {
          if (attempts >= 30) {
            throw new Error('Payment timeout');
          }

          await new Promise((resolve) => setTimeout(resolve, 3000));

          const { data: statusData, error: statusError } = await supabase.functions.invoke(
            'check-stk-status',
            {
              body: { reference: stkData.reference },
            }
          );

          if (statusError) throw statusError;

          if (statusData.status === 'success') {
            return true;
          } else if (statusData.status === 'failed') {
            throw new Error(statusData.message || 'Payment failed');
          }

          return pollStatus(attempts + 1);
        };

        const success = await pollStatus();
        if (success) {
          setStep('success');
          toast.success('Account activated successfully!');
          setTimeout(() => {
            onSuccess();
          }, 2000);
        }
      } else {
        throw new Error(stkData.message || 'Failed to initiate payment');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setStep('failed');
      toast.error(error.message || 'Payment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setStep('form');
    reset();
  };

  const handleClose = () => {
    setStep('form');
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="text-accent" size={24} />
            Loan Activation Fee
          </DialogTitle>
          <DialogDescription>
            Pay a one-time fee of KES {activationFee.toLocaleString()} to activate loan services and submit your application.
          </DialogDescription>
        </DialogHeader>

        {step === 'form' && (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground mb-1">Activation Fee</p>
              <p className="text-3xl font-bold text-primary">KES {activationFee.toLocaleString()}</p>
            </div>

            <div>
              <Label htmlFor="phone">M-Pesa Phone Number</Label>
              <div className="relative">
                <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="phone"
                  placeholder="0712345678"
                  className="pl-10"
                  {...register('phone')}
                />
              </div>
              {errors.phone && (
                <p className="text-sm text-destructive mt-1">{errors.phone.message}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                You will receive an STK push on this number
              </p>
            </div>

            <Button type="submit" variant="gold" className="w-full" disabled={isLoading}>
              Pay with M-Pesa
            </Button>
          </form>
        )}

        {step === 'processing' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-accent/10 flex items-center justify-center">
              <Loader2 className="animate-spin text-accent" size={32} />
            </div>
            <h3 className="font-semibold text-lg mb-2">Processing Payment</h3>
            <p className="text-muted-foreground text-sm">
              Please check your phone and enter your M-Pesa PIN to complete the payment.
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center animate-scale-in">
              <CheckCircle className="text-success" size={32} />
            </div>
            <h3 className="font-semibold text-lg mb-2">Account Activated!</h3>
            <p className="text-muted-foreground text-sm">
              Your account is now active. You can start applying for loans.
            </p>
          </div>
        )}

        {step === 'failed' && (
          <div className="py-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <Shield className="text-destructive" size={32} />
            </div>
            <h3 className="font-semibold text-lg mb-2">Payment Failed</h3>
            <p className="text-muted-foreground text-sm mb-4">
              The payment could not be completed. Please try again.
            </p>
            <Button variant="gold" onClick={handleRetry}>
              Retry Payment
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
