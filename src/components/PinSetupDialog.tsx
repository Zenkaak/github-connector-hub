import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PinPad } from '@/components/PinPad';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Lock, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

export function PinSetupDialog({ open, onClose, onCompleted }: Props) {
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [saving, setSaving] = useState(false);

  const handleCreate = () => {
    if (pin.length !== 4) return toast.error('PIN must be 4 digits');
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (confirmPin !== pin) {
      toast.error('PINs don\'t match');
      setConfirmPin('');
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('set_user_pin' as any, { _pin: pin });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('PIN set successfully');
    try { localStorage.setItem('hasPin', '1'); } catch {}
    onCompleted?.();
    onClose();
    setPin(''); setConfirmPin(''); setStep('create');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-3">
            <Lock className="text-accent" size={26} />
          </div>
          <DialogTitle className="text-center">
            {step === 'create' ? 'Create your 4-digit PIN' : 'Confirm your PIN'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {step === 'create'
              ? 'Use this PIN for fast, secure sign-in. You can still use your password anytime.'
              : 'Enter the same PIN again to confirm.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {step === 'create' ? (
            <PinPad value={pin} onChange={setPin} autoFocus />
          ) : (
            <PinPad value={confirmPin} onChange={setConfirmPin} autoFocus error={confirmPin.length === 4 && confirmPin !== pin} />
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Skip for now</Button>
          {step === 'create' ? (
            <Button variant="gold" onClick={handleCreate} disabled={pin.length !== 4}>Continue</Button>
          ) : (
            <Button variant="gold" onClick={handleConfirm} disabled={confirmPin.length !== 4 || saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : 'Save PIN'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
