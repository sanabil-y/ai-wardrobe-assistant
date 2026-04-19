import * as Speech from 'expo-speech';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import React, { useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import SafeImage from '../../components/SafeImage';
import { useAppSettings } from '../../context/appSettingsContext';
import { useVoiceAssistant } from '../../context/voiceAssistantContext';
import { db } from '../../firebaseConfig';

type SavedOutfit = {
  id: string;
  title: string;
  selectedItemIds: string[];
  reason: string;
  occasion: string;
  mood: string;
  weather: string;
  createdAt?: any;
};

type WardrobeItem = {
  id: string;
  itemName: string;
  category: string;
  colour: string;
  imageUrl: string;
  occasion?: string;
  mood?: string;
  description?: string;
};

export default function SavedOutfitsScreen() {
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [wardrobeItems, setWardrobeItems] = useState<WardrobeItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [loadingSavedOutfits, setLoadingSavedOutfits] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const { registerScreen, registerScreenActions, registerScreenState } =
    useVoiceAssistant();

  const {
    audioDescriptionsEnabled,
    highContrastMode,
    largerTextEnabled,
  } = useAppSettings();

  useEffect(() => {
    const savedQuery = query(
      collection(db, 'savedOutfits'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeSaved = onSnapshot(savedQuery, (snapshot) => {
      const saved = snapshot.docs.map((savedDoc) => ({
        id: savedDoc.id,
        ...savedDoc.data(),
      })) as SavedOutfit[];

      const sortedSaved = saved.sort((a, b) => {
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

      setSavedOutfits(sortedSaved);
      setLoadingSavedOutfits(false);
    });

    const unsubscribeWardrobe = onSnapshot(collection(db, 'wardrobe'), (snapshot) => {
      const wardrobe = snapshot.docs.map((wardrobeDoc) => ({
        id: wardrobeDoc.id,
        ...wardrobeDoc.data(),
      })) as WardrobeItem[];

      setWardrobeItems(wardrobe);
    });

    return () => {
      unsubscribeSaved();
      unsubscribeWardrobe();
      Speech.stop();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      registerScreen('savedOutfits');
    }, [registerScreen])
  );

  const formatSavedDate = (createdAt: any) => {
    if (!createdAt) return '';

    try {
      const date =
        typeof createdAt.toDate === 'function'
          ? createdAt.toDate()
          : new Date(createdAt);

      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      });
    } catch {
      return '';
    }
  };

  const getItemsForOutfit = (selectedItemIds: string[]) => {
    return wardrobeItems.filter((item) => selectedItemIds.includes(item.id));
  };

  const savedStats = useMemo(() => {
    const occasions: Record<string, number> = {};
    const moods: Record<string, number> = {};
    const colours: Record<string, number> = {};

    savedOutfits.forEach((outfit) => {
      if (outfit.occasion) {
        occasions[outfit.occasion] = (occasions[outfit.occasion] || 0) + 1;
      }

      if (outfit.mood) {
        moods[outfit.mood] = (moods[outfit.mood] || 0) + 1;
      }

      const items = getItemsForOutfit(outfit.selectedItemIds);

      items.forEach((item) => {
        if (item.colour) {
          colours[item.colour] = (colours[item.colour] || 0) + 1;
        }
      });
    });

    const getTopLabel = (obj: Record<string, number>) => {
      const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
      return entries.length ? entries[0][0] : '';
    };

    return {
      favouriteOccasion: getTopLabel(occasions),
      favouriteMood: getTopLabel(moods),
      favouriteColour: getTopLabel(colours),
    };
  }, [savedOutfits, wardrobeItems]);

  const handleRemoveSavedOutfit = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'savedOutfits', id));
      Alert.alert('Removed', 'Outfit removed from favourites');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to remove saved outfit');
    }
  };

  const handleReadAloud = () => {
    if (!audioDescriptionsEnabled) {
      Alert.alert(
        'Audio descriptions off',
        'Turn audio descriptions on in Accessibility settings to use this feature.'
      );
      return;
    }

    if (!selectedItem) return;

    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    const speechText = `${selectedItem.itemName}. Category: ${selectedItem.category}. Colour: ${selectedItem.colour}.${selectedItem.occasion ? ` Occasion: ${selectedItem.occasion}.` : ''}${selectedItem.mood ? ` Mood: ${selectedItem.mood}.` : ''}${selectedItem.description ? ` Description: ${selectedItem.description}.` : ''}`;

    Speech.speak(speechText, {
      rate: 0.95,
      pitch: 1,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });

    setIsSpeaking(true);
  };

  const openSavedOutfitByIndex = async (index?: number) => {
    const safeIndex = index ?? 0;
    const savedOutfit = savedOutfits[safeIndex];
    if (!savedOutfit) return;

    const matchedItems = getItemsForOutfit(savedOutfit.selectedItemIds);
    if (!matchedItems.length) return;

    Speech.stop();
    setIsSpeaking(false);
    setSelectedItem(matchedItems[0]);
  };

  useEffect(() => {
    registerScreenActions('savedOutfits', {
      openSavedOutfitByIndex: async (index?: number) => {
        await openSavedOutfitByIndex(index);
      },

      removeSavedOutfitByIndex: async (index?: number) => {
        const safeIndex = index ?? 0;
        const outfit = savedOutfits[safeIndex];
        if (!outfit) return;

        await handleRemoveSavedOutfit(outfit.id);
      },
    });
  }, [savedOutfits, registerScreenActions]);

  useEffect(() => {
    registerScreenState('savedOutfits', {
      savedCount: savedOutfits.length,
      selectedItemName: selectedItem?.itemName || '',
      topOccasion: savedStats.favouriteOccasion || '',
      topMood: savedStats.favouriteMood || '',
      topColour: savedStats.favouriteColour || '',
    });
  }, [savedOutfits, selectedItem, savedStats, registerScreenState]);

  const containerDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff' }
    : null;

  const cardDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const darkPanelDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000', borderColor: '#000000' }
    : null;

  const darkButtonDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000', borderColor: '#000000' }
    : null;

  const whiteButtonDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const underlineDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000' }
    : null;

  const modalOverlayDynamicStyle = highContrastMode
    ? { backgroundColor: 'rgba(0,0,0,0.6)' }
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
          Saved Outfits
        </Text>
        <View style={[styles.titleUnderline, underlineDynamicStyle]} />
        <Text style={[styles.subtitle, textDynamicStyle, largeBodyStyle]}>
          Your favourite combinations are kept here for quick access.
        </Text>
      </View>

      {savedOutfits.length > 0 ? (
        <View style={[styles.summaryCard, cardDynamicStyle]}>
          <Text style={[styles.summaryTitle, textDynamicStyle, largeButtonStyle]}>
            Quick style snapshot
          </Text>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryPill, cardDynamicStyle]}>
              <Text
                style={[styles.summaryPillLabel, textDynamicStyle, largeSmallStyle]}
              >
                Top occasion
              </Text>
              <Text
                style={[styles.summaryPillValue, textDynamicStyle, largeBodyStyle]}
              >
                {savedStats.favouriteOccasion || '—'}
              </Text>
            </View>

            <View style={[styles.summaryPill, cardDynamicStyle]}>
              <Text
                style={[styles.summaryPillLabel, textDynamicStyle, largeSmallStyle]}
              >
                Top mood
              </Text>
              <Text
                style={[styles.summaryPillValue, textDynamicStyle, largeBodyStyle]}
              >
                {savedStats.favouriteMood || '—'}
              </Text>
            </View>

            <View style={[styles.summaryPill, cardDynamicStyle]}>
              <Text
                style={[styles.summaryPillLabel, textDynamicStyle, largeSmallStyle]}
              >
                Top colour
              </Text>
              <Text
                style={[styles.summaryPillValue, textDynamicStyle, largeBodyStyle]}
              >
                {savedStats.favouriteColour || '—'}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {loadingSavedOutfits ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#111" />
          <Text style={[styles.loadingText, textDynamicStyle, largeBodyStyle]}>
            Loading saved outfits...
          </Text>
        </View>
      ) : null}

      <FlatList
        data={savedOutfits}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const matchedItems = getItemsForOutfit(item.selectedItemIds);

          return (
            <View style={[styles.card, cardDynamicStyle]}>
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleBlock}>
                  <Text style={[styles.cardTitle, textDynamicStyle, largeCardTitleStyle]}>
                    {item.title}
                  </Text>
                  <View style={[styles.smallUnderline, underlineDynamicStyle]} />
                </View>

                {formatSavedDate(item.createdAt) ? (
                  <View style={[styles.dateBadge, darkPanelDynamicStyle]}>
                    <Text
                      style={[
                        styles.dateBadgeText,
                        invertedTextStyle,
                        largeSmallStyle,
                      ]}
                    >
                      {formatSavedDate(item.createdAt)}
                    </Text>
                  </View>
                ) : null}
              </View>

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

              <Text style={[styles.reasonText, textDynamicStyle, largeBodyStyle]}>
                {item.reason}
              </Text>

              {matchedItems.length > 0 ? (
                <View style={styles.itemsWrap}>
                  {matchedItems.map((clothingItem) => (
                    <Pressable
                      key={clothingItem.id}
                      style={[styles.itemCard, cardDynamicStyle]}
                      onPress={() => {
                        Speech.stop();
                        setIsSpeaking(false);
                        setSelectedItem(clothingItem);
                      }}
                    >
                      <View style={[styles.itemFrameOuter, cardDynamicStyle]}>
                        <View style={[styles.itemFrameInner, cardDynamicStyle]}>
                          <SafeImage
                            uri={clothingItem.imageUrl}
                            style={styles.itemImage}
                          />
                        </View>
                      </View>

                      <Text style={[styles.itemName, textDynamicStyle, largeBodyStyle]}>
                        {clothingItem.itemName}
                      </Text>
                      <Text style={[styles.itemMeta, textDynamicStyle, largeSmallStyle]}>
                        {clothingItem.category} • {clothingItem.colour}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={[styles.emptyMatchedCard, cardDynamicStyle]}>
                  <Text
                    style={[styles.emptyMatchedTitle, textDynamicStyle, largeButtonStyle]}
                  >
                    Missing wardrobe items
                  </Text>
                  <Text
                    style={[styles.emptyMatchedText, textDynamicStyle, largeBodyStyle]}
                  >
                    This saved outfit no longer links to available wardrobe pieces.
                  </Text>
                </View>
              )}

              <View style={[styles.actionPanel, darkPanelDynamicStyle]}>
                <Pressable
                  style={[styles.removeButton, whiteButtonDynamicStyle]}
                  onPress={() => handleRemoveSavedOutfit(item.id)}
                >
                  <Text
                    style={[styles.removeButtonText, textDynamicStyle, largeButtonStyle]}
                  >
                    ♥ Remove
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={[styles.emptyStateCard, cardDynamicStyle]}>
            <Text
              style={[styles.emptyStateTitle, textDynamicStyle, largeCardTitleStyle]}
            >
              No saved outfits yet
            </Text>
            <Text style={[styles.emptyText, textDynamicStyle, largeBodyStyle]}>
              Save the combinations you like most and they will appear here.
            </Text>
          </View>
        }
      />

      <Modal
        visible={selectedItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Speech.stop();
          setIsSpeaking(false);
          setSelectedItem(null);
        }}
      >
        <View style={[styles.modalOverlay, modalOverlayDynamicStyle]}>
          <View style={[styles.modalContent, cardDynamicStyle]}>
            {selectedItem ? (
              <>
                <View style={[styles.modalImageOuter, cardDynamicStyle]}>
                  <View style={[styles.modalImageInner, cardDynamicStyle]}>
                    <Image
                      source={{ uri: selectedItem.imageUrl }}
                      style={styles.modalImage}
                    />
                  </View>
                </View>

                <Text style={[styles.modalTitle, textDynamicStyle, largeCardTitleStyle]}>
                  {selectedItem.itemName}
                </Text>
                <View style={[styles.smallUnderlineLeft, underlineDynamicStyle]} />

                <Text style={[styles.modalText, textDynamicStyle, largeBodyStyle]}>
                  Category: {selectedItem.category}
                </Text>
                <Text style={[styles.modalText, textDynamicStyle, largeBodyStyle]}>
                  Colour: {selectedItem.colour}
                </Text>
                {selectedItem.occasion ? (
                  <Text style={[styles.modalText, textDynamicStyle, largeBodyStyle]}>
                    Occasion: {selectedItem.occasion}
                  </Text>
                ) : null}
                {selectedItem.mood ? (
                  <Text style={[styles.modalText, textDynamicStyle, largeBodyStyle]}>
                    Mood: {selectedItem.mood}
                  </Text>
                ) : null}
                {selectedItem.description ? (
                  <Text style={[styles.modalText, textDynamicStyle, largeBodyStyle]}>
                    Description: {selectedItem.description}
                  </Text>
                ) : null}

                <View style={[styles.modalActionPanel, darkPanelDynamicStyle]}>
                  {audioDescriptionsEnabled ? (
                    <Pressable
                      style={[styles.speakButton, whiteButtonDynamicStyle]}
                      onPress={handleReadAloud}
                    >
                      <Text
                        style={[styles.speakButtonText, textDynamicStyle, largeButtonStyle]}
                      >
                        {isSpeaking ? '⏹ Stop reading' : '🔊 Read item aloud'}
                      </Text>
                    </Pressable>
                  ) : null}

                  <Pressable
                    style={[styles.closeButton, darkButtonDynamicStyle]}
                    onPress={() => {
                      Speech.stop();
                      setIsSpeaking(false);
                      setSelectedItem(null);
                    }}
                  >
                    <Text
                      style={[
                        styles.closeButtonText,
                        invertedTextStyle,
                        largeButtonStyle,
                      ]}
                    >
                      Close
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  summaryCard: {
    marginHorizontal: 24,
    marginBottom: 14,
    backgroundColor: '#f7f7f7',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryPill: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 92,
  },
  summaryPillLabel: {
    fontSize: 11,
    color: '#777',
    marginBottom: 4,
  },
  summaryPillValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
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
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 12,
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
  dateBadge: {
    backgroundColor: '#111',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  dateBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
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
  reasonText: {
    fontSize: 14,
    color: '#444',
    marginBottom: 14,
    lineHeight: 20,
  },
  itemsWrap: {
    gap: 12,
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
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
  actionPanel: {
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 10,
    alignItems: 'flex-start',
  },
  removeButton: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  removeButtonText: {
    color: '#b00020',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 15,
    lineHeight: 22,
  },
  emptyMatchedCard: {
    backgroundColor: '#fff6f6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0d1d1',
    padding: 14,
    marginBottom: 12,
  },
  emptyMatchedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#b00020',
    marginBottom: 6,
  },
  emptyMatchedText: {
    fontSize: 14,
    color: '#777',
    lineHeight: 20,
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
  savedDateText: {
    fontSize: 13,
    color: '#777',
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  modalImageOuter: {
    borderWidth: 1.2,
    borderColor: '#d0d0d0',
    borderRadius: 16,
    padding: 8,
    backgroundColor: '#f8f8f8',
    marginBottom: 12,
  },
  modalImageInner: {
    borderWidth: 1.2,
    borderColor: '#111',
    borderRadius: 14,
    padding: 8,
    backgroundColor: '#fff',
  },
  modalImage: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    resizeMode: 'contain',
    backgroundColor: '#f2f2f2',
  },
  modalTitle: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  smallUnderlineLeft: {
    width: 44,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#111',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 15,
    color: '#444',
    marginBottom: 6,
    lineHeight: 21,
  },
  modalActionPanel: {
    marginTop: 16,
    backgroundColor: '#111',
    borderRadius: 14,
    padding: 10,
  },
  speakButton: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
  },
  speakButtonText: {
    color: '#111',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
  closeButton: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 10,
  },
  closeButtonText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 15,
  },
});