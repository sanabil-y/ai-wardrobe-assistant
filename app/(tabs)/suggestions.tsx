import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import OutfitOptionCard from '../../components/OutfitOptionCard';
import { useAppSettings } from '../../context/appSettingsContext';
import { useVoiceAssistant } from '../../context/voiceAssistantContext';
import { db } from '../../firebaseConfig';
import { getLocalWardrobeItems } from '../../lib/localData';

type WardrobeItem = {
  id: string;
  itemName: string;
  category: string;
  colour: string;
  occasion: string;
  mood: string;
  description: string;
  imageUrl: string;
  createdAt?: any;
  localOnly?: boolean;
};

type OutfitSuggestion = {
  title: string;
  selectedItemIds: string[];
  reason: string;
  confidence: number;
  fallback?: boolean;
  weakRecommendation?: boolean;
  explanationTags?: string[];
  scoringLog?: {
    itemScoreTotal?: number;
    completenessScore?: number;
    harmonyScore?: number;
    preferenceScore?: number;
    variationScore?: number;
    totalScore?: number;
    confidence?: number;
    items?: Array<{
      itemName: string;
      category: string;
      colour: string;
      score: number;
      scoreLog?: string[];
    }>;
    outfitLog?: string[];
  };
};

type FeedbackSummary = {
  likedColours: string[];
  dislikedColours: string[];
  likedCategories: string[];
  dislikedCategories: string[];
  likedOutfitKeys: string[];
  dislikedOutfitKeys: string[];
  savedOutfitKeys: string[];
  preferredOccasions: string[];
  preferredMoods: string[];
};

export default function SuggestionsScreen() {
  const [occasion, setOccasion] = useState('');
  const [mood, setMood] = useState('');
  const [weather, setWeather] = useState('');
  const [useTodayWeather, setUseTodayWeather] = useState(false);

  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [suggestions, setSuggestions] = useState<OutfitSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingWardrobe, setLoadingWardrobe] = useState(true);
  const [loadingWeather, setLoadingWeather] = useState(false);

  const [noMatchMessage, setNoMatchMessage] = useState('');
  const [savedOutfitIds, setSavedOutfitIds] = useState<Record<string, string>>({});
  const [savingSuggestionKey, setSavingSuggestionKey] = useState('');
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'like' | 'dislike' | ''>>({});

  const cloudItemsRef = useRef<WardrobeItem[]>([]);

  const { registerScreen, registerScreenActions, registerScreenState } =
    useVoiceAssistant();

  const { highContrastMode, largerTextEnabled, voiceFirstMode } =
    useAppSettings();

  const refreshMergedWardrobeItems = async (cloudItemsOverride?: WardrobeItem[]) => {
    const localItems = await getLocalWardrobeItems();
    const cloudItems = cloudItemsOverride || cloudItemsRef.current || [];

    const merged = [...localItems, ...cloudItems].sort((a, b) => {
      const dateA =
        typeof a.createdAt?.toDate === 'function'
          ? a.createdAt.toDate().getTime()
          : new Date(a.createdAt || 0).getTime();

      const dateB =
        typeof b.createdAt?.toDate === 'function'
          ? b.createdAt.toDate().getTime()
          : new Date(b.createdAt || 0).getTime();

      return dateB - dateA;
    });

    setWardrobeItems(merged);
  };

  const getSuggestionKey = (suggestion: OutfitSuggestion) => {
    return [...suggestion.selectedItemIds].sort().join('|');
  };

  const mapWeatherCodeToLabel = (temperature: number, rain: number) => {
    if (rain > 0.2) return 'Rainy';
    if (temperature <= 10) return 'Cold';
    if (temperature >= 20) return 'Warm';
    return 'Mild';
  };

const fetchTodayWeather = async () => {
  try {
    setLoadingWeather(true);

    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      throw new Error('Location permission not granted');
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const latitude = location.coords.latitude;
    const longitude = location.coords.longitude;

    const weatherResponse = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,rain`
    );

    if (!weatherResponse.ok) {
      throw new Error('Weather API request failed');
    }

    const weatherData = await weatherResponse.json();

    const temperature = Number(weatherData?.current?.temperature_2m ?? 15);
    const rain = Number(weatherData?.current?.rain ?? 0);

    const mappedWeather = mapWeatherCodeToLabel(temperature, rain);
    setWeather(mappedWeather);
  } catch (error) {
    console.error('Weather fetch error:', error);
    Alert.alert(
      'Weather unavailable',
      'Could not get today’s weather automatically. Please choose weather manually.'
    );
    setUseTodayWeather(false);
  } finally {
    setLoadingWeather(false);
  }
};

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'wardrobe'), async (snapshot) => {
      const items = snapshot.docs.map((itemDoc) => ({
        id: itemDoc.id,
        ...itemDoc.data(),
        localOnly: false,
      })) as WardrobeItem[];

      cloudItemsRef.current = items;
      await refreshMergedWardrobeItems(items);
      setLoadingWardrobe(false);
    });

    return () => unsubscribe();
  }, []);

  useFocusEffect(
    useCallback(() => {
      registerScreen('suggestions');
      refreshMergedWardrobeItems();
    }, [registerScreen])
  );

  useEffect(() => {
    if (useTodayWeather) {
      fetchTodayWeather();
    }
  }, [useTodayWeather]);

  const hasEnoughWardrobeItems = useMemo(() => {
    const tops = wardrobeItems.filter((item) => item.category.toLowerCase() === 'top');
    const bottoms = wardrobeItems.filter((item) => item.category.toLowerCase() === 'bottom');
    const dresses = wardrobeItems.filter((item) => item.category.toLowerCase() === 'dress');

    return (tops.length > 0 && bottoms.length > 0) || dresses.length > 0;
  }, [wardrobeItems]);

  const getMissingCategoryMessage = () => {
    const tops = wardrobeItems.filter((item) => item.category.toLowerCase() === 'top');
    const bottoms = wardrobeItems.filter((item) => item.category.toLowerCase() === 'bottom');
    const dresses = wardrobeItems.filter((item) => item.category.toLowerCase() === 'dress');

    const hasTop = tops.length > 0;
    const hasBottom = bottoms.length > 0;
    const hasDress = dresses.length > 0;

    if (!hasTop && !hasDress) {
      return 'Add at least one top or dress before generating an outfit.';
    }

    if (!hasBottom && !hasDress) {
      return 'Add at least one bottom or dress before generating an outfit.';
    }

    return '';
  };

  const handleClearSelections = () => {
    setOccasion('');
    setMood('');
    setWeather('');
    setUseTodayWeather(false);
    setSuggestions([]);
    setNoMatchMessage('');
    setSavedOutfitIds({});
    setSavingSuggestionKey('');
    setFeedbackMap({});
  };

  const handleToggleFavourite = async (suggestion: OutfitSuggestion) => {
    const suggestionKey = getSuggestionKey(suggestion);

    try {
      setSavingSuggestionKey(suggestionKey);

      const existingSavedId = savedOutfitIds[suggestionKey];

      if (existingSavedId) {
        await deleteDoc(doc(db, 'savedOutfits', existingSavedId));

        setSavedOutfitIds((prev) => {
          const updated = { ...prev };
          delete updated[suggestionKey];
          return updated;
        });

        Alert.alert('Removed from favourites', 'This outfit has been removed');
        return;
      }

      const docRef = await addDoc(collection(db, 'savedOutfits'), {
        title: suggestion.title,
        selectedItemIds: suggestion.selectedItemIds,
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        explanationTags: suggestion.explanationTags || [],
        occasion,
        mood,
        weather,
        createdAt: serverTimestamp(),
      });

      setSavedOutfitIds((prev) => ({
        ...prev,
        [suggestionKey]: docRef.id,
      }));

      Alert.alert('Added to favourites', 'This outfit has been saved');
    } catch (error) {
      console.error('Save favourite error:', error);
      Alert.alert('Error', 'Failed to update favourite outfit');
    } finally {
      setSavingSuggestionKey('');
    }
  };

  const handleFeedback = async (
    suggestion: OutfitSuggestion,
    feedback: 'like' | 'dislike'
  ) => {
    const suggestionKey = getSuggestionKey(suggestion);

    try {
      await addDoc(collection(db, 'outfitFeedback'), {
        title: suggestion.title,
        selectedItemIds: suggestion.selectedItemIds,
        reason: suggestion.reason,
        confidence: suggestion.confidence,
        explanationTags: suggestion.explanationTags || [],
        occasion,
        mood,
        weather,
        feedback,
        createdAt: new Date(),
      });

      setFeedbackMap((prev) => ({
        ...prev,
        [suggestionKey]: feedback,
      }));

      Alert.alert(
        'Feedback saved',
        feedback === 'like' ? 'You liked this outfit.' : 'You disliked this outfit.'
      );
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save feedback');
    }
  };

  const savePastLooks = async (outfits: OutfitSuggestion[]) => {
    try {
      for (const outfit of outfits) {
        await addDoc(collection(db, 'pastLooks'), {
          title: outfit.title,
          selectedItemIds: outfit.selectedItemIds,
          reason: outfit.reason,
          confidence: outfit.confidence,
          explanationTags: outfit.explanationTags || [],
          scoringLog: outfit.scoringLog || null,
          occasion,
          mood,
          weather,
          createdAt: new Date(),
        });
      }
    } catch (error) {
      console.error('Failed to save past looks:', error);
    }
  };

  const buildFeedbackSummary = (): FeedbackSummary => {
    const likedColours = new Set<string>();
    const dislikedColours = new Set<string>();
    const likedCategories = new Set<string>();
    const dislikedCategories = new Set<string>();
    const likedOutfitKeys = new Set<string>();
    const dislikedOutfitKeys = new Set<string>();
    const savedOutfitKeys = new Set<string>();
    const preferredOccasions = new Set<string>();
    const preferredMoods = new Set<string>();

    suggestions.forEach((suggestion) => {
      const suggestionKey = getSuggestionKey(suggestion);
      const feedback = feedbackMap[suggestionKey];

      if (feedback === 'like') {
        likedOutfitKeys.add(suggestionKey);
        if (occasion) preferredOccasions.add(occasion.trim());
        if (mood) preferredMoods.add(mood.trim());
      }

      if (feedback === 'dislike') {
        dislikedOutfitKeys.add(suggestionKey);
      }

      const selectedItems = wardrobeItems.filter((item) =>
        suggestion.selectedItemIds.includes(item.id)
      );

      selectedItems.forEach((item) => {
        const colour = item.colour?.trim();
        const category = item.category?.trim().toLowerCase();

        if (!colour || !category) return;

        if (feedback === 'like') {
          likedColours.add(colour);
          likedCategories.add(category);
        }

        if (feedback === 'dislike') {
          dislikedColours.add(colour);
          dislikedCategories.add(category);
        }
      });
    });

    Object.keys(savedOutfitIds).forEach((key) => {
      if (savedOutfitIds[key]) {
        savedOutfitKeys.add(key);
      }
    });

    return {
      likedColours: Array.from(likedColours),
      dislikedColours: Array.from(dislikedColours),
      likedCategories: Array.from(likedCategories),
      dislikedCategories: Array.from(dislikedCategories),
      likedOutfitKeys: Array.from(likedOutfitKeys),
      dislikedOutfitKeys: Array.from(dislikedOutfitKeys),
      savedOutfitKeys: Array.from(savedOutfitKeys),
      preferredOccasions: Array.from(preferredOccasions),
      preferredMoods: Array.from(preferredMoods),
    };
  };

  const handleGetSuggestion = async () => {
    if (!occasion || !mood || !weather) {
      Alert.alert('Missing information', 'Please choose occasion, mood, and weather');
      return;
    }

    if (wardrobeItems.length === 0) {
      Alert.alert('No wardrobe items', 'Please add wardrobe items first');
      return;
    }

    const missingCategoryMessage = getMissingCategoryMessage();

    if (missingCategoryMessage) {
      setNoMatchMessage(missingCategoryMessage);
      Alert.alert('Not enough wardrobe items', missingCategoryMessage);
      return;
    }

    try {
      setLoading(true);
      setSuggestions([]);
      setNoMatchMessage('');
      setSavedOutfitIds({});
      setSavingSuggestionKey('');

      const feedbackSummary = buildFeedbackSummary();

      const response = await fetch('http://192.168.0.83:3001/generate-outfit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wardrobeItems,
          occasion,
          mood,
          weather,
          feedbackSummary,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const data = await response.json();
      const returnedOutfits: OutfitSuggestion[] = data.outfits || [];

      if (!returnedOutfits.length) {
        setSuggestions([]);
        setNoMatchMessage(
          'No items match this request. Add more wardrobe items for better recommendations.'
        );
        Alert.alert(
          'Not enough matching items',
          'No items match this outfit request. Add more wardrobe items for better recommendations.'
        );
        return;
      }

      const validOutfits = returnedOutfits.filter(
        (outfit) => outfit.selectedItemIds && outfit.selectedItemIds.length > 0
      );

      if (!validOutfits.length) {
        setSuggestions([]);
        setNoMatchMessage(
          'No items match this request. Add more wardrobe items for better recommendations.'
        );
        Alert.alert(
          'Not enough matching items',
          'No items match this outfit request. Add more wardrobe items for better recommendations.'
        );
        return;
      }

      setSuggestions(validOutfits);
      await savePastLooks(validOutfits);
    } catch (error) {
      console.error(error);
      Alert.alert(
        'Error',
        'Failed to generate suggestion. If you are using a real device, your backend URL may still be set to localhost.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    registerScreenActions('suggestions', {
      generateOutfit: async () => {
        await handleGetSuggestion();
      },

      saveOutfitByIndex: async (index?: number) => {
        const safeIndex = index ?? 0;
        const suggestion = suggestions[safeIndex];
        if (!suggestion) return;
        await handleToggleFavourite(suggestion);
      },

      setOutfitContext: async ({
        occasion: nextOccasion,
        mood: nextMood,
        weather: nextWeather,
      }: {
        occasion?: string;
        mood?: string;
        weather?: string;
      }) => {
        if (nextOccasion) setOccasion(nextOccasion);
        if (nextMood) setMood(nextMood);
        if (nextWeather) setWeather(nextWeather);
      },
    });
  }, [registerScreenActions, suggestions, occasion, mood, weather]);

  useEffect(() => {
    registerScreenState('suggestions', {
      screenTitle: 'Suggestions',
      occasion,
      mood,
      weather,
      hasSuggestions: suggestions.length > 0,
      suggestionCount: suggestions.length,
      useTodayWeather,
      loading,
    });
  }, [
    occasion,
    mood,
    weather,
    suggestions.length,
    useTodayWeather,
    loading,
    registerScreenState,
  ]);

  const screenDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff' }
    : null;

  const outerFrameDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const innerFrameDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const cardDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const textDynamicStyle = highContrastMode ? { color: '#000000' } : null;

  const titleLineDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000' }
    : null;

  const largeTitleStyle = largerTextEnabled ? { fontSize: 28 } : null;
  const largeSectionTitleStyle = largerTextEnabled ? { fontSize: 18 } : null;
  const largeLabelStyle = largerTextEnabled ? { fontSize: 15 } : null;
  const largeBodyStyle = largerTextEnabled ? { fontSize: 14, lineHeight: 20 } : null;
  const largeButtonStyle = largerTextEnabled ? { fontSize: 16 } : null;

  return (
    <View style={[styles.screen, screenDynamicStyle]}>
      <View style={[styles.outerFrame, outerFrameDynamicStyle]}>
        <ScrollView contentContainerStyle={[styles.innerFrame, innerFrameDynamicStyle]}>
          <View style={styles.headerBlock}>
            <Text style={[styles.title, textDynamicStyle, largeTitleStyle]}>
              Outfit Context
            </Text>
            <View style={[styles.titleLine, titleLineDynamicStyle]} />
          </View>

          {voiceFirstMode ? (
            <Text style={[styles.voiceHintText, textDynamicStyle, largeBodyStyle]}>
              Voice-first mode is on. You can say your occasion, mood, weather,
              or ask the app to generate an outfit.
            </Text>
          ) : null}

          <View style={[styles.contextCard, cardDynamicStyle]}>
            <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
              Occasion
            </Text>
            <View style={[styles.pickerWrapper, cardDynamicStyle]}>
              <Picker selectedValue={occasion} onValueChange={setOccasion} style={styles.picker}>
                <Picker.Item label="Select occasion" value="" />
                <Picker.Item label="Casual" value="Casual" />
                <Picker.Item label="Work" value="Work" />
                <Picker.Item label="Party" value="Party" />
                <Picker.Item label="Formal" value="Formal" />
                <Picker.Item label="Sport" value="Sport" />
              </Picker>
            </View>

            <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
              Mood
            </Text>
            <View style={[styles.pickerWrapper, cardDynamicStyle]}>
              <Picker selectedValue={mood} onValueChange={setMood} style={styles.picker}>
                <Picker.Item label="Select mood" value="" />
                <Picker.Item label="Comfortable" value="Comfortable" />
                <Picker.Item label="Confident" value="Confident" />
                <Picker.Item label="Relaxed" value="Relaxed" />
                <Picker.Item label="Productive" value="Productive" />
                <Picker.Item label="Social" value="Social" />
              </Picker>
            </View>

            <View style={[styles.toggleCard, cardDynamicStyle]}>
              <View style={styles.toggleTextWrap}>
                <Text style={[styles.toggleTitle, textDynamicStyle, largeLabelStyle]}>
                  Use today’s weather
                </Text>
                <Text style={[styles.toggleHint, textDynamicStyle, largeBodyStyle]}>
                  {loadingWeather
                    ? 'Getting current weather...'
                    : useTodayWeather && weather
                    ? `Detected weather: ${weather}`
                    : 'Turn on to auto-fill weather'}
                </Text>
              </View>

              <Switch
                value={useTodayWeather}
                onValueChange={setUseTodayWeather}
                trackColor={{ false: '#bfc5cc', true: '#253041' }}
                thumbColor="#ffffff"
              />
            </View>

            {!useTodayWeather ? (
              <>
                <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
                  Weather
                </Text>
                <View style={[styles.pickerWrapper, cardDynamicStyle]}>
                  <Picker selectedValue={weather} onValueChange={setWeather} style={styles.picker}>
                    <Picker.Item label="Select weather" value="" />
                    <Picker.Item label="Cold" value="Cold" />
                    <Picker.Item label="Mild" value="Mild" />
                    <Picker.Item label="Warm" value="Warm" />
                    <Picker.Item label="Rainy" value="Rainy" />
                  </Picker>
                </View>
              </>
            ) : (
              <View style={[styles.weatherBadgeBox, cardDynamicStyle]}>
                <Text
                  style={[styles.weatherBadgeLabel, textDynamicStyle, largeBodyStyle]}
                >
                  Weather
                </Text>
                <Text
                  style={[styles.weatherBadgeValue, textDynamicStyle, largeLabelStyle]}
                >
                  {weather || 'Loading...'}
                </Text>
              </View>
            )}

            <Pressable
              style={[styles.primaryButton, cardDynamicStyle]}
              onPress={handleGetSuggestion}
            >
              <Text
                style={[styles.primaryButtonText, textDynamicStyle, largeButtonStyle]}
              >
                {loading ? 'Generating...' : 'Continue'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, cardDynamicStyle]}
              onPress={handleClearSelections}
            >
              <Text
                style={[styles.secondaryButtonText, textDynamicStyle, largeButtonStyle]}
              >
                Clear selections
              </Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.statusBox}>
              <ActivityIndicator size="small" color="#253041" />
              <Text style={[styles.statusText, textDynamicStyle, largeBodyStyle]}>
                Generating your outfits...
              </Text>
            </View>
          ) : null}

          {loadingWardrobe ? (
            <View style={styles.statusBox}>
              <ActivityIndicator size="small" color="#253041" />
              <Text style={[styles.statusText, textDynamicStyle, largeBodyStyle]}>
                Loading wardrobe...
              </Text>
            </View>
          ) : null}

          {wardrobeItems.length > 0 && !hasEnoughWardrobeItems ? (
            <Text style={[styles.warningText, largeBodyStyle]}>
              {getMissingCategoryMessage() || 'Add more items for better recommendations.'}
            </Text>
          ) : null}

          {noMatchMessage ? (
            <Text style={[styles.warningText, largeBodyStyle]}>{noMatchMessage}</Text>
          ) : null}

          {suggestions.length > 0 ? (
            <View style={styles.resultsSection}>
              <Text
                style={[styles.resultsTitle, textDynamicStyle, largeTitleStyle]}
              >
                Recommended Outfits
              </Text>
              <View style={[styles.titleLine, titleLineDynamicStyle]} />

              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalResults}
              >
                {suggestions.map((suggestion, index) => {
                  const selectedItems = wardrobeItems.filter((item) =>
                    suggestion.selectedItemIds.includes(item.id)
                  );

                  const suggestionKey = getSuggestionKey(suggestion);
                  const isSaved = !!savedOutfitIds[suggestionKey];
                  const isSaving = savingSuggestionKey === suggestionKey;

                  const optionLabel =
                    index === 0 ? 'Outfit 1' : index === 1 ? 'Outfit 2' : 'Outfit 3';

                  return (
                    <View key={`${suggestionKey}-${index}`} style={styles.swipeCard}>
                      <Text
                        style={[styles.optionLabel, textDynamicStyle, largeBodyStyle]}
                      >
                        {optionLabel}
                      </Text>

                      {suggestion.weakRecommendation ? (
                        <Text style={[styles.weakText, textDynamicStyle, largeBodyStyle]}>
                          Limited suitable items found — showing best available option.
                        </Text>
                      ) : null}

                      <OutfitOptionCard
                        title={suggestion.title}
                        reason={suggestion.reason}
                        confidence={suggestion.confidence}
                        selectedItems={selectedItems}
                        isSaved={isSaved}
                        onSave={() => handleToggleFavourite(suggestion)}
                        saving={isSaving}
                        feedback={feedbackMap[suggestionKey] || ''}
                        onLike={() => handleFeedback(suggestion, 'like')}
                        onDislike={() => handleFeedback(suggestion, 'dislike')}
                        explanationTags={suggestion.explanationTags || []}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f4f4',
    padding: 10,
  },
  outerFrame: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#253041',
    borderRadius: 26,
    padding: 8,
    backgroundColor: '#f4f4f4',
  },
  innerFrame: {
    flexGrow: 1,
    borderWidth: 1.5,
    borderColor: '#cfd4da',
    borderRadius: 22,
    backgroundColor: '#f7f7f7',
    paddingHorizontal: 14,
    paddingTop: 22,
    paddingBottom: 130,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#2b3440',
  },
  titleLine: {
    width: 34,
    height: 2,
    backgroundColor: '#7f8791',
    marginTop: 10,
    borderRadius: 10,
  },
  voiceHintText: {
    fontSize: 13,
    color: '#616973',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  contextCard: {
    borderWidth: 2,
    borderColor: '#2d3847',
    backgroundColor: '#fbfbfb',
    padding: 16,
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#49525c',
  },
  pickerWrapper: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#ffffff',
    marginBottom: 14,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  picker: {
    height: 52,
    width: '100%',
    color: '#2b3440',
  },
  toggleCard: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toggleTextWrap: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2b3440',
    marginBottom: 2,
  },
  toggleHint: {
    fontSize: 12,
    color: '#6a727b',
    lineHeight: 16,
  },
  weatherBadgeBox: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  weatherBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6e7780',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  weatherBadgeValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2b3440',
  },
  primaryButton: {
    borderWidth: 2,
    borderColor: '#2d3847',
    backgroundColor: '#f8f8f8',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#2b3440',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: '#e7eaee',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cfd4da',
  },
  secondaryButtonText: {
    color: '#2b3440',
    fontWeight: '600',
    fontSize: 14,
  },
  statusBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginBottom: 8,
  },
  statusText: {
    marginTop: 8,
    fontSize: 13,
    color: '#616973',
  },
  resultsSection: {
    marginTop: 12,
    alignItems: 'center',
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2b3440',
    textAlign: 'center',
  },
  horizontalResults: {
    paddingTop: 18,
    paddingBottom: 8,
  },
  swipeCard: {
    width: 325,
    marginRight: 16,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#616973',
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    marginTop: 10,
    marginBottom: 4,
    fontSize: 13,
    color: '#b00020',
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 10,
  },
  weakText: {
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
    color: '#777',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});