import { Ban, MessageSquare } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';

export function AccountDisabledBanner() {
  const { profile, user } = useAuth();
  const [requesting, setRequesting] = useState(false);

  if (!profile || profile.is_active !== false) return null;

  const handleRequestReview = async () => {
    if (!user) return;
    setRequesting(true);
    try {
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '📋 Review Requested',
        message: `You have requested an account review. An admin will look into your case shortly.`,
      });
      // Notify admins
      const { data: admins } = await supabase.from('user_roles').select('user_id').eq('role', 'admin');
      if (admins) {
        await supabase.from('notifications').insert(
          admins.map(a => ({
            user_id: a.user_id,
            title: '📋 Account Review Request',
            message: `${profile.full_name} (${profile.phone}) has requested an account review. Disable reason: ${profile.disable_reason || 'N/A'}`,
          }))
        );
      }
      toast.success('Review request sent. Admin will review your account.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to request review');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Card className="border-destructive/30 bg-destructive/5 mx-4 mt-4 lg:mx-8">
      <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0">
          <Ban className="text-destructive" size={22} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm text-destructive">Account Disabled</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {profile.disable_reason || 'Your account has been disabled by an administrator.'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Contact admin: WhatsApp/Call <a href="tel:+254725336731" className="text-primary font-medium">+254 725 336 731</a>
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRequestReview}
          disabled={requesting}
          className="border-destructive/30 text-destructive hover:bg-destructive/10"
        >
          <MessageSquare size={14} /> Request Review
        </Button>
      </CardContent>
    </Card>
  );
}
