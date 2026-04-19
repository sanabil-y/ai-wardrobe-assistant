// stack is used for the main app navigation
import { Stack } from 'expo-router';

// floating voice assistant button shown across the app
import VoiceAssistantButton from '../components/VoiceAssistantButton';

// provider for app settings like contrast mode, text size and more
import { AppSettingsProvider } from '../context/appSettingsContext';

// provider for all voice assistant logic
import { VoiceAssistantProvider } from '../context/voiceAssistantContext';



// provider for wardrobe data shared across screens
import { WardrobeProvider } from '../context/wardrobeContext';

export default function RootLayout() {
  
  return (
    // wraps whole app so wardrobe data can be used anywhere
    <WardrobeProvider>
      {/* wraps app settings around all screens */}
      <AppSettingsProvider>
        {/* wraps voice assistant around the app too */}
        <VoiceAssistantProvider>
          <>
            {/* main app navigation, header hidden because custom screens are used */}
            <Stack screenOptions={{ headerShown: false }} />

            {/* voice assistant button stays available across the app */}
            <VoiceAssistantButton />
          </>
        </VoiceAssistantProvider>
      </AppSettingsProvider>
    </WardrobeProvider>
  );
}