import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type AppSettings = {
  approveImagesBeforeAI: boolean;
  localStorageOnly: boolean;
  voiceDataProcessingEnabled: boolean;
  voiceFirstMode: boolean;
  highContrastMode: boolean;
  audioDescriptionsEnabled: boolean;
  largerTextEnabled: boolean;
};

type AppSettingsContextType = AppSettings & {
  settingsLoaded: boolean;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => Promise<void>;
};

const SETTINGS_KEY = 'app_settings_v1';

const defaultSettings: AppSettings = {
  approveImagesBeforeAI: true,
  localStorageOnly: false,
  voiceDataProcessingEnabled: true,
  voiceFirstMode: true,
  highContrastMode: false,
  audioDescriptionsEnabled: true,
  largerTextEnabled: false,
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(
  undefined
);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);

        if (raw) {
          const parsed = JSON.parse(raw);
          setSettings({
            ...defaultSettings,
            ...parsed,
          });
        }
      } catch (error) {
        console.error('Failed to load app settings:', error);
      } finally {
        setSettingsLoaded(true);
      }
    };

    loadSettings();
  }, []);

  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const updated = {
      ...settings,
      [key]: value,
    };

    setSettings(updated);

    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save app settings:', error);
    }
  };

  const value = useMemo(
    () => ({
      ...settings,
      settingsLoaded,
      updateSetting,
    }),
    [settings, settingsLoaded]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);

  if (!context) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider');
  }

  return context;
}