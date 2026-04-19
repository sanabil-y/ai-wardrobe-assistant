import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
} from 'firebase/firestore';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import SafeImage from '../../components/SafeImage';
import { useAppSettings } from '../../context/appSettingsContext';
import { useVoiceAssistant } from '../../context/voiceAssistantContext';
import { db } from '../../firebaseConfig';

type PastLook = {
  id: string;
  title: string;
  selectedItemIds: string[];
  reason: string;
  confidence?: number;
  occasion: string;
  mood: string;
  weather: string;
  explanationTags?: string[];
  createdAt?: any;
};

type WardrobeItem = {
  id: string;
  itemName: string;
  category: string;
  colour: string;
  imageUrl: string;
};

export default function PastLooksScreen() {
  const [pastLooks, setPastLooks] = useState<PastLook[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [speakingId, setSpeakingId] = useState('');

  const { registerScreen, registerScreenActions, registerScreenState } =
    useVoiceAssistant();

  const {
    audioDescriptionsEnabled,
    highContrastMode,
    largerTextEnabled,
  } = useAppSettings();

  useEffect(() => {
    const unsubscribePastLooks = onSnapshot(collection(db, 'pastLooks'), (snapshot) => {
      const looks = snapshot.docs.map((lookDoc) => ({
        id: lookDoc.id,
        ...lookDoc.data(),
      })) as PastLook[];

      const sortedLooks = looks.sort((a, b) => {
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

      setPastLooks(sortedLooks);
      setLoading(false);
    });

    const unsubscribeWardrobe = onSnapshot(collection(db, 'wardrobe'), (snapshot) => {
      const items = snapshot.docs.map((wardrobeDoc) => ({
        id: wardrobeDoc.id,
        ...wardrobeDoc.data(),
      })) as WardrobeItem[];

      setWardrobeItems(items);
    });

    return () => {
      unsubscribePastLooks();
      unsubscribeWardrobe();
      Speech.stop();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      registerScreen('pastLooks');
    }, [registerScreen])
  );

  const formatSavedDate = (createdAt: any) => {
    if (!createdAt) return 'Unknown date';

    try {
      const date =
        typeof createdAt.toDate === 'function'
          ? createdAt.toDate()
          : new Date(createdAt);

      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Unknown date';
    }
  };

  const getItemsForLook = (selectedItemIds: string[]) => {
    return selectedItemIds.map((id) => {
      const matchedItem = wardrobeItems.find((item) => item.id === id);
      return matchedItem || null;
    });
  };

  const analytics = useMemo(() => {
    const colourCounts: Record<string, number> = {};
    const moodCounts: Record<string, number> = {};
    const occasionCounts: Record<string, number> = {};
    const weatherCounts: Record<string, number> = {};

    pastLooks.forEach((look) => {
      if (look.mood) {
        moodCounts[look.mood] = (moodCounts[look.mood] || 0) + 1;
      }

      if (look.occasion) {
        occasionCounts[look.occasion] = (occasionCounts[look.occasion] || 0) + 1;
      }

      if (look.weather) {
        weatherCounts[look.weather] = (weatherCounts[look.weather] || 0) + 1;
      }

      const matchedItems = getItemsForLook(look.selectedItemIds);

      matchedItems.forEach((item) => {
        if (item?.colour) {
          colourCounts[item.colour] = (colourCounts[item.colour] || 0) + 1;
        }
      });
    });

    const getTopValue = (map: Record<string, number>) => {
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
      return sorted.length ? sorted[0][0] : '—';
    };

    return {
      topColour: getTopValue(colourCounts),
      topMood: getTopValue(moodCounts),
      topOccasion: getTopValue(occasionCounts),
      topWeather: getTopValue(weatherCounts),
    };
  }, [pastLooks, wardrobeItems]);

  const handleReadLookAloud = (look: PastLook) => {
    if (!audioDescriptionsEnabled) {
      Alert.alert(
        'Audio descriptions off',
        'Turn audio descriptions on in Accessibility settings to use this feature.'
      );
      return;
    }

    if (speakingId === look.id) {
      Speech.stop();
      setSpeakingId('');
      return;
    }

    const matchedItems = getItemsForLook(look.selectedItemIds);

    const itemText = matchedItems
      .map((item) =>
        item ? `${item.itemName}, ${item.colour}, ${item.category}` : 'Deleted item'
      )
      .join('. ');

    const tagsText =
      look.explanationTags && look.explanationTags.length > 0
        ? `Key reasons: ${look.explanationTags.join('. ')}. `
        : '';

    const speechText = `${look.title}. Generated on ${formatSavedDate(
      look.createdAt
    )}. Occasion: ${look.occasion}. Mood: ${look.mood}. Weather: ${look.weather}. ${
      look.confidence ? `${look.confidence}% match.` : ''
    } ${tagsText}${look.reason}. Items included: ${itemText}.`;

    Speech.speak(speechText, {
      rate: 0.95,
      pitch: 1,
      onDone: () => setSpeakingId(''),
      onStopped: () => setSpeakingId(''),
      onError: () => setSpeakingId(''),
    });

    setSpeakingId(look.id);
  };

  const clearPastLooks = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'pastLooks'));

      if (snapshot.empty) {
        Alert.alert('Nothing to clear', 'There are no past looks to remove.');
        return;
      }

      for (const lookDoc of snapshot.docs) {
        await deleteDoc(doc(db, 'pastLooks', lookDoc.id));
      }

      Speech.stop();
      setSpeakingId('');
      Alert.alert('Cleared', 'Past looks history has been removed.');
    } catch (error) {
      console.error('Clear history error:', error);
      Alert.alert('Error', 'Failed to clear past looks.');
    }
  };

  const handleClearHistory = () => {
    clearPastLooks();
  };

  const readLatestLook = async () => {
    const latestLook = pastLooks[0];
    if (!latestLook) return;
    handleReadLookAloud(latestLook);
  };

  const readLookByIndex = async (index?: number) => {
    const safeIndex = index ?? 0;
    const look = pastLooks[safeIndex];
    if (!look) return;
    handleReadLookAloud(look);
  };

  useEffect(() => {
    registerScreenActions('pastLooks', {
      readLatestLook: async () => {
        await readLatestLook();
      },

      readLookByIndex: async (index?: number) => {
        await readLookByIndex(index);
      },

      clearPastLooksHistory: async () => {
        await clearPastLooks();
      },
    });
  }, [pastLooks, wardrobeItems, registerScreenActions]);

  useEffect(() => {
    registerScreenState('pastLooks', {
      lookCount: pastLooks.length,
      topColour: analytics.topColour,
      topMood: analytics.topMood,
      topOccasion: analytics.topOccasion,
      topWeather: analytics.topWeather,
      currentlyReadingId: speakingId,
    });
  }, [pastLooks, analytics, speakingId, registerScreenState]);

  const containerDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff' }
    : null;

  const cardDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const darkPanelDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000', borderColor: '#000000' }
    : null;

  const buttonLightDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const underlineDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000' }
    : null;

  const textDynamicStyle = highContrastMode ? { color: '#000000' } : null;
  const invertedTextStyle = { color: '#ffffff' };

  const largeTitleStyle = largerTextEnabled ? { fontSize: 32 } : null;
  const largeCardTitleStyle = largerTextEnabled ? { fontSize: 21 } : null;
  const largeBodyStyle = largerTextEnabled ? { fontSize: 16, lineHeight: 24 } : null;
  const largeSmallStyle = largerTextEnabled ? { fontSize: 13, lineHeight: 19 } : null;
  const largeButtonStyle = largerTextEnabled ? { fontSize: 16 } : null;

  return (
    <View style={[styles.container, containerDynamicStyle]}>
      <View style={styles.headerWrap}>
        <Text style={[styles.title, textDynamicStyle, largeTitleStyle]}>
          Past Looks
        </Text>
        <View style={[styles.titleUnderline, underlineDynamicStyle]} />
        <Text style={[styles.subtitle, textDynamicStyle, largeBodyStyle]}>
          Review earlier recommendations and spot your style patterns over time.
        </Text>
      </View>

      {pastLooks.length > 0 ? (
        <View style={[styles.analyticsCard, cardDynamicStyle]}>
          <Text style={[styles.analyticsTitle, textDynamicStyle, largeButtonStyle]}>
            Style patterns
          </Text>

          <View style={styles.analyticsGrid}>
            <View style={[styles.analyticsPill, cardDynamicStyle]}>
              <Text style={[styles.analyticsLabel, textDynamicStyle, largeSmallStyle]}>
                Top colour
              </Text>
              <Text style={[styles.analyticsValue, textDynamicStyle, largeBodyStyle]}>
                {analytics.topColour}
              </Text>
            </View>

            <View style={[styles.analyticsPill, cardDynamicStyle]}>
              <Text style={[styles.analyticsLabel, textDynamicStyle, largeSmallStyle]}>
                Top mood
              </Text>
              <Text style={[styles.analyticsValue, textDynamicStyle, largeBodyStyle]}>
                {analytics.topMood}
              </Text>
            </View>

            <View style={[styles.analyticsPill, cardDynamicStyle]}>
              <Text style={[styles.analyticsLabel, textDynamicStyle, largeSmallStyle]}>
                Top occasion
              </Text>
              <Text style={[styles.analyticsValue, textDynamicStyle, largeBodyStyle]}>
                {analytics.topOccasion}
              </Text>
            </View>

            <View style={[styles.analyticsPill, cardDynamicStyle]}>
              <Text style={[styles.analyticsLabel, textDynamicStyle, largeSmallStyle]}>
                Top weather
              </Text>
              <Text style={[styles.analyticsValue, textDynamicStyle, largeBodyStyle]}>
                {analytics.topWeather}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <Pressable
        style={[styles.clearButton, darkPanelDynamicStyle]}
        onPress={handleClearHistory}
      >
        <Text
          style={[styles.clearButtonText, invertedTextStyle, largeButtonStyle]}
        >
          Clear History
        </Text>
      </Pressable>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#111" />
          <Text style={[styles.loadingText, textDynamicStyle, largeBodyStyle]}>
            Loading past looks...
          </Text>
        </View>
      ) : null}

      <FlatList
        data={pastLooks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const matchedItems = getItemsForLook(item.selectedItemIds);

          return (
            <View style={[styles.card, cardDynamicStyle]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleBlock}>
                  <Text style={[styles.cardTitle, textDynamicStyle, largeCardTitleStyle]}>
                    {item.title}
                  </Text>
                  <View style={[styles.smallUnderline, underlineDynamicStyle]} />
                </View>

                {item.confidence ? (
                  <View style={[styles.confidenceBadge, darkPanelDynamicStyle]}>
                    <Text
                      style={[
                        styles.confidenceBadgeText,
                        invertedTextStyle,
                        largeSmallStyle,
                      ]}
                    >
                      {item.confidence}%
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text style={[styles.dateText, textDynamicStyle, largeSmallStyle]}>
                Generated on {formatSavedDate(item.createdAt)}
              </Text>

              <View style={styles.metaRow}>
                <View style={[styles.metaPill, cardDynamicStyle]}>
                  <Text style={[styles.metaPillText, textDynamicStyle, largeSmallStyle]}>
                    {item.occasion}
                  </Text>
                </View>
                <View style={[styles.metaPill, cardDynamicStyle]}>
                  <Text style={[styles.metaPillText, textDynamicStyle, largeSmallStyle]}>
                    {item.mood}
                  </Text>
                </View>
                <View style={[styles.metaPill, cardDynamicStyle]}>
                  <Text style={[styles.metaPillText, textDynamicStyle, largeSmallStyle]}>
                    {item.weather}
                  </Text>
                </View>
              </View>

              {item.explanationTags && item.explanationTags.length > 0 ? (
                <View style={styles.tagsRow}>
                  {item.explanationTags.map((tag) => (
                    <View key={tag} style={[styles.tagPill, cardDynamicStyle]}>
                      <Text style={[styles.tagText, textDynamicStyle, largeSmallStyle]}>
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={[styles.reasonText, textDynamicStyle, largeBodyStyle]}>
                {item.reason}
              </Text>

              {matchedItems.map((lookItem, index) =>
                lookItem ? (
                  <View key={lookItem.id} style={[styles.itemCard, cardDynamicStyle]}>
                    <View style={[styles.itemFrameOuter, cardDynamicStyle]}>
                      <View style={[styles.itemFrameInner, cardDynamicStyle]}>
                        <SafeImage uri={lookItem.imageUrl} style={styles.itemImage} />
                      </View>
                    </View>

                    <Text style={[styles.itemName, textDynamicStyle, largeBodyStyle]}>
                      {lookItem.itemName}
                    </Text>
                    <Text style={[styles.itemMeta, textDynamicStyle, largeSmallStyle]}>
                      {lookItem.category} • {lookItem.colour}
                    </Text>
                  </View>
                ) : (
                  <View key={`deleted-${index}`} style={[styles.deletedItemCard, cardDynamicStyle]}>
                    <Text
                      style={[styles.deletedItemTitle, textDynamicStyle, largeButtonStyle]}
                    >
                      Deleted item
                    </Text>
                    <Text
                      style={[styles.deletedItemText, textDynamicStyle, largeBodyStyle]}
                    >
                      This item is no longer available in the wardrobe.
                    </Text>
                  </View>
                )
              )}

              {audioDescriptionsEnabled ? (
                <View style={[styles.actionPanel, darkPanelDynamicStyle]}>
                  <Pressable
                    style={[styles.speakButton, buttonLightDynamicStyle]}
                    onPress={() => handleReadLookAloud(item)}
                  >
                    <Text
                      style={[styles.speakButtonText, textDynamicStyle, largeButtonStyle]}
                    >
                      {speakingId === item.id ? '⏹ Stop reading' : '🔊 Read look aloud'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.emptyStateCard, cardDynamicStyle]}>
            <Text
              style={[styles.emptyStateTitle, textDynamicStyle, largeCardTitleStyle]}
            >
              No past looks yet
            </Text>
            <Text style={[styles.emptyText, textDynamicStyle, largeBodyStyle]}>
              Generate outfit suggestions and your recent history will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 24,
  },
  headerWrap: {
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    color: '#111',
  },
  titleUnderline: {
    width: 68,
    height: 3,
    backgroundColor: '#111',
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#666',
    lineHeight: 20,
  },
  analyticsCard: {
    marginHorizontal: 24,
    marginBottom: 14,
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    borderWidth: 1.2,
    borderColor: '#e5e5e5',
    padding: 16,
  },
  analyticsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  analyticsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  analyticsPill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 95,
  },
  analyticsLabel: {
    fontSize: 11,
    color: '#777',
    marginBottom: 4,
  },
  analyticsValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
  },
  clearButton: {
    backgroundColor: '#111',
    marginHorizontal: 24,
    padding: 13,
    borderRadius: 12,
    marginBottom: 14,
  },
  clearButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#555',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 120,
  },
  card: {
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.2,
    borderColor: '#dcdcdc',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  cardTitleBlock: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 6,
    color: '#111',
  },
  smallUnderline: {
    width: 42,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#111',
  },
  confidenceBadge: {
    backgroundColor: '#111',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  confidenceBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  dateText: {
    fontSize: 13,
    color: '#777',
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  metaPill: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dddddd',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tagPill: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dddddd',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  reasonText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 12,
    lineHeight: 20,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  itemFrameOuter: {
    borderWidth: 1.2,
    borderColor: '#d0d0d0',
    borderRadius: 14,
    padding: 8,
    backgroundColor: '#f8f8f8',
    marginBottom: 10,
  },
  itemFrameInner: {
    borderWidth: 1.2,
    borderColor: '#111',
    borderRadius: 12,
    padding: 8,
    backgroundColor: '#fff',
  },
  itemImage: {
    width: '100%',
    height: 170,
    borderRadius: 10,
    resizeMode: 'contain',
    backgroundColor: '#f2f2f2',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 14,
    color: '#555',
  },
  deletedItemCard: {
    backgroundColor: '#fff3f3',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#f0cccc',
  },
  deletedItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b00020',
    marginBottom: 4,
  },
  deletedItemText: {
    fontSize: 14,
    color: '#777',
    lineHeight: 20,
  },
  actionPanel: {
    marginTop: 8,
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 10,
  },
  speakButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
  },
  speakButtonText: {
    color: '#111',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyStateCard: {
    marginTop: 20,
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 18,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 15,
    lineHeight: 22,
    paddingHorizontal: 12,
  },
});