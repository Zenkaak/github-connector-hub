import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlatformSettings {
  [key: string]: string;
}

interface PlatformSettingsContextType {
  settings: PlatformSettings;
  loading: boolean;
  getSetting: (key: string, defaultValue?: string) => string;
  isEnabled: (key: string) => boolean;
  getNumber: (key: string, defaultValue?: number) => number;
  refresh: () => Promise<void>;
}

const PlatformSettingsContext = createContext<PlatformSettingsContextType | undefined>(undefined);

export function PlatformSettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<PlatformSettings>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('platform_settings' as any)
        .select('key, value');
      if (data) {
        const map: PlatformSettings = {};
        (data as any[]).forEach((s: any) => { map[s.key] = s.value; });
        setSettings(map);
      }
    } catch (err) {
      console.error('Failed to load platform settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getSetting = useCallback((key: string, defaultValue = '') => {
    return settings[key] ?? defaultValue;
  }, [settings]);

  const isEnabled = useCallback((key: string) => {
    return settings[key] !== 'false';
  }, [settings]);

  const getNumber = useCallback((key: string, defaultValue = 0) => {
    const val = settings[key];
    if (!val) return defaultValue;
    const num = Number(val);
    return isNaN(num) ? defaultValue : num;
  }, [settings]);

  return (
    <PlatformSettingsContext.Provider value={{ settings, loading, getSetting, isEnabled, getNumber, refresh: fetchSettings }}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}

export function usePlatformSettings() {
  const context = useContext(PlatformSettingsContext);
  if (!context) {
    // Return safe defaults if used outside provider
    return {
      settings: {},
      loading: false,
      getSetting: (_key: string, defaultValue = '') => defaultValue,
      isEnabled: (_key: string) => true,
      getNumber: (_key: string, defaultValue = 0) => defaultValue,
      refresh: async () => {},
    };
  }
  return context;
}
