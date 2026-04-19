import * as Speech from 'expo-speech';
import React, {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

type AssistantIntent =
  | {
      type: 'none';
      payload?: Record<string, unknown>;
    }
  | {
      type: 'navigate';
      payload: {
        route: string;
      };
    }
  | {
      type: 'set_outfit_context';
      payload: {
        occasion?: string;
        mood?: string;
        weather?: string;
      };
    }
  | {
      type: 'generate_outfit';
      payload?: Record<string, unknown>;
    }
  | {
      type: 'filter_wardrobe';
      payload: {
        category?: string;
      };
    }
  | {
      type: 'open_item';
      payload: {
        itemName?: string;
      };
    }
  | {
      type: 'open_item_by_index';
      payload: {
        index?: number;
      };
    }
  | {
      type: 'save_outfit';
      payload: {
        index?: number;
      };
    }
  | {
      type: 'set_add_item_fields';
      payload: {
        itemName?: string;
        category?: string;
        colour?: string;
        occasion?: string;
        mood?: string;
        description?: string;
      };
    }
  | {
      type: 'analyze_item_image';
      payload?: Record<string, unknown>;
    }
  | {
      type: 'save_item';
      payload?: Record<string, unknown>;
    }
  | {
      type: 'clear_form';
      payload?: Record<string, unknown>;
    }
  | {
      type: 'scroll';
      payload: {
        direction?: 'up' | 'down';
      };
    }
  | {
      type: 'edit_item';
      payload?: Record<string, unknown>;
    }
  | {
      type: 'save_item_changes';
      payload?: Record<string, unknown>;
    };

type VoiceAssistantResponse = {
  spokenReply: string;
  intent?: AssistantIntent;
};

type VoiceAssistantContextType = {
  voiceEnabled: boolean;
  isListening: boolean;
  isProcessing: boolean;
  transcript: string;
  assistantReply: string;
  currentScreen: string;
  sessionActive: boolean;
  setVoiceEnabled: (value: boolean) => void;
  setIsListening: (value: boolean) => void;
  setIsProcessing: (value: boolean) => void;
  setTranscript: (value: string) => void;
  setAssistantReply: (value: string) => void;
  registerScreen: (screenName: string) => void;
  registerScreenState: (screenName: string, state: Record<string, unknown>) => void;
  registerScreenActions: (
    screenName: string,
    actions: Record<string, (...args: any[]) => any>
  ) => void;
  sendMessageToAssistant: (message: string) => Promise<VoiceAssistantResponse>;
  executeIntent: (intent?: AssistantIntent) => Promise<void>;
  stopAssistantSpeech: () => void;
  resetVoiceSession: () => void;
};

const VoiceAssistantContext = createContext<VoiceAssistantContextType | undefined>(
  undefined
);

type ProviderProps = {
  children: ReactNode;
};

const BACKEND_URL = 'http://192.168.0.83:3001';

export function VoiceAssistantProvider({ children }: ProviderProps) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [assistantReply, setAssistantReply] = useState('');
  const [currentScreen, setCurrentScreen] = useState('');
  const [sessionActive, setSessionActive] = useState(false);

  const screenStatesRef = useRef<Record<string, Record<string, unknown>>>({});
  const screenActionsRef = useRef<
    Record<string, Record<string, (...args: any[]) => any>>
  >({});
  const currentScreenRef = useRef('');

  const registerScreen = (screenName: string) => {
    currentScreenRef.current = screenName;
    setCurrentScreen(screenName);
  };

  const registerScreenState = (
    screenName: string,
    state: Record<string, unknown>
  ) => {
    screenStatesRef.current[screenName] = state;
  };

  const registerScreenActions = (
    screenName: string,
    actions: Record<string, (...args: any[]) => any>
  ) => {
    screenActionsRef.current[screenName] = actions;
  };

  const stopAssistantSpeech = () => {
    Speech.stop();
  };

  const resetVoiceSession = () => {
    Speech.stop();
    setVoiceEnabled(false);
    setIsListening(false);
    setIsProcessing(false);
    setTranscript('');
    setAssistantReply('');
    setCurrentScreen('');
    currentScreenRef.current = '';
    setSessionActive(false);
    screenStatesRef.current = {};
    screenActionsRef.current = {};
  };

  const sendMessageToAssistant = async (
    message: string
  ): Promise<VoiceAssistantResponse> => {
    setIsProcessing(true);
    setSessionActive(true);
    setTranscript(message);

    try {
      const activeScreen = currentScreenRef.current || currentScreen;

      const screenState = activeScreen
        ? screenStatesRef.current[activeScreen] || {}
        : {};

      const response = await fetch(`${BACKEND_URL}/voice-assistant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          currentScreen: activeScreen,
          screenState,
        }),
      });

      if (!response.ok) {
        throw new Error(`Voice assistant request failed: ${response.status}`);
      }

      const data = await response.json();

      const result: VoiceAssistantResponse = {
        spokenReply: data.spokenReply || 'Done.',
        intent: data.intent || { type: 'none' },
      };

      setAssistantReply(result.spokenReply);
      return result;
    } catch (error) {
      console.error('Voice assistant error:', error);

      const fallback = {
        spokenReply: 'Sorry, something went wrong with the voice assistant.',
        intent: { type: 'none' } as AssistantIntent,
      };

      setAssistantReply(fallback.spokenReply);
      return fallback;
    } finally {
      setIsProcessing(false);
    }
  };

  const executeIntent = async (intent?: AssistantIntent) => {
    if (!intent || intent.type === 'none') return;

    const activeScreen = currentScreenRef.current || currentScreen;

    const currentActions = activeScreen
      ? screenActionsRef.current[activeScreen] || {}
      : {};

    const allRegisteredActions = Object.values(screenActionsRef.current);

    const fallbackNavigate = allRegisteredActions.find(
      (actions) => typeof actions.navigateToRoute === 'function'
    )?.navigateToRoute;

    try {
      if (intent.type === 'navigate') {
        const navigateFn = currentActions.navigateToRoute || fallbackNavigate;

        if (navigateFn && intent.payload?.route) {
          await navigateFn(intent.payload.route);
          return;
        }
      }

      if (
        intent.type === 'set_outfit_context' &&
        currentActions.setOutfitContext
      ) {
        await currentActions.setOutfitContext(intent.payload);
        return;
      }

      if (intent.type === 'generate_outfit' && currentActions.generateOutfit) {
        await currentActions.generateOutfit();
        return;
      }

      if (
        intent.type === 'filter_wardrobe' &&
        currentActions.filterWardrobeCategory
      ) {
        await currentActions.filterWardrobeCategory(intent.payload.category);
        return;
      }

      if (intent.type === 'open_item' && currentActions.openWardrobeItem) {
        await currentActions.openWardrobeItem(intent.payload.itemName);
        return;
      }

      if (
        intent.type === 'open_item_by_index' &&
        currentActions.openItemByIndex
      ) {
        await currentActions.openItemByIndex(intent.payload.index ?? 0);
        return;
      }

      if (intent.type === 'save_outfit' && currentActions.saveOutfitByIndex) {
        await currentActions.saveOutfitByIndex(intent.payload.index ?? 0);
        return;
      }

      if (
        intent.type === 'set_add_item_fields' &&
        currentActions.setAddItemFields
      ) {
        await currentActions.setAddItemFields(intent.payload);
        return;
      }

      if (
        intent.type === 'analyze_item_image' &&
        currentActions.analyzeCurrentImage
      ) {
        await currentActions.analyzeCurrentImage();
        return;
      }

      if (intent.type === 'save_item' && currentActions.saveCurrentItem) {
        await currentActions.saveCurrentItem();
        return;
      }

      if (intent.type === 'clear_form' && currentActions.clearAddItemForm) {
        await currentActions.clearAddItemForm();
        return;
      }

      if (intent.type === 'scroll' && currentActions.scrollScreen) {
        await currentActions.scrollScreen(intent.payload.direction || 'down');
        return;
      }

      if (intent.type === 'edit_item' && currentActions.startEditingItem) {
        await currentActions.startEditingItem();
        return;
      }

      if (
        intent.type === 'save_item_changes' &&
        currentActions.saveEditedItem
      ) {
        await currentActions.saveEditedItem();
        return;
      }
    } catch (error) {
      console.error('Intent execution error:', error);
    }
  };

  const value = useMemo(
    () => ({
      voiceEnabled,
      isListening,
      isProcessing,
      transcript,
      assistantReply,
      currentScreen,
      sessionActive,
      setVoiceEnabled,
      setIsListening,
      setIsProcessing,
      setTranscript,
      setAssistantReply,
      registerScreen,
      registerScreenState,
      registerScreenActions,
      sendMessageToAssistant,
      executeIntent,
      stopAssistantSpeech,
      resetVoiceSession,
    }),
    [
      voiceEnabled,
      isListening,
      isProcessing,
      transcript,
      assistantReply,
      currentScreen,
      sessionActive,
    ]
  );

  return (
    <VoiceAssistantContext.Provider value={value}>
      {children}
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistant() {
  const context = useContext(VoiceAssistantContext);

  if (!context) {
    throw new Error('useVoiceAssistant must be used inside VoiceAssistantProvider');
  }

  return context;
}