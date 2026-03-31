import { useState, useEffect } from 'react';

let deferredPrompt: any = null;

export function useInstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setCanInstall(false);
      deferredPrompt = null;
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
    return outcome === 'accepted';
  };

  return { canInstall, isInstalled, promptInstall };
}

const INSTALL_TOAST_KEY = 'datavend-install-toast-last';
const TOAST_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export function shouldShowInstallToast(): boolean {
  if (window.matchMedia('(display-mode: standalone)').matches) return false;
  try {
    const last = localStorage.getItem(INSTALL_TOAST_KEY);
    if (last && Date.now() - Number(last) < TOAST_INTERVAL_MS) return false;
  } catch {}
  return true;
}

export function markInstallToastShown() {
  try { localStorage.setItem(INSTALL_TOAST_KEY, String(Date.now())); } catch {}
}
