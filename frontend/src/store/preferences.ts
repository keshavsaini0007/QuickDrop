import { create } from 'zustand';
import type { ThemeMode } from '@/theme/tokens';
import { getJson, setJson } from '@/lib/storage';

const PREFERENCES_KEY = 'qd_preferences';

interface StoredPreferences {
  themeMode: ThemeMode;
  notificationsEnabled: boolean;
  biometricEnabled: boolean;
}

interface PreferencesState extends StoredPreferences {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
}

const defaults: StoredPreferences = {
  themeMode: 'system',
  notificationsEnabled: true,
  biometricEnabled: false,
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

export const usePreferencesStore = create<PreferencesState>((set, get) => {
  const persist = async () => {
    const state = get();
    await setJson(PREFERENCES_KEY, {
      themeMode: state.themeMode,
      notificationsEnabled: state.notificationsEnabled,
      biometricEnabled: state.biometricEnabled,
    } satisfies StoredPreferences);
  };

  return {
    ...defaults,
    hydrated: false,

    hydrate: async () => {
      if (get().hydrated) return;
      let stored: Partial<StoredPreferences> | null = null;
      try {
        stored = await getJson<Partial<StoredPreferences>>(PREFERENCES_KEY);
      } catch {
        // Fall back to defaults if the device store cannot be read.
      }
      set({
        themeMode: isThemeMode(stored?.themeMode) ? stored.themeMode : defaults.themeMode,
        notificationsEnabled:
          typeof stored?.notificationsEnabled === 'boolean'
            ? stored.notificationsEnabled
            : defaults.notificationsEnabled,
        biometricEnabled:
          typeof stored?.biometricEnabled === 'boolean'
            ? stored.biometricEnabled
            : defaults.biometricEnabled,
        hydrated: true,
      });
    },

    setThemeMode: async (themeMode) => {
      set({ themeMode });
      await persist();
    },

    setNotificationsEnabled: async (notificationsEnabled) => {
      set({ notificationsEnabled });
      await persist();
    },

    setBiometricEnabled: async (biometricEnabled) => {
      set({ biometricEnabled });
      await persist();
    },
  };
});
