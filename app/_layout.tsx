import { Stack } from 'expo-router';
import VoiceAssistantButton from '../components/VoiceAssistantButton';
import { AppSettingsProvider } from '../context/appSettingsContext';
import { VoiceAssistantProvider } from '../context/voiceAssistantContext';
import { WardrobeProvider } from '../context/wardrobeContext';

export default function RootLayout() {
  return (
    <WardrobeProvider>
      <AppSettingsProvider>
        <VoiceAssistantProvider>
          <>
            <Stack screenOptions={{ headerShown: false }} />
            <VoiceAssistantButton />
          </>
        </VoiceAssistantProvider>
      </AppSettingsProvider>
    </WardrobeProvider>
  );
}