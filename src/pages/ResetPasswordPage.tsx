import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

// This page handles the legacy email link redirect.
// If user clicks a reset link from email, we detect the recovery event
// and redirect to forgot-password page for the new OTP flow.
export default function ResetPasswordPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked a legacy reset link — they're now authenticated
        // Redirect to forgot-password page at password step
        navigate('/forgot-password', { state: { fromResetLink: true } });
      }
    });

    // If no recovery event fires within 3 seconds, redirect to forgot-password
    const timeout = setTimeout(() => {
      navigate('/forgot-password');
    }, 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Redirecting...</p>
    </div>
  );
}
