import * as Speech from 'expo-speech';
import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import React, { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppSettings } from '../context/appSettingsContext';
import { useVoiceAssistant } from '../context/voiceAssistantContext';

export default function VoiceAssistantButton() {
  const {
    voiceEnabled,
    isListening,
    setIsListening,
    setIsProcessing,
    setTranscript,
    setAssistantReply,
    sendMessageToAssistant,
    executeIntent,
    stopAssistantSpeech,
  } = useVoiceAssistant();

  const { voiceDataProcessingEnabled, highContrastMode } = useAppSettings();

  const isListeningRef = useRef(false);
  const isAssistantSpeakingRef = useRef(false);

  const resultListenerRef = useRef<{ remove: () => void } | null>(null);
  const errorListenerRef = useRef<{ remove: () => void } | null>(null);
  const endListenerRef = useRef<{ remove: () => void } | null>(null);

  const updateListeningState = (value: boolean) => {
    isListeningRef.current = value;
    setIsListening(value);
  };

  const normaliseTranscript = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?]/g, '')
      .replace(/\s+/g, ' ');
  };

  const speakText = (text: string, onDone?: () => void) => {
    if (!text) return;

    setAssistantReply(text);
    stopAssistantSpeech();
    isAssistantSpeakingRef.current = true;

    Speech.speak(text, {
      rate: 0.92,
      pitch: 1,
      onDone: () => {
        isAssistantSpeakingRef.current = false;
        onDone?.();
      },
      onStopped: () => {
        isAssistantSpeakingRef.current = false;
        onDone?.();
      },
      onError: () => {
        isAssistantSpeakingRef.current = false;
        onDone?.();
      },
    });
  };

  const removeRecognitionListeners = () => {
    resultListenerRef.current?.remove();
    errorListenerRef.current?.remove();
    endListenerRef.current?.remove();

    resultListenerRef.current = null;
    errorListenerRef.current = null;
    endListenerRef.current = null;
  };

  const stopListening = async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      console.error('Stop recognition error:', error);
    }

    updateListeningState(false);
    setIsProcessing(false);
  };

  const handleAssistantFlow = async (cleaned: string) => {
    try {
      setIsProcessing(true);

      const response = await sendMessageToAssistant(cleaned);
      await executeIntent(response?.intent);

      const reply = response?.spokenReply || 'Done.';
      speakText(reply, () => {
        setIsProcessing(false);
      });
    } catch (error) {
      console.error('Assistant flow error:', error);
      setIsProcessing(false);
      speakText('Something went wrong.');
    }
  };

  const startRecognition = async () => {
    if (!voiceEnabled || !voiceDataProcessingEnabled) return;

    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted) {
        speakText('Microphone permission is required.');
        return;
      }

      removeRecognitionListeners();

      resultListenerRef.current = ExpoSpeechRecognitionModule.addListener(
        'result',
        (event: ExpoSpeechRecognitionResultEvent) => {
          const firstResult = event.results?.[0];
          const text =
            typeof firstResult === 'string'
              ? firstResult
              : firstResult?.transcript || '';

          setTranscript(text);

          if (!event.isFinal) return;

          const cleaned = normaliseTranscript(text);
          updateListeningState(false);

          if (!cleaned) {
            speakText('I did not catch that.');
            return;
          }

          void handleAssistantFlow(cleaned);
        }
      );

      errorListenerRef.current = ExpoSpeechRecognitionModule.addListener(
        'error',
        (event: any) => {
          console.error('Speech recognition error:', event);
          updateListeningState(false);
          setIsProcessing(false);
          speakText('Voice recognition failed.');
        }
      );

      endListenerRef.current = ExpoSpeechRecognitionModule.addListener(
        'end',
        () => {
          updateListeningState(false);
        }
      );

      updateListeningState(true);

      ExpoSpeechRecognitionModule.start({
        lang: 'en-GB',
        interimResults: true,
        continuous: false,
      });
    } catch (error) {
      console.error('Start recognition error:', error);
      updateListeningState(false);
      speakText('Voice recognition failed.');
    }
  };

  const handlePress = () => {
    if (isListeningRef.current) {
      void stopListening();
      return;
    }

    speakText('I am listening.', () => {
      void startRecognition();
    });
  };

  useEffect(() => {
    return () => {
      removeRecognitionListeners();
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // ignore cleanup stop errors
      }
    };
  }, []);

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={[
          styles.button,
          isListening && styles.buttonListening,
          highContrastMode && { backgroundColor: '#000' },
        ]}
        onPress={handlePress}
      >
        <Text style={styles.icon}>{isListening ? '⏹' : '🎤'}</Text>
        <Text style={styles.text}>
          {isListening ? 'Listening now' : 'Voice assistant'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    bottom: 88,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#253041',
    padding: 14,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonListening: {
    backgroundColor: '#b00020',
  },
  icon: {
    color: '#fff',
    fontSize: 16,
    marginRight: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});