// picker for the dropdown boxes
import { Picker } from '@react-native-picker/picker';

// this helps run stuff when this screen is opened/focused
import { useFocusEffect } from '@react-navigation/native';

// lets user pick an image from gallery
import * as ImagePicker from 'expo-image-picker';

// used for reading text out loud
import * as Speech from 'expo-speech';

// firestore stuff for saving and reading wardrobe items
import { addDoc, collection, getDocs } from 'firebase/firestore';

// storage stuff for image upload
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';



// react hooks
import React, { useCallback, useEffect, useRef, useState } from 'react';

// main react native components used on this page
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

// gets app settings like privacy mode, contrast mode etc
import { useAppSettings } from '../../context/appSettingsContext';

// gets voice assistant functions for this screen
import { useVoiceAssistant } from '../../context/voiceAssistantContext';



// firebase config
import { db, storage } from '../../firebaseConfig';

// helper for saving item only on the device if privacy mode is on
import { addLocalWardrobeItem } from '../../lib/localData';

export default function AddItemScreen() {
  // states for all the form boxes
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [colour, setColour] = useState('');
  const [occasion, setOccasion] = useState('');
  const [mood, setMood] = useState('');
    const [description, setDescription] = useState('');

  // imageUri is the phone image path, imageUrl is after upload
  const [imageUri, setImageUri] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // just to know if speech is playing rn
  const [isSpeaking, setIsSpeaking] = useState(false);

  // ref for scrolling the screen by code / voice command
  const scrollViewRef = useRef<ScrollView | null>(null);

  // functions from the voice assistant context
  const { registerScreen, registerScreenActions, registerScreenState } =
    useVoiceAssistant();

  // settings from app settings context
  const {
    approveImagesBeforeAI,
    localStorageOnly,
    audioDescriptionsEnabled,
    highContrastMode,
    largerTextEnabled,
  } = useAppSettings();

  // when this screen opens, register it as addItem
  useFocusEffect(
    useCallback(() => {
      registerScreen('addItem');
    }, [registerScreen])
  );

  // makes text look neater before saving
  const capitalizeWords = (text: string) =>
    text
      .trim()
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

  // asks user first if image approval setting is turned on
  const askForImageApproval = () =>
    new Promise<boolean>((resolve) => {
      Alert.alert(
        'Approve image for AI use',
        'Do you want to allow this image to be analysed by AI?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Approve',
            onPress: () => resolve(true),
          },
        ]
      );
    });

  // opens image gallery so user can pick a photo
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });

    // if user picked one, save it
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setImageUrl('');
    }
  };

  // uploads chosen image to firebase storage and gets back the url
  const uploadImageAndGetUrl = async () => {
    if (!imageUri) {
      throw new Error('No image selected');
    }

    // turns the local image into blob form first
    const response = await fetch(imageUri);
     const blob = await response.blob();

    // gives the file a unique name
    const fileName = `wardrobe/${Date.now()}-${itemName || 'item'}.jpg`;
    const storageRef = ref(storage, fileName);



    await uploadBytes(storageRef, blob);
    const uploadedImageUrl = await getDownloadURL(storageRef);

    return uploadedImageUrl;
  };

  // clears everything in the form and stops speech too
  const handleClearForm = () => {
    Speech.stop();
    setIsSpeaking(false);

    setItemName('');
    setCategory('');
    setColour('');
    setOccasion('');
    setMood('');
    setDescription('');
    setImageUri('');
    setImageUrl('');
  };

  // sends the image to the backend so ai can fill some fields in
  const handleAnalyzeImage = async () => {
    if (!imageUri) {
      Alert.alert('No image selected', 'Please choose an image first');
      return;
    }

    // if approval setting is on, ask before doing ai analysis
    if (approveImagesBeforeAI) {
      const approved = await askForImageApproval();

      if (!approved) {
        return;
      }
    }

    try {
      // upload first so backend can use the image url
      const uploadedImageUrl = await uploadImageAndGetUrl();
      setImageUrl(uploadedImageUrl);

      const response = await fetch('http://192.168.0.83:3001/analyze-item', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl: uploadedImageUrl }),
      });

      const data = await response.json();

      // fills the inputs using what ai gives back
      setItemName(data.itemName || '');
      setCategory(data.category || '');
      setColour(data.colour || '');
      setOccasion(data.occasion || '');
      setMood(data.mood || '');
      setDescription(data.description || '');

      Alert.alert('Success', 'AI suggestions added');
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to analyze image');
    }


  };

  // reads the current details aloud
  const handleReadAloud = () => {
    if (!audioDescriptionsEnabled) {
      Alert.alert(
        'Audio descriptions off',
        'Turn audio descriptions on in Accessibility settings to use this feature.'
      );
      return;
    }

    // if theres nothing there then dont read anything
    if (!itemName && !category && !colour && !occasion && !mood && !description) {
      return;
    }

    // if already speaking, pressing again stops it
    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;

    }

    // builds one string from all the form values
    const text = `${itemName || 'No item name yet'}. Category: ${
      category || 'not set'
    }. Colour: ${colour || 'not set'}. Occasion: ${
      occasion || 'not set'
    }. Mood: ${mood || 'not set'}. Description: ${description || 'not set'}.`;

    Speech.speak(text, {
      rate: 0.95,
      pitch: 1,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });

    setIsSpeaking(true);
  };

  // saves the item either locally or to firebase
  const handleSaveItem = async () => {
    // basic check so user doesnt save half empty item
    if (!itemName || !category || !colour || !occasion || !mood || !imageUri) {
      Alert.alert(
        'Missing information',
        'Please complete the required fields and choose an image'
      );
      return;
    }

    try {
      let finalImageUrl = imageUrl;

      // if image wasnt uploaded already, do it now
        if (!finalImageUrl) {
        finalImageUrl = await uploadImageAndGetUrl();
      }

      // privacy mode means save only on this device
      if (localStorageOnly) {
        await addLocalWardrobeItem({
          id: `local-${Date.now()}`,
          itemName: capitalizeWords(itemName),
          category,
          colour: capitalizeWords(colour),
          occasion,
          mood,
          description,
          imageUrl: finalImageUrl,
          createdAt: new Date().toISOString(),
          localOnly: true,
        });

        Speech.stop();
        setIsSpeaking(false);
        Alert.alert('Saved locally', 'Item saved on this device only');
        handleClearForm();
        return;
      }

      // gets all wardrobe docs first so duplicates can be checked
      const snapshot = await getDocs(collection(db, 'wardrobe'));

      const normalisedItemName = itemName.toLowerCase().trim();
        const normalisedCategory = category.toLowerCase().trim();
      const normalisedColour = colour.toLowerCase().trim();

      // checks if same item is already there
      const existingItem = snapshot.docs.find((wardrobeDoc) => {
        const data = wardrobeDoc.data();

        return (
          data.itemName?.toLowerCase().trim() === normalisedItemName &&
          data.category?.toLowerCase().trim() === normalisedCategory &&
          data.colour?.toLowerCase().trim() === normalisedColour
        );
      });

      if (existingItem) {
        Alert.alert('Already added', 'This wardrobe item already exists.');
        return;
      }

      // saves the item to firebase
      await addDoc(collection(db, 'wardrobe'), {
        itemName: capitalizeWords(itemName),
        category,
        colour: capitalizeWords(colour),
        occasion,
        mood,
        description,
        imageUrl: finalImageUrl,
        createdAt: new Date(),
      });

      Speech.stop();
      setIsSpeaking(false);
       Alert.alert('Success', 'Item saved to Firebase');
      handleClearForm();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to save item');
    }
  };

  // used by voice actions to set occasion and mood
  const setOutfitContext = async (payload: {
    occasion?: string;
    mood?: string;
    weather?: string;
  }) => {
    if (payload.occasion) {
      setOccasion(payload.occasion);
    }

    if (payload.mood) {
      setMood(payload.mood);
    }
  };

  useEffect(() => {
    // registering what voice assistant is allowed to do on this screen
    registerScreenActions('addItem', {
      setOutfitContext,

      // this lets voice assistant fill fields in
      setAddItemFields: async (payload: {
        itemName?: string;
        category?: string;
        colour?: string;
        occasion?: string;
        mood?: string;
        description?: string;
      }) => {
        if (payload.itemName) {
          setItemName(payload.itemName);
        }

        if (payload.category) {
          setCategory(payload.category);
        }

        if (payload.colour) {
          setColour(payload.colour);
        }

        if (payload.occasion) {
          setOccasion(payload.occasion);
        }

        if (payload.mood) {
          setMood(payload.mood);
        }

        if (payload.description) {
          setDescription(payload.description);
        }
      },

      // voice command can start ai analysis
      analyzeCurrentImage: async () => {
        await handleAnalyzeImage();


      },

      // voice command can save item too
      saveCurrentItem: async () => {
        await handleSaveItem();
      },

      clearAddItemForm: async () => {
        handleClearForm();
      },

      // scrolls page up or down a bit
      scrollScreen: async (direction: 'up' | 'down' = 'down') => {
        if (!scrollViewRef.current) return;

        scrollViewRef.current.scrollTo({
          y: direction === 'down' ? 500 : 0,
          animated: true,
        });
      },
    });
  }, [
    registerScreenActions,
    itemName,
    category,
    colour,
    occasion,
    mood,
    description,
    imageUri,
    imageUrl,
    approveImagesBeforeAI,
    localStorageOnly,
  ]);




  useEffect(() => {
    // this gives current screen state to the voice assistant
    registerScreenState('addItem', {
      itemName,
      category,
      colour,
      occasion,
      mood,
      description,
      hasImage: !!imageUri,
      imageSelected: !!imageUri,
      readyToSave:
        !!itemName && !!category && !!colour && !!occasion && !!mood && !!imageUri,
      localStorageOnly,
      approveImagesBeforeAI,
    });
  }, [
    itemName,
    category,
    colour,
    occasion,
    mood,
    description,
    imageUri,
    localStorageOnly,
    approveImagesBeforeAI,
    registerScreenState,

  ]);

  // these style vars change if high contrast mode is on
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

  const titleLineDynamicStyle = highContrastMode
    ? { backgroundColor: '#000000' }
    : null;

  const textDynamicStyle = highContrastMode ? { color: '#000000' } : null;
  const invertedTextDynamicStyle = { color: '#ffffff' };

  // these make text bigger if larger text setting is on
  const largeTitleStyle = largerTextEnabled ? { fontSize: 28 } : null;
  const largeLabelStyle = largerTextEnabled ? { fontSize: 15 } : null;
  const largeBodyStyle = largerTextEnabled ? { fontSize: 15, lineHeight: 22 } : null;
  const largeButtonStyle = largerTextEnabled ? { fontSize: 16 } : null;
  const largeStatusStyle = largerTextEnabled ? { fontSize: 13, lineHeight: 19 } : null;

  return (
    <View style={[styles.screen, screenDynamicStyle]}>
      <View style={[styles.outerFrame, outerFrameDynamicStyle]}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[styles.innerFrame, innerFrameDynamicStyle]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerBlock}>
            <Text style={[styles.title, textDynamicStyle, largeTitleStyle]}>
              Add Wardrobe Item
            </Text>
            <View style={[styles.titleLine, titleLineDynamicStyle]} />
          </View>


          {/* shows this little message if privacy mode is on */}
          {localStorageOnly ? (
            <View style={[styles.statusInfoBox, softCardDynamicStyle]}>
              <Text style={[styles.statusInfoText, textDynamicStyle, largeStatusStyle]}>
                Privacy mode is on. New items will be saved on this device only.
              </Text>
            </View>
          ) : null}

          {/* another message for image approval setting */}
          {approveImagesBeforeAI ? (
            <View style={[styles.statusInfoBox, softCardDynamicStyle]}>
              <Text style={[styles.statusInfoText, textDynamicStyle, largeStatusStyle]}>
                Image approval is on. You will be asked before AI analyses a photo.
              </Text>
            </View>
          ) : null}

          <View style={[styles.formCard, cardDynamicStyle]}>
            <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
              Item name
            </Text>
            <TextInput
              style={[styles.input, cardDynamicStyle, textDynamicStyle, largeBodyStyle]}
              placeholder="Enter item name"
              placeholderTextColor="#8b939c"
              value={itemName}
              onChangeText={setItemName}
              autoCapitalize="words"
            />

            <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
              Category
            </Text>
            <View style={[styles.pickerWrapper, cardDynamicStyle]}>
              <Picker
                selectedValue={category}
                onValueChange={setCategory}
                style={styles.picker}
              >
                <Picker.Item label="Choose category" value="" />
                <Picker.Item label="Top" value="Top" />
                <Picker.Item label="Bottom" value="Bottom" />
                <Picker.Item label="Dress" value="Dress" />
                <Picker.Item label="Outerwear" value="Outerwear" />
                <Picker.Item label="Shoes" value="Shoes" />
                <Picker.Item label="Accessory" value="Accessory" />
                <Picker.Item label="Other" value="Other" />
              </Picker>
            </View>

            <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
              Colour
            </Text>
            <TextInput
              style={[styles.input, cardDynamicStyle, textDynamicStyle, largeBodyStyle]}
              placeholder="Enter main colour"
              placeholderTextColor="#8b939c"
              value={colour}
              onChangeText={setColour}
              autoCapitalize="words"
            />


            <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
              Occasion
            </Text>
            <View style={[styles.pickerWrapper, cardDynamicStyle]}>
              <Picker
                selectedValue={occasion}
                onValueChange={setOccasion}
                style={styles.picker}
              >
                <Picker.Item label="Choose occasion" value="" />
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
              <Picker
                selectedValue={mood}
                onValueChange={setMood}
                style={styles.picker}
              >
                <Picker.Item label="Choose mood" value="" />
                <Picker.Item label="Comfortable" value="Comfortable" />
                <Picker.Item label="Confident" value="Confident" />
                <Picker.Item label="Relaxed" value="Relaxed" />
                <Picker.Item label="Productive" value="Productive" />
                <Picker.Item label="Social" value="Social" />
              </Picker>
            </View>

            <Text style={[styles.label, textDynamicStyle, largeLabelStyle]}>
              Description
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.descriptionInput,
                cardDynamicStyle,
                textDynamicStyle,
                largeBodyStyle,
              ]}
              placeholder="Add a short description"
              placeholderTextColor="#8b939c"
              value={description}
              onChangeText={setDescription}
              autoCapitalize="sentences"
              multiline
            />

            {/* choose image button */}
            <Pressable
              style={[styles.secondaryDarkButton, darkButtonDynamicStyle]}
              onPress={pickImage}
            >
              <Text
                style={[
                  styles.secondaryDarkButtonText,
                  invertedTextDynamicStyle,
                  largeButtonStyle,
                ]}
              >
                {imageUri ? 'Change image' : 'Choose image'}
              </Text>
            </Pressable>

            {/* only show preview if image was picked */}
            {imageUri ? (
              <View style={[styles.previewFrame, softCardDynamicStyle]}>
                <Image source={{ uri: imageUri }} style={styles.previewImage} />
              </View>
            ) : null}

            {/* this sends image to ai */}
            <Pressable
              style={[styles.secondaryDarkButton, darkButtonDynamicStyle]}
              onPress={handleAnalyzeImage}
            >
              <Text
                style={[
                  styles.secondaryDarkButtonText,
                  invertedTextDynamicStyle,
                  largeButtonStyle,
                ]}
              >
                Analyze with AI
              </Text>
            </Pressable>

            {/* read aloud button only if that setting is enabled */}
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
                  {isSpeaking ? '⏹ Stop reading' : '🔊 Read details aloud'}
                </Text>
              </Pressable>
            ) : null}



            {/* clears form */}
            <Pressable
              style={[styles.secondaryButton, cardDynamicStyle]}
              onPress={handleClearForm}
            >
              <Text
                style={[
                  styles.secondaryButtonText,
                  textDynamicStyle,
                  largeButtonStyle,
                ]}
              >
                Clear form
              </Text>
            </Pressable>

            {/* main save button */}
            <Pressable
              style={[styles.primaryButton, darkButtonDynamicStyle]}
              onPress={handleSaveItem}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  invertedTextDynamicStyle,
                  largeButtonStyle,
                ]}
              >
                {localStorageOnly ? 'Save item locally' : 'Save item'}
              </Text>
            </Pressable>
          </View>

        </ScrollView>
      </View>

    </View>
  );
}

// styles for this screen
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
  statusInfoBox: {
    borderWidth: 1.2,
    borderColor: '#cfd4da',
    backgroundColor: '#fbfbfb',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  statusInfoText: {
    fontSize: 12,
    color: '#616973',
    textAlign: 'center',
    lineHeight: 17,
  },
  formCard: {
    borderWidth: 2,
    borderColor: '#2d3847',
    backgroundColor: '#fbfbfb',
    padding: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    color: '#49525c',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#2b3440',
    marginBottom: 14,
  },
  descriptionInput: {
    minHeight: 90,
    textAlignVertical: 'top',
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
  previewFrame: {
    borderWidth: 1.5,
    borderColor: '#7e8791',
    backgroundColor: '#eef1f4',
    padding: 10,
    marginBottom: 14,
  },
  previewImage: {
    width: '100%',
    height: 220,
    resizeMode: 'contain',
    backgroundColor: '#dde2e7',
  },
  primaryButton: {
    borderWidth: 2,
    borderColor: '#2d3847',
    backgroundColor: '#253041',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#ffffff',
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
  secondaryDarkButton: {
    backgroundColor: '#2d3847',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    
    marginBottom: 14,
  },
  secondaryDarkButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  readButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#7e8791',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  readButtonText: {
    color: '#2b3440',
    fontWeight: '600',
    fontSize: 14,
  },
});