import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { playNotificationSound } from '@/lib/notification-sound';
import { toast } from 'sonner';

/**
 * Request browser notification permission on mount.
 */
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/**
 * Show a native browser/phone notification bar alert.
 */
function showNativeNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      // Use service worker registration for PWA support
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body,
            icon: '/pwa-192.png',
            badge: '/pwa-192.png',
            tag: `datavend-${Date.now()}`,
          } as NotificationOptions);
        });
      } else {
        // Fallback to regular Notification API
        new Notification(title, {
          body,
          icon: '/pwa-192.png',
        });
      }
    } catch {
      // Notification API not fully available
    }
  }
}

/**
 * Global realtime listener for new notifications.
 * Mount once in App or DashboardLayout.
 * - Plays selected notification sound
 * - Shows in-app toast
 * - Shows native phone/browser notification
 */
export function useNotificationListener() {
  const { user } = useAuth();

  // Request permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('global-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const n = payload.new as any;
          // Play selected sound
          playNotificationSound();
          // In-app toast
          toast.info(n.title, { description: n.message?.slice(0, 80) });
          // Native phone notification bar
          showNativeNotification(n.title, n.message || '');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
