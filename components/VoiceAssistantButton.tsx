import * as Speech from 'expo-speech';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppSettings } from '../context/appSettingsContext';
import { useVoiceAssistant } from '../context/voiceAssistantContext';

declare global {
  interface Window {
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
  }
}

export default function VoiceAssistantButton() {
  const {
    voiceEnabled,
    isListening,
    isProcessing,
    transcript,
    assistantReply,
    setIsListening,
    setIsProcessing,
    setTranscript,
    setAssistantReply,
    sendMessageToAssistant,
    executeIntent,
    stopAssistantSpeech,
  } = useVoiceAssistant();

  const {
    voiceDataProcessingEnabled,
    highContrastMode,
    largerTextEnabled,
    voiceFirstMode,
  } = useAppSettings();

  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const shouldContinueListeningRef = useRef(false);
  const isStartingRecognitionRef = useRef(false);
  const silenceTimeoutRef = useRef<any>(null);
  const hidePanelTimeoutRef = useRef<any>(null);
  const lastTranscriptRef = useRef('');
  const lastReplyRef = useRef('');
  const isAssistantSpeakingRef = useRef(false);
  const ignoreNextErrorRef = useRef(false);

  const [isPanelDismissed, setIsPanelDismissed] = useState(false);

  const updateListeningState = (value: boolean) => {
    isListeningRef.current = value;
    setIsListening(value);
  };

  const clearSilenceTimeout = () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
  };

  const clearHidePanelTimeout = () => {
    if (hidePanelTimeoutRef.current) {
      clearTimeout(hidePanelTimeoutRef.current);
      hidePanelTimeoutRef.current = null;
    }
  };

  const scheduleHidePanel = () => {
    clearHidePanelTimeout();

    hidePanelTimeoutRef.current = setTimeout(() => {
      if (!isListeningRef.current && !isProcessing) {
        setIsPanelDismissed(true);
        setTranscript('');
        setAssistantReply('');
      }
    }, 10000);
  };

  const showPanel = () => {
    clearHidePanelTimeout();
    setIsPanelDismissed(false);
  };

  const closePanel = () => {
    clearHidePanelTimeout();
    stopListening();
    setTranscript('');
    setAssistantReply('');
    setIsPanelDismissed(true);
  };

  const normaliseTranscript = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[.,!?]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\bplease\b/g, '')
      .replace(/\bcan you\b/g, '')
      .replace(/\bcould you\b/g, '')
      .replace(/\bfor me\b/g, '')
      .replace(/\bi want\b/g, '')
      .replace(/\bi need\b/g, '')
      .replace(/\bwould you\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const speakText = (text: string, onDone?: () => void) => {
    if (!text) {
      onDone?.();
      return;
    }

    showPanel();
    lastReplyRef.current = text;
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

  const stopListening = () => {
    shouldContinueListeningRef.current = false;
    clearSilenceTimeout();

    if (recognitionRef.current) {
      try {
        ignoreNextErrorRef.current = true;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {}
    }

    stopAssistantSpeech();
    updateListeningState(false);
    setIsProcessing(false);
    isStartingRecognitionRef.current = false;
    isAssistantSpeakingRef.current = false;
  };

  const startSilenceTimer = () => {
    clearSilenceTimeout();

    silenceTimeoutRef.current = setTimeout(() => {
      if (isListeningRef.current) {
        stopListening();
        setAssistantReply('No input detected. Stopping listening.');
        speakText('No input detected. Stopping listening.');
      }
    }, 9000);
  };

  const startRecognition = () => {
    if (!voiceDataProcessingEnabled) return;
    if (!voiceEnabled) return;
    if (isAssistantSpeakingRef.current) return;
    if (isStartingRecognitionRef.current || isListeningRef.current) return;

    showPanel();

    if (Platform.OS !== 'web') {
      setAssistantReply(
        'Voice input is currently available in the web version for now.'
      );
      speakText(
        'Voice input is currently available in the web version for now.'
      );
      return;
    }

    const SpeechRecognitionClass =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setAssistantReply(
        'Voice recognition is not supported in this browser. Please use Chrome.'
      );
      speakText(
        'Voice recognition is not supported in this browser. Please use Chrome.'
      );
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognitionRef.current = recognition;
    isStartingRecognitionRef.current = true;

    recognition.lang = 'en-GB';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => {
      isStartingRecognitionRef.current = false;
      ignoreNextErrorRef.current = false;
      updateListeningState(true);
      showPanel();
      startSilenceTimer();
    };

    recognition.onresult = async (event: any) => {
      clearSilenceTimeout();
      clearHidePanelTimeout();

      const results = Array.from(event.results || []);
      const rawTranscript = results
        .map((result: any) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();

      const latestResult = event?.results?.[event.results.length - 1];
      const isFinal = !!latestResult?.isFinal;

      if (isAssistantSpeakingRef.current) {
        return;
      }

      showPanel();
      setTranscript(rawTranscript || '');

      if (!isFinal) {
        startSilenceTimer();
        return;
      }

      const cleanedTranscript = normaliseTranscript(rawTranscript);

      updateListeningState(false);

      if (cleanedTranscript === lastTranscriptRef.current) {
        if (voiceEnabled && voiceDataProcessingEnabled) {
          startRecognition();
        }
        return;
      }

      lastTranscriptRef.current = cleanedTranscript;

      if (!cleanedTranscript) {
        setAssistantReply('I did not catch that. Please repeat.');
        speakText('I did not catch that. Please repeat.', () => {
          if (voiceEnabled && voiceDataProcessingEnabled) {
            startRecognition();
          }
        });
        return;
      }

      if (
        ['stop', 'cancel', 'stop listening', 'never mind'].includes(
          cleanedTranscript
        )
      ) {
        stopListening();
        setAssistantReply('Stopping voice assistant.');
        speakText('Stopping voice assistant.');
        return;
      }

      if (
        ['repeat', 'repeat that', 'say that again', 'what did you say'].includes(
          cleanedTranscript
        )
      ) {
        if (lastReplyRef.current) {
          setAssistantReply(lastReplyRef.current);
          speakText(lastReplyRef.current, () => {
            if (voiceEnabled && voiceDataProcessingEnabled) {
              startRecognition();
            }
          });
        } else {
          setAssistantReply('Nothing to repeat yet.');
          speakText('Nothing to repeat yet.', () => {
            if (voiceEnabled && voiceDataProcessingEnabled) {
              startRecognition();
            }
          });
        }
        return;
      }

      try {
        showPanel();
        setIsProcessing(true);

        const response = await sendMessageToAssistant(cleanedTranscript);
        await executeIntent(response?.intent);

        const spokenReply = response?.spokenReply || 'Done.';
        shouldContinueListeningRef.current =
          voiceEnabled && voiceDataProcessingEnabled;

        setAssistantReply(spokenReply);

        speakText(spokenReply, () => {
          setIsProcessing(false);

          if (shouldContinueListeningRef.current) {
            startRecognition();
          } else {
            updateListeningState(false);
            scheduleHidePanel();
          }
        });
      } catch (error) {
        console.error(error);
        stopListening();
        setIsProcessing(false);
        setAssistantReply('Something went wrong.');
        speakText('Something went wrong.');
      }
    };

    recognition.onerror = (event: any) => {
      isStartingRecognitionRef.current = false;

      const errorType = event?.error || '';

      if (
        ignoreNextErrorRef.current ||
        errorType === 'aborted' ||
        errorType === 'no-speech'
      ) {
        ignoreNextErrorRef.current = false;
        updateListeningState(false);
        setIsProcessing(false);
        scheduleHidePanel();
        return;
      }

      stopListening();
      setIsProcessing(false);
      setAssistantReply('Sorry, I did not understand.');
      speakText('Sorry, I did not understand.');
    };

    recognition.onend = () => {
      isStartingRecognitionRef.current = false;
      updateListeningState(false);

      if (isAssistantSpeakingRef.current) {
        return;
      }

      if (shouldContinueListeningRef.current && voiceEnabled) {
        setTimeout(() => {
          if (
            !isAssistantSpeakingRef.current &&
            voiceEnabled &&
            voiceDataProcessingEnabled
          ) {
            startRecognition();
          }
        }, 350);
      } else {
        scheduleHidePanel();
      }
    };

    try {
      recognition.start();
    } catch {
      isStartingRecognitionRef.current = false;
      stopListening();
      scheduleHidePanel();
    }
  };

  const handlePress = () => {
    showPanel();

    if (!voiceDataProcessingEnabled) {
      setAssistantReply(
        'Voice data processing is turned off in Privacy settings.'
      );
      speakText('Voice data processing is turned off in Privacy settings.');
      return;
    }

    if (isListeningRef.current) {
      stopListening();
      scheduleHidePanel();
      return;
    }

    if (!voiceEnabled) {
      setAssistantReply(
        'Turn on voice chat first in settings or on the screen toggle.'
      );
      speakText(
        'Turn on voice chat first in settings or on the screen toggle.'
      );
      return;
    }

    shouldContinueListeningRef.current = true;
    setAssistantReply('I am listening.');

    speakText('I am listening.', () => {
      startRecognition();
    });
  };

  useEffect(() => {
    if (!voiceEnabled) {
      stopListening();
      scheduleHidePanel();
    }
  }, [voiceEnabled]);

  useEffect(() => {
    if (!voiceDataProcessingEnabled) {
      stopListening();
      scheduleHidePanel();
    }
  }, [voiceDataProcessingEnabled]);

  useEffect(() => {
    if (isListening || isProcessing) {
      showPanel();
      clearHidePanelTimeout();
    } else if (transcript || assistantReply) {
      scheduleHidePanel();
    }
  }, [isListening, isProcessing, transcript, assistantReply]);

  useEffect(() => {
    return () => {
      stopListening();
      clearSilenceTimeout();
      clearHidePanelTimeout();
    };
  }, []);

  const statusText: 'idle' | 'listening' | 'processing' = isListening
    ? 'listening'
    : isProcessing
    ? 'processing'
    : 'idle';

  const showTranscriptBox =
    !isPanelDismissed &&
    !!(
      transcript ||
      assistantReply ||
      isListening ||
      isProcessing ||
      voiceFirstMode
    );

  return (
    <View style={styles.wrapper}>
      {showTranscriptBox ? (
        <View
          style={[
            styles.transcriptCard,
            highContrastMode && {
              backgroundColor: '#ffffff',
              borderColor: '#000000',
            },
          ]}
        >
          <View style={styles.transcriptHeaderRow}>
            <Text
              style={[
                styles.transcriptHeader,
                highContrastMode && { color: '#000000' },
                largerTextEnabled && { fontSize: 16 },
              ]}
            >
              Voice interaction
            </Text>

            <View style={styles.headerRight}>
              <View
                style={[
                  styles.statusDot,
                  statusText === 'listening'
                    ? styles.statusListening
                    : statusText === 'processing'
                    ? styles.statusProcessing
                    : styles.statusIdle,
                ]}
              />

              <Pressable
                style={[
                  styles.closeButton,
                  highContrastMode && {
                    borderColor: '#000000',
                    backgroundColor: '#ffffff',
                  },
                ]}
                onPress={closePanel}
              >
                <Text
                  style={[
                    styles.closeButtonText,
                    highContrastMode && { color: '#000000' },
                    largerTextEnabled && { fontSize: 14 },
                  ]}
                >
                  ×
                </Text>
              </Pressable>
            </View>
          </View>

          {transcript ? (
            <View
              style={[
                styles.bubbleLight,
                highContrastMode && {
                  borderColor: '#000000',
                  backgroundColor: '#ffffff',
                },
              ]}
            >
              <Text
                style={[
                  styles.bubbleLabel,
                  highContrastMode && { color: '#000000' },
                ]}
              >
                You said
              </Text>
              <Text
                style={[
                  styles.bubbleText,
                  highContrastMode && { color: '#000000' },
                  largerTextEnabled && { fontSize: 16, lineHeight: 22 },
                ]}
              >
                {transcript}
              </Text>
            </View>
          ) : null}

          {assistantReply ? (
            <View
              style={[
                styles.bubbleDark,
                highContrastMode && {
                  backgroundColor: '#000000',
                  borderColor: '#000000',
                },
              ]}
            >
              <Text style={styles.bubbleLabelDark}>Assistant</Text>
              <Text
                style={[
                  styles.bubbleTextDark,
                  largerTextEnabled && { fontSize: 16, lineHeight: 22 },
                ]}
              >
                {assistantReply}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <Pressable
        style={[
          styles.button,
          isListening && styles.buttonListening,
          highContrastMode && { backgroundColor: '#000000' },
        ]}
        onPress={handlePress}
      >
        <Text style={styles.icon}>{isListening ? '⏹' : '🎤'}</Text>
        <Text
          style={[
            styles.text,
            largerTextEnabled && { fontSize: 16 },
          ]}
        >
          {isListening
            ? 'Listening now'
            : voiceEnabled
            ? 'Voice chat on'
            : 'Voice assistant'}
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
    zIndex: 1000,
  },
  transcriptCard: {
    width: '100%',
    backgroundColor: '#f7f7f7',
    borderWidth: 2,
    borderColor: '#253041',
    borderRadius: 22,
    padding: 12,
    marginBottom: 12,
  },
  transcriptHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  transcriptHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2b3440',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
  },
  statusListening: {
    backgroundColor: '#2d6a4f',
  },
  statusProcessing: {
    backgroundColor: '#b7791f',
  },
  statusIdle: {
    backgroundColor: '#7f8791',
  },
  closeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cfd4da',
    backgroundColor: '#ffffff',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2b3440',
    lineHeight: 16,
  },
  bubbleLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1.2,
    borderColor: '#d1d6dc',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
  },
  bubbleDark: {
    backgroundColor: '#253041',
    borderWidth: 1.2,
    borderColor: '#253041',
    borderRadius: 14,
    padding: 10,
  },
  bubbleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#66707a',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bubbleLabelDark: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dce1e7',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bubbleText: {
    fontSize: 14,
    color: '#2b3440',
    lineHeight: 18,
  },
  bubbleTextDark: {
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#253041',
    minWidth: 190,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
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