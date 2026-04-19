import { Picker } from '@react-native-picker/picker';
import { useFocusEffect } from '@react-navigation/native';
import * as Speech from 'expo-speech';
import SafeImage from '../../components/SafeImage';

import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppSettings } from '../../context/appSettingsContext';
import { useVoiceAssistant } from '../../context/voiceAssistantContext';
import { db } from '../../firebaseConfig';
import {
  deleteLocalWardrobeItem,
  getLocalWardrobeItems,
  updateLocalWardrobeItem,
} from '../../lib/localData';

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

export default function WardrobeScreen() {
  const [items, setItems] = useState<WardrobeItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editColour, setEditColour] = useState('');
  const [editOccasion, setEditOccasion] = useState('');
  const [editMood, setEditMood] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  const listRef = useRef<FlatList<WardrobeItem> | null>(null);
  const cloudItemsRef = useRef<WardrobeItem[]>([]);

  const { registerScreen, registerScreenActions, registerScreenState } =
    useVoiceAssistant();

  const {
    audioDescriptionsEnabled,
    highContrastMode,
    largerTextEnabled,
  } = useAppSettings();

  const categories = [
    'All',
    'Top',
    'Bottom',
    'Dress',
    'Outerwear',
    'Shoes',
    'Accessory',
    'Other',
  ];

  const refreshMergedItems = async (cloudItemsOverride?: WardrobeItem[]) => {
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

    setItems(merged);
  };

  useEffect(() => {
    const q = query(collection(db, 'wardrobe'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const wardrobeItems = snapshot.docs.map((itemDoc) => ({
        id: itemDoc.id,
        ...itemDoc.data(),
        localOnly: false,
      })) as WardrobeItem[];

      cloudItemsRef.current = wardrobeItems;
      await refreshMergedItems(wardrobeItems);
      setLoadingItems(false);
    });

    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      registerScreen('wardrobe');
      refreshMergedItems();
    }, [registerScreen])
  );

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'All') {
      return items;
    }

    return items.filter((item) => item.category === selectedCategory);
  }, [items, selectedCategory]);

  const stopReading = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  const closeSelectedItem = () => {
    stopReading();
    setSelectedItem(null);
    setIsEditing(false);
  };

  const handleDeleteItem = async (id: string) => {
    try {
      const existingItem = items.find((item) => item.id === id);

      if (existingItem?.localOnly) {
        await deleteLocalWardrobeItem(id);
        await refreshMergedItems();

        if (selectedItem?.id === id) {
          closeSelectedItem();
        }

        Alert.alert('Success', 'Local item deleted');
        return;
      }

      await deleteDoc(doc(db, 'wardrobe', id));

      if (selectedItem?.id === id) {
        closeSelectedItem();
      }

      Alert.alert('Success', 'Item deleted');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to delete item');
    }
  };

  const handleStartEdit = () => {
    if (!selectedItem) return;

    setEditCategory(selectedItem.category);
    setEditColour(selectedItem.colour);
    setEditOccasion(selectedItem.occasion);
    setEditMood(selectedItem.mood);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedItem) return;

    if (!editCategory || !editColour || !editOccasion || !editMood) {
      Alert.alert('Missing information', 'Please complete all edit fields');
      return;
    }

    try {
      if (selectedItem.localOnly) {
        await updateLocalWardrobeItem(selectedItem.id, {
          category: editCategory,
          colour: editColour,
          occasion: editOccasion,
          mood: editMood,
        });

        setSelectedItem({
          ...selectedItem,
          category: editCategory,
          colour: editColour,
          occasion: editOccasion,
          mood: editMood,
        });

        await refreshMergedItems();
        setIsEditing(false);
        Alert.alert('Success', 'Local item updated');
        return;
      }

      await updateDoc(doc(db, 'wardrobe', selectedItem.id), {
        category: editCategory,
        colour: editColour,
        occasion: editOccasion,
        mood: editMood,
      });

      setSelectedItem({
        ...selectedItem,
        category: editCategory,
        colour: editColour,
        occasion: editOccasion,
        mood: editMood,
      });

      setIsEditing(false);
      Alert.alert('Success', 'Item updated');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to update item');
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
      stopReading();
      return;
    }

    const speechText = `${selectedItem.itemName}. Category: ${selectedItem.category}. Colour: ${selectedItem.colour}. Occasion: ${selectedItem.occasion}. Mood: ${selectedItem.mood}. Description: ${selectedItem.description}.`;

    Speech.speak(speechText, {
      rate: 0.95,
      pitch: 1,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });

    setIsSpeaking(true);
  };

  const openWardrobeItemByName = async (itemName?: string) => {
    if (!itemName) return;

    const lowerName = itemName.toLowerCase().trim();

    const matchedItem = items.find((item) => {
      const itemFullName = item.itemName.toLowerCase();
      const itemColour = item.colour.toLowerCase();
      const itemCategory = item.category.toLowerCase();

      return (
        itemFullName === lowerName ||
        itemFullName.includes(lowerName) ||
        lowerName.includes(itemFullName) ||
        (lowerName.includes(itemColour) && lowerName.includes(itemCategory))
      );
    });

    if (!matchedItem) return;

    stopReading();
    setSelectedItem(matchedItem);
    setIsEditing(false);
  };

  const openWardrobeItemByIndex = async (index?: number) => {
    const safeIndex = index ?? 0;
    const matchedItem = filteredItems[safeIndex];

    if (!matchedItem) return;

    stopReading();
    setSelectedItem(matchedItem);
    setIsEditing(false);
  };

  const scrollScreen = async (direction: 'up' | 'down' = 'down') => {
    if (!listRef.current) return;

    listRef.current.scrollToOffset({
      offset: direction === 'down' ? 500 : 0,
      animated: true,
    });
  };

  const setSelectedItemFields = async (payload: {
    category?: string;
    colour?: string;
    occasion?: string;
    mood?: string;
  }) => {
    if (!selectedItem) return;

    if (!isEditing) {
      handleStartEdit();
    }

    if (payload.category) {
      const matchedCategory = categories.find(
        (category) => category.toLowerCase() === payload.category?.toLowerCase()
      );

      if (matchedCategory && matchedCategory !== 'All') {
        setEditCategory(matchedCategory);
      }
    }

    if (payload.colour) {
      setEditColour(payload.colour);
    }

    if (payload.occasion) {
      setEditOccasion(payload.occasion);
    }

    if (payload.mood) {
      setEditMood(payload.mood);
    }
  };

  useEffect(() => {
    registerScreenActions('wardrobe', {
      filterWardrobeCategory: async (category?: string) => {
        if (!category || category === 'All') {
          setSelectedCategory('All');
          return;
        }

        const matchedCategory = categories.find(
          (existingCategory) =>
            existingCategory.toLowerCase() === category.toLowerCase()
        );

        setSelectedCategory(matchedCategory || 'All');
      },

      openWardrobeItem: async (itemName?: string) => {
        await openWardrobeItemByName(itemName);
      },

      openWardrobeItemByIndex: async (index?: number) => {
        await openWardrobeItemByIndex(index);
      },

      expandWardrobeItem: async (itemName?: string) => {
        if (itemName) {
          await openWardrobeItemByName(itemName);
          return;
        }

        await openWardrobeItemByIndex(0);
      },

      startEditingWardrobeItem: async () => {
        handleStartEdit();
      },

      saveEditedWardrobeItem: async () => {
        await handleSaveEdit();
      },

      closeWardrobeItem: async () => {
        closeSelectedItem();
      },

      scrollScreen: async (direction: 'up' | 'down' = 'down') => {
        await scrollScreen(direction);
      },

      setWardrobeItemFields: async (payload: {
        category?: string;
        colour?: string;
        occasion?: string;
        mood?: string;
      }) => {
        await setSelectedItemFields(payload);
      },
    });
  }, [
    items,
    filteredItems,
    selectedItem,
    isEditing,
    editCategory,
    editColour,
    editOccasion,
    editMood,
    registerScreenActions,
  ]);

  useEffect(() => {
    registerScreenState('wardrobe', {
      selectedCategory,
      totalItems: items.length,
      filteredCount: filteredItems.length,
      selectedItemName: selectedItem?.itemName || '',
      selectedItemCategory: selectedItem?.category || '',
      isEditing,
      categories,
      hasSelectedItem: !!selectedItem,
    });
  }, [
    selectedCategory,
    items.length,
    filteredItems.length,
    selectedItem,
    isEditing,
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

  const softCardDynamicStyle = highContrastMode
    ? { backgroundColor: '#ffffff', borderColor: '#000000' }
    : null;

  const darkButtonDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000', borderColor: '#000000' }
    : null;

  const activeFilterDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000', borderColor: '#000000' }
    : null;

  const titleLineDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000' }
    : null;

  const modalOverlayDynamicStyle = highContrastMode
    ? { backgroundColor: 'rgba(0,0,0,0.6)' }
    : null;

  const textDynamicStyle = highContrastMode ? { color: '#000000' } : null;
  const invertedTextDynamicStyle = { color: '#ffffff' };

  const largeTitleStyle = largerTextEnabled ? { fontSize: 28 } : null;
  const largeCardTitleStyle = largerTextEnabled ? { fontSize: 20 } : null;
  const largeLabelStyle = largerTextEnabled ? { fontSize: 15 } : null;
  const largeBodyStyle = largerTextEnabled ? { fontSize: 15, lineHeight: 22 } : null;
  const largeSmallTextStyle = largerTextEnabled ? { fontSize: 13, lineHeight: 18 } : null;
  const largeButtonStyle = largerTextEnabled ? { fontSize: 16 } : null;

  return (
    <View style={[styles.screen, screenDynamicStyle]}>
      <View style={[styles.outerFrame, outerFrameDynamicStyle]}>
        <View style={[styles.innerFrame, innerFrameDynamicStyle]}>
          <View style={styles.headerBlock}>
            <Text style={[styles.title, textDynamicStyle, largeTitleStyle]}>
              My Wardrobe
            </Text>
            <View style={[styles.titleLine, titleLineDynamicStyle]} />
          </View>

          <View style={styles.filterSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {categories.map((category) => {
                const isActive = selectedCategory === category;

                return (
                  <Pressable
                    key={category}
                    style={[
                      styles.filterButton,
                      cardDynamicStyle,
                      isActive && styles.activeFilterButton,
                      isActive && activeFilterDynamicStyle,
                    ]}
                    onPress={() => setSelectedCategory(category)}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        textDynamicStyle,
                        largeSmallTextStyle,
                        isActive && styles.activeFilterText,
                        isActive && invertedTextDynamicStyle,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {loadingItems ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#253041" />
              <Text style={[styles.loadingText, textDynamicStyle, largeBodyStyle]}>
                Loading wardrobe...
              </Text>
            </View>
          ) : null}

          <FlatList
            ref={listRef}
            data={filteredItems}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.card, cardDynamicStyle]}
                onPress={() => setSelectedItem(item)}
              >
                <View style={[styles.cardImageFrame, softCardDynamicStyle]}>
                  <SafeImage uri={item.imageUrl} style={styles.itemImage} />
                </View>

                <Text style={[styles.cardTitle, textDynamicStyle, largeCardTitleStyle]}>
                  {item.itemName}
                </Text>
                <View style={[styles.cardTitleLine, titleLineDynamicStyle]} />

                <View style={styles.metaGrid}>
                  <View style={[styles.metaBox, softCardDynamicStyle]}>
                    <Text style={[styles.metaLabel, textDynamicStyle, largeSmallTextStyle]}>
                      Category
                    </Text>
                    <Text style={[styles.metaValue, textDynamicStyle, largeLabelStyle]}>
                      {item.category}
                    </Text>
                  </View>

                  <View style={[styles.metaBox, softCardDynamicStyle]}>
                    <Text style={[styles.metaLabel, textDynamicStyle, largeSmallTextStyle]}>
                      Colour
                    </Text>
                    <Text style={[styles.metaValue, textDynamicStyle, largeLabelStyle]}>
                      {item.colour}
                    </Text>
                  </View>

                  <View style={[styles.metaBox, softCardDynamicStyle]}>
                    <Text style={[styles.metaLabel, textDynamicStyle, largeSmallTextStyle]}>
                      Occasion
                    </Text>
                    <Text style={[styles.metaValue, textDynamicStyle, largeLabelStyle]}>
                      {item.occasion}
                    </Text>
                  </View>

                  <View style={[styles.metaBox, softCardDynamicStyle]}>
                    <Text style={[styles.metaLabel, textDynamicStyle, largeSmallTextStyle]}>
                      Mood
                    </Text>
                    <Text style={[styles.metaValue, textDynamicStyle, largeLabelStyle]}>
                      {item.mood}
                    </Text>
                  </View>
                </View>

                <View style={[styles.descriptionBox, softCardDynamicStyle]}>
                  <Text
                    style={[styles.descriptionLabel, textDynamicStyle, largeSmallTextStyle]}
                  >
                    Description
                  </Text>
                  <Text
                    style={[styles.descriptionText, textDynamicStyle, largeBodyStyle]}
                  >
                    {item.description}
                  </Text>
                </View>

                <Pressable
                  style={[styles.deleteButton, darkButtonDynamicStyle]}
                  onPress={() => handleDeleteItem(item.id)}
                >
                  <Text
                    style={[styles.deleteText, invertedTextDynamicStyle, largeButtonStyle]}
                  >
                    Delete item
                  </Text>
                </Pressable>
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={[styles.emptyState, cardDynamicStyle]}>
                <Text style={[styles.emptyTitle, textDynamicStyle, largeCardTitleStyle]}>
                  No items found
                </Text>
                <Text style={[styles.emptyText, textDynamicStyle, largeBodyStyle]}>
                  No wardrobe items in this category yet.
                </Text>
              </View>
            }
          />
        </View>
      </View>

      <Modal
        visible={selectedItem !== null}
        transparent
        animationType="slide"
        onRequestClose={closeSelectedItem}
      >
        <View style={[styles.modalOverlay, modalOverlayDynamicStyle]}>
          <View style={[styles.modalFrameOuter, outerFrameDynamicStyle]}>
            <View style={[styles.modalFrameInner, innerFrameDynamicStyle]}>
              {selectedItem ? (
                <>
                  <View style={[styles.modalImageFrame, softCardDynamicStyle]}>
                    <Image
                      source={{ uri: selectedItem.imageUrl }}
                      style={styles.modalImage}
                    />
                  </View>

                  <Text style={[styles.modalTitle, textDynamicStyle, largeCardTitleStyle]}>
                    {selectedItem.itemName}
                  </Text>
                  <View style={[styles.modalTitleLine, titleLineDynamicStyle]} />

                  {isEditing ? (
                    <>
                      <Text style={[styles.editLabel, textDynamicStyle, largeLabelStyle]}>
                        Category
                      </Text>
                      <View style={[styles.modalPickerWrapper, cardDynamicStyle]}>
                        <Picker
                          selectedValue={editCategory}
                          onValueChange={setEditCategory}
                          style={styles.picker}
                        >
                          <Picker.Item label="Top" value="Top" />
                          <Picker.Item label="Bottom" value="Bottom" />
                          <Picker.Item label="Dress" value="Dress" />
                          <Picker.Item label="Outerwear" value="Outerwear" />
                          <Picker.Item label="Shoes" value="Shoes" />
                          <Picker.Item label="Accessory" value="Accessory" />
                          <Picker.Item label="Other" value="Other" />
                        </Picker>
                      </View>

                      <Text style={[styles.editLabel, textDynamicStyle, largeLabelStyle]}>
                        Colour
                      </Text>
                      <TextInput
                        style={[styles.editInput, cardDynamicStyle, textDynamicStyle, largeBodyStyle]}
                        value={editColour}
                        onChangeText={setEditColour}
                        placeholder="Enter colour"
                        placeholderTextColor="#8b939c"
                      />

                      <Text style={[styles.editLabel, textDynamicStyle, largeLabelStyle]}>
                        Occasion
                      </Text>
                      <View style={[styles.modalPickerWrapper, cardDynamicStyle]}>
                        <Picker
                          selectedValue={editOccasion}
                          onValueChange={setEditOccasion}
                          style={styles.picker}
                        >
                          <Picker.Item label="Casual" value="Casual" />
                          <Picker.Item label="Work" value="Work" />
                          <Picker.Item label="Party" value="Party" />
                          <Picker.Item label="Formal" value="Formal" />
                          <Picker.Item label="Sport" value="Sport" />
                        </Picker>
                      </View>

                      <Text style={[styles.editLabel, textDynamicStyle, largeLabelStyle]}>
                        Mood
                      </Text>
                      <View style={[styles.modalPickerWrapper, cardDynamicStyle]}>
                        <Picker
                          selectedValue={editMood}
                          onValueChange={setEditMood}
                          style={styles.picker}
                        >
                          <Picker.Item label="Comfortable" value="Comfortable" />
                          <Picker.Item label="Confident" value="Confident" />
                          <Picker.Item label="Relaxed" value="Relaxed" />
                          <Picker.Item label="Productive" value="Productive" />
                          <Picker.Item label="Social" value="Social" />
                        </Picker>
                      </View>

                      <Pressable
                        style={[styles.primaryModalButton, darkButtonDynamicStyle]}
                        onPress={handleSaveEdit}
                      >
                        <Text
                          style={[
                            styles.primaryModalButtonText,
                            invertedTextDynamicStyle,
                            largeButtonStyle,
                          ]}
                        >
                          Save changes
                        </Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <View style={styles.modalMetaGrid}>
                        <View style={[styles.modalMetaBox, softCardDynamicStyle]}>
                          <Text
                            style={[
                              styles.modalMetaLabel,
                              textDynamicStyle,
                              largeSmallTextStyle,
                            ]}
                          >
                            Category
                          </Text>
                          <Text
                            style={[
                              styles.modalMetaValue,
                              textDynamicStyle,
                              largeLabelStyle,
                            ]}
                          >
                            {selectedItem.category}
                          </Text>
                        </View>

                        <View style={[styles.modalMetaBox, softCardDynamicStyle]}>
                          <Text
                            style={[
                              styles.modalMetaLabel,
                              textDynamicStyle,
                              largeSmallTextStyle,
                            ]}
                          >
                            Colour
                          </Text>
                          <Text
                            style={[
                              styles.modalMetaValue,
                              textDynamicStyle,
                              largeLabelStyle,
                            ]}
                          >
                            {selectedItem.colour}
                          </Text>
                        </View>

                        <View style={[styles.modalMetaBox, softCardDynamicStyle]}>
                          <Text
                            style={[
                              styles.modalMetaLabel,
                              textDynamicStyle,
                              largeSmallTextStyle,
                            ]}
                          >
                            Occasion
                          </Text>
                          <Text
                            style={[
                              styles.modalMetaValue,
                              textDynamicStyle,
                              largeLabelStyle,
                            ]}
                          >
                            {selectedItem.occasion}
                          </Text>
                        </View>

                        <View style={[styles.modalMetaBox, softCardDynamicStyle]}>
                          <Text
                            style={[
                              styles.modalMetaLabel,
                              textDynamicStyle,
                              largeSmallTextStyle,
                            ]}
                          >
                            Mood
                          </Text>
                          <Text
                            style={[
                              styles.modalMetaValue,
                              textDynamicStyle,
                              largeLabelStyle,
                            ]}
                          >
                            {selectedItem.mood}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.modalDescriptionBox, softCardDynamicStyle]}>
                        <Text
                          style={[
                            styles.modalDescriptionLabel,
                            textDynamicStyle,
                            largeSmallTextStyle,
                          ]}
                        >
                          Description
                        </Text>
                        <Text
                          style={[
                            styles.modalDescriptionText,
                            textDynamicStyle,
                            largeBodyStyle,
                          ]}
                        >
                          {selectedItem.description}
                        </Text>
                      </View>

                      {audioDescriptionsEnabled ? (
                        <Pressable
                          style={[styles.readButton, cardDynamicStyle]}
                          onPress={handleReadAloud}
                        >
                          <Text
                            style={[
                              styles.readButtonText,
                              textDynamicStyle,
                              largeButtonStyle,
                            ]}
                          >
                            {isSpeaking ? '⏹ Stop reading' : '🔊 Read item aloud'}
                          </Text>
                        </Pressable>
                      ) : null}

                      <Pressable
                        style={[styles.secondaryModalButton, cardDynamicStyle]}
                        onPress={handleStartEdit}
                      >
                        <Text
                          style={[
                            styles.secondaryModalButtonText,
                            textDynamicStyle,
                            largeButtonStyle,
                          ]}
                        >
                          Edit item
                        </Text>
                      </Pressable>
                    </>
                  )}

                  <Pressable
                    style={[styles.closeButton, darkButtonDynamicStyle]}
                    onPress={closeSelectedItem}
                  >
                    <Text
                      style={[
                        styles.closeButtonText,
                        invertedTextDynamicStyle,
                        largeButtonStyle,
                      ]}
                    >
                      Close
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </Modal>
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
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#cfd4da',
    borderRadius: 22,
    backgroundColor: '#f7f7f7',
    paddingTop: 22,
  },
  headerBlock: {
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 16,
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
  filterSection: {
    marginBottom: 6,
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    alignItems: 'center',
  },
  filterButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: '#edf0f3',
    marginRight: 10,
    borderWidth: 1.2,
    borderColor: '#cfd4da',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeFilterButton: {
    backgroundColor: '#253041',
    borderColor: '#253041',
  },
  filterText: {
    color: '#3c4752',
    fontWeight: '600',
    fontSize: 13,
  },
  activeFilterText: {
    color: '#ffffff',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 130,
    paddingTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 14,
    color: '#66707a',
  },
  card: {
    borderWidth: 2,
    borderColor: '#2d3847',
    backgroundColor: '#fbfbfb',
    padding: 14,
    marginBottom: 14,
  },
  cardImageFrame: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#eef1f4',
    padding: 8,
    marginBottom: 12,
  },
  itemImage: {
    width: '100%',
    height: 220,
    resizeMode: 'contain',
    backgroundColor: '#dde2e7',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2b3440',
    textAlign: 'center',
  },
  cardTitleLine: {
    width: 26,
    height: 2,
    backgroundColor: '#7f8791',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 10,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaBox: {
    width: '48.5%',
    borderWidth: 1.2,
    borderColor: '#d6dbe0',
    backgroundColor: '#f3f5f7',
    padding: 10,
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6e7780',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2b3440',
  },
  descriptionBox: {
    borderWidth: 1.2,
    borderColor: '#d6dbe0',
    backgroundColor: '#f8f9fb',
    padding: 12,
    marginBottom: 12,
  },
  descriptionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6e7780',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  descriptionText: {
    fontSize: 14,
    color: '#4e5862',
    lineHeight: 20,
  },
  deleteButton: {
    backgroundColor: '#253041',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyState: {
    borderWidth: 1.5,
    borderColor: '#d6dbe0',
    backgroundColor: '#fbfbfb',
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#2b3440',
    marginBottom: 6,
  },
  emptyText: {
    textAlign: 'center',
    color: '#66707a',
    fontSize: 14,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 26, 34, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalFrameOuter: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#253041',
    backgroundColor: '#f4f4f4',
    padding: 8,
  },
  modalFrameInner: {
    borderWidth: 1.5,
    borderColor: '#cfd4da',
    backgroundColor: '#fbfbfb',
    padding: 16,
  },
  modalImageFrame: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#eef1f4',
    padding: 8,
    marginBottom: 14,
  },
  modalImage: {
    width: '100%',
    height: 240,
    resizeMode: 'contain',
    backgroundColor: '#dde2e7',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2b3440',
    textAlign: 'center',
  },
  modalTitleLine: {
    width: 28,
    height: 2,
    backgroundColor: '#7f8791',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 14,
    borderRadius: 10,
  },
  modalMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  modalMetaBox: {
    width: '48.5%',
    borderWidth: 1.2,
    borderColor: '#d6dbe0',
    backgroundColor: '#f3f5f7',
    padding: 10,
    marginBottom: 8,
  },
  modalMetaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6e7780',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  modalMetaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2b3440',
  },
  modalDescriptionBox: {
    borderWidth: 1.2,
    borderColor: '#d6dbe0',
    backgroundColor: '#f8f9fb',
    padding: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  modalDescriptionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6e7780',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  modalDescriptionText: {
    fontSize: 14,
    color: '#4e5862',
    lineHeight: 20,
  },
  editLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#49525c',
  },
  editInput: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: '#2b3440',
    marginBottom: 14,
  },
  modalPickerWrapper: {
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
  readButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#7e8791',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  readButtonText: {
    color: '#2b3440',
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryModalButton: {
    backgroundColor: '#e7eaee',
    borderWidth: 1,
    borderColor: '#cfd4da',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  secondaryModalButtonText: {
    color: '#2b3440',
    fontWeight: '600',
    fontSize: 14,
  },
  primaryModalButton: {
    backgroundColor: '#253041',
    borderWidth: 2,
    borderColor: '#2d3847',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  primaryModalButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  closeButton: {
    backgroundColor: '#253041',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
});