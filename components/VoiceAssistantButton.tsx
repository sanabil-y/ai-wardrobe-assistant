// text to speech for assistant replies
import * as Speech from 'expo-speech';

// speech recognition module for listening to the user

import {
  ExpoSpeechRecognitionModule,
  type ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

// react hooks
import React, { useEffect, useRef } from 'react';

// button + text + wrapper
import { Pressable, StyleSheet, Text, View } from 'react-native';

// app settings like contrast mode and privacy setting for voice processing
import { useAppSettings } from '../context/appSettingsContext';

// all the voice assistant state and actions come from here
import { useVoiceAssistant } from '../context/voiceAssistantContext';

export default function VoiceAssistantButton() {
  // getting voice assistant values and functions from context
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

  // settings that affect this button

  const { voiceDataProcessingEnabled, highContrastMode } = useAppSettings();

  // refs are used here so current values stay available without rerender issues
  const isListeningRef = useRef(false);
  const isAssistantSpeakingRef = useRef(false);

  // these store the listeners so they can be removed later
  const resultListenerRef = useRef<{ remove: () => void } | null>(null);
  const errorListenerRef = useRef<{ remove: () => void } | null>(null);
  const endListenerRef = useRef<{ remove: () => void } | null>(null);

  // updates both the ref and the react state together
  const updateListeningState = (value: boolean) => {
    isListeningRef.current = value;
    setIsListening(value);
  };

  // cleans up spoken text a bit before it gets sent to backend
  const normaliseTranscript = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?]/g, '')
      .replace(/\s+/g, ' ');
  };

  // makes assistant speak a reply
  const speakText = (text: string, onDone?: () => void) => {
    if (!text) return;

    // save the reply text into context too
    setAssistantReply(text);

    // stops any old speech first so they dont overlap
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

  // removes old listeners before adding new ones
  const removeRecognitionListeners = () => {
    resultListenerRef.current?.remove();
    errorListenerRef.current?.remove();
    endListenerRef.current?.remove();

    resultListenerRef.current = null;
    errorListenerRef.current = null;
    endListenerRef.current = null;
  };

  // stops recognition manually
  const stopListening = async () => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      console.error('Stop recognition error:', error);
    }

    updateListeningState(false);
    setIsProcessing(false);
  };

  // full assistant flow after user speech is final
  const handleAssistantFlow = async (cleaned: string) => {
    try {
      setIsProcessing(true);

      // send user speech to backend / assistant logic
      const response = await sendMessageToAssistant(cleaned);

      // execute whatever intent came back
      await executeIntent(response?.intent);

      const reply = response?.spokenReply || 'Done.';

      // speak assistant reply
      speakText(reply, () => {
        setIsProcessing(false);
      });
    } catch (error) {
      console.error('Assistant flow error:', error);
      setIsProcessing(false);
      speakText('Something went wrong.');
    }
  };



  // starts voice recognition
  const startRecognition = async () => {
    // dont start if voice is disabled in settings
    if (!voiceEnabled || !voiceDataProcessingEnabled) return;

    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission.granted) {
        speakText('Microphone permission is required.');
        return;
      }

      // remove old listeners first just in case
      removeRecognitionListeners();

      // listens for speech results
      resultListenerRef.current = ExpoSpeechRecognitionModule.addListener(
        'result',
        (event: ExpoSpeechRecognitionResultEvent) => {
          const firstResult = event.results?.[0];

          const text =
            typeof firstResult === 'string'
              ? firstResult
              : firstResult?.transcript || '';

          // save live transcript
          setTranscript(text);

          // only continue once final result comes in
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

      // handles recognition errors
      errorListenerRef.current = ExpoSpeechRecognitionModule.addListener(
        'error',
        (event: any) => {
          console.error('Speech recognition error:', event);
          updateListeningState(false);
          setIsProcessing(false);
          speakText('Voice recognition failed.');
        }
      );

      // when recognition ends naturally
      endListenerRef.current = ExpoSpeechRecognitionModule.addListener(
        'end',
        () => {
          updateListeningState(false);
        }
      );




      updateListeningState(true);

      // starts listening in british english
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

  // button press either stops listening or starts new voice flow
  const handlePress = () => {
    if (isListeningRef.current) {
      void stopListening();
      return;
    }

    // says "i am listening" first, then starts actual recognition
    speakText('I am listening.', () => {
      void startRecognition();

    });
  };

  useEffect(() => {
    // cleanup when component unmounts
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
          isListening && styles.buttonListening, // red when listening
          highContrastMode && { backgroundColor: '#000' }, // black in contrast mode
        ]}
        onPress={handlePress}
      >
        {/* icon changes depending on listening state */}
        <Text style={styles.icon}>{isListening ? '⏹' : '🎤'}</Text>

        {/* button text changes too */}
        <Text style={styles.text}>
          {isListening ? 'Listening now' : 'Voice assistant'}
        </Text>
      </Pressable>
    </View>
  );
}

// styles for floating voice assistant button
const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute', // keeps it floating above screens
    bottom: 88,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#253041',
    padding: 14,

    borderRadius: 999, // pill shape
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonListening: {
    backgroundColor: '#b00020', // turns red while listening
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