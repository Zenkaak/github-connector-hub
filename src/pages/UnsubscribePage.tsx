import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MailX, CheckCircle, AlertTriangle } from 'lucide-react';

type Status = 'loading' | 'valid' | 'already' | 'invalid' | 'success' | 'error';

export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }
    const validate = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        const data = await res.json();
        if (data.valid === false && data.reason === 'already_unsubscribed') {
          setStatus('already');
        } else if (data.valid) {
          setStatus('valid');
        } else {
          setStatus('invalid');
        }
      } catch {
        setStatus('invalid');
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('handle-email-unsubscribe', {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) {
        setStatus('success');
      } else if (data?.reason === 'already_unsubscribed') {
        setStatus('already');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo size="lg" />
        </div>
        <Card className="border-border/50">
          <CardContent className="p-8 text-center space-y-4">
            {status === 'loading' && (
              <>
                <Loader2 className="mx-auto animate-spin text-muted-foreground" size={32} />
                <p className="text-muted-foreground">Verifying...</p>
              </>
            )}
            {status === 'valid' && (
              <>
                <MailX className="mx-auto text-accent" size={40} />
                <h2 className="text-xl font-bold font-display">Unsubscribe</h2>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to unsubscribe from email notifications?
                </p>
                <Button variant="gold" onClick={handleUnsubscribe} disabled={processing} className="w-full">
                  {processing ? <Loader2 className="animate-spin" size={16} /> : null}
                  Confirm Unsubscribe
                </Button>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="mx-auto text-emerald-500" size={40} />
                <h2 className="text-xl font-bold font-display">Unsubscribed</h2>
                <p className="text-sm text-muted-foreground">
                  You have been successfully unsubscribed from email notifications.
                </p>
              </>
            )}
            {status === 'already' && (
              <>
                <CheckCircle className="mx-auto text-muted-foreground" size={40} />
                <h2 className="text-xl font-bold font-display">Already Unsubscribed</h2>
                <p className="text-sm text-muted-foreground">
                  This email is already unsubscribed.
                </p>
              </>
            )}
            {(status === 'invalid' || status === 'error') && (
              <>
                <AlertTriangle className="mx-auto text-destructive" size={40} />
                <h2 className="text-xl font-bold font-display">
                  {status === 'invalid' ? 'Invalid Link' : 'Something Went Wrong'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {status === 'invalid'
                    ? 'This unsubscribe link is invalid or has expired.'
                    : 'Please try again later or contact support.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
