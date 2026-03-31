import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function useInactivityTimeout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogout = useCallback(async () => {
    if (!user) return;
    await signOut();
    toast.info('You have been logged out due to inactivity.');
    navigate('/auth');
  }, [user, signOut, navigate]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (user) {
      timerRef.current = setTimeout(handleLogout, TIMEOUT_MS);
    }
  }, [user, handleLogout]);

  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, resetTimer]);
}
