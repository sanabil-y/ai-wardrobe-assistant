// async storage is used so settings stay saved even after app closes
import AsyncStorage from '@react-native-async-storage/async-storage';

// react + hooks for context
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// this is the shape of the actual settings
type AppSettings = {
  approveImagesBeforeAI: boolean;
  localStorageOnly: boolean;
  voiceDataProcessingEnabled: boolean;
  voiceFirstMode: boolean;
  highContrastMode: boolean;
  audioDescriptionsEnabled: boolean;
  largerTextEnabled: boolean;
};

// this is the full context type, so settings + extra functions
type AppSettingsContextType = AppSettings & {
  settingsLoaded: boolean;
  updateSetting: <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => Promise<void>;
};

// key used when saving settings into async storage
const SETTINGS_KEY = 'app_settings_v1';

// default settings when app first opens or if nothing saved yet
const defaultSettings: AppSettings = {
  approveImagesBeforeAI: true,
  localStorageOnly: false,
  voiceDataProcessingEnabled: true,
  voiceFirstMode: true,
  highContrastMode: false,
  audioDescriptionsEnabled: true,
  largerTextEnabled: false,
};

// creating the context
const AppSettingsContext = createContext<AppSettingsContextType | undefined>(
  undefined
);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  // current settings state
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  // this just tells app when settings have finished loading
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    // loads settings from async storage when app starts
    const loadSettings = async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_KEY);

        if (raw) {
          const parsed = JSON.parse(raw);

          // merges saved settings with defaults just in case anything is missing
          setSettings({
            ...defaultSettings,
            ...parsed,
          });
        }
      } catch (error) {
        console.error('Failed to load app settings:', error);
      } finally {
        // marks settings as loaded even if there was an error
        setSettingsLoaded(true);
      }
    };

    loadSettings();
  }, []);

  // updates one setting and saves it straight away
  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    const updated = {
      ...settings,
      [key]: value,
    };

    // updates react state first
    setSettings(updated);

    try {
      // saves new settings to device storage
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save app settings:', error);
    }
  };

  // memo used so context value isnt recreated for no reason every render
  const value = useMemo(
    () => ({
      ...settings,
      settingsLoaded,
      updateSetting,
    }),
    [settings, settingsLoaded]
  );

  return (
    // gives settings to the whole app inside this provider
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  // custom hook to use the app settings context easier
  const context = useContext(AppSettingsContext);

  // safety check so it only works inside provider
  if (!context) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider');
  }

  return context;
}